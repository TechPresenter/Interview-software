import { Interview } from '../models/Interview.js';
import { Candidate } from '../models/Candidate.js';
import { Job } from '../models/Job.js';
import { Company } from '../models/Company.js';
import { config } from '../config/index.js';
import { notify } from './notification.service.js';
import { safeSendTemplated } from './email.service.js';
import { logActivity } from './audit.service.js';
import { emitToCompany } from '../socket/emitters.js';
import { assertWithinLimit } from './limits.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Create an interview from a candidate + job, applying the job's interview
 * blueprint (overridable). Enforces the monthly interview plan limit.
 */
export async function scheduleInterview({ companyId, candidate, job, types, config: cfg = {}, scheduledAt, expiresAt, invitedBy }) {
  await assertWithinLimit(companyId, 'interviews');

  const bp = job?.interviewConfig || {};
  // Merge precedence: request config > job blueprint > sensible default.
  const pick = (key, def) => cfg[key] ?? bp[key] ?? def;
  const config = {
    language: pick('language', 'en'),
    durationMinutes: pick('durationMinutes', 30),
    questionCount: pick('questionCount', 8),
    difficulty: pick('difficulty', 'medium'),
    experienceLevel: pick('experienceLevel', undefined),
    adaptiveDifficulty: pick('adaptiveDifficulty', true),
    followUps: pick('followUps', true),
    randomOrder: pick('randomOrder', false),
    passingScore: pick('passingScore', 50),
    timePerQuestionSeconds: pick('timePerQuestionSeconds', 0),
    autoSubmit: pick('autoSubmit', true),
    maxRetries: pick('maxRetries', 0),
    voiceEnabled: pick('voiceEnabled', true),
    videoEnabled: pick('videoEnabled', true),
    cameraRequired: pick('cameraRequired', true),
    micRequired: pick('micRequired', true),
    proctoring: pick('proctoring', true),
    resumeBased: pick('resumeBased', false),
    jdBased: pick('jdBased', true),
    allowSkip: pick('allowSkip', true),
    maxSkips: pick('maxSkips', 2),
  };

  const interview = await Interview.create({
    company: companyId,
    job: job?._id,
    candidate: candidate._id,
    types: types?.length ? types : bp.types?.length ? bp.types : ['hr'],
    config,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 14 * 864e5), // custom, else 14 days
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

  const [job, company] = await Promise.all([
    interview.job ? Job.findById(interview.job).select('title').lean() : null,
    Company.findById(interview.company).select('name').lean(),
  ]);

  const link = interviewLink(interview);
  const email = candidate.email || candidate.user?.email;
  const jobTitle = job?.title || 'the role';
  const companyName = company?.name || 'The hiring team';
  const expiresAt = interview.expiresAt
    ? new Date(interview.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'soon';

  // Branded candidate invitation email with the interview link.
  await safeSendTemplated('interview_invite', {
    to: email,
    vars: { name: candidate.name, jobTitle, company: companyName, link, expiresAt },
    company: interview.company,
    relatedUser: candidate.user?._id,
  });

  // Keep the in-app notification (the branded template above covers email).
  await notify({
    recipient: candidate.user?._id || candidate._id, // user if linked, else candidate id placeholder
    company: interview.company,
    type: 'interview_scheduled',
    title: 'Your AI interview is ready',
    body: `You have been invited to an interview for ${jobTitle}. Start here: ${link}`,
    link,
    channels: ['in_app'],
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
