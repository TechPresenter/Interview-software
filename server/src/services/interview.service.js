import { Interview } from '../models/Interview.js';
import { Candidate } from '../models/Candidate.js';
import { config } from '../config/index.js';
import { notify } from './notification.service.js';
import { logActivity } from './audit.service.js';
import { emitToCompany } from '../socket/emitters.js';
import { assertWithinLimit } from './limits.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Create an interview from a candidate + job, applying the job's interview
 * blueprint (overridable). Enforces the monthly interview plan limit.
 */
export async function scheduleInterview({ companyId, candidate, job, types, config: cfg, scheduledAt, invitedBy }) {
  await assertWithinLimit(companyId, 'interviews');

  const blueprint = job?.interviewConfig || {};
  const interview = await Interview.create({
    company: companyId,
    job: job?._id,
    candidate: candidate._id,
    types: types?.length ? types : blueprint.types?.length ? blueprint.types : ['hr'],
    config: {
      durationMinutes: cfg?.durationMinutes ?? blueprint.durationMinutes ?? 30,
      questionCount: cfg?.questionCount ?? blueprint.questionCount ?? 8,
      adaptiveDifficulty: cfg?.adaptiveDifficulty ?? blueprint.adaptiveDifficulty ?? true,
      proctoring: cfg?.proctoring ?? true,
      voiceEnabled: cfg?.voiceEnabled ?? true,
    },
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    expiresAt: new Date(Date.now() + 14 * 864e5), // link valid 14 days
    invitedBy,
  });

  // Advance the candidate into the interview stage if still earlier.
  if (['applied', 'screening'].includes(candidate.stage)) {
    candidate.stage = 'interview';
    await candidate.save();
  }

  await logActivity({
    company: companyId,
    actor: invitedBy,
    action: 'interview.scheduled',
    entityType: 'Interview',
    entityId: interview._id,
    summary: `Interview scheduled for ${candidate.name}`,
  });
  emitToCompany(companyId, 'interview:scheduled', { id: interview._id, candidate: candidate.name });

  return interview;
}

/** Build the candidate-facing interview link from the access token. */
export function interviewLink(interview) {
  return `${config.clientUrl}/interview/${interview.accessToken}`;
}

/** Send (or resend) the invitation: in-app + email with the link. */
export async function sendInvite(interview) {
  const candidate = await Candidate.findById(interview.candidate).populate('user', 'email').lean();
  if (!candidate) throw ApiError.notFound('Candidate not found');

  const link = interviewLink(interview);
  const email = candidate.email || candidate.user?.email;

  await notify({
    recipient: candidate.user?._id || candidate._id, // user if linked, else candidate id placeholder
    company: interview.company,
    type: 'interview_scheduled',
    title: 'Your AI interview is ready',
    body: `You have been invited to an interview. Start here: ${link}`,
    link,
    channels: email ? ['in_app', 'email'] : ['in_app'],
    email,
  });

  await logActivity({
    company: interview.company,
    action: 'interview.invited',
    entityType: 'Interview',
    entityId: interview._id,
    summary: `Invitation sent to ${candidate.name}`,
  });

  return { link, sentTo: email };
}

export default { scheduleInterview, sendInvite, interviewLink };
