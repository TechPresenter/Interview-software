import { Interview } from '../../models/Interview.js';
import { Candidate } from '../../models/Candidate.js';
import { Job } from '../../models/Job.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { scheduleInterview, sendInvite, interviewLink } from '../../services/interview.service.js';
import { logActivity } from '../../services/audit.service.js';
import { emitToCompany, emitToInterview } from '../../socket/emitters.js';

const scope = (req, extra = {}) => ({ company: req.companyId, ...extra });

// A candidate is considered "connected" if the room saved activity recently.
const STALE_MS = 45_000;

/** GET /company/interviews */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, {});
  const filter = scope(req, opts.filter);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.job) filter.job = req.query.job;
  const { items, meta } = await paginateQuery(Interview, filter, opts, [
    { path: 'candidate', select: 'name email' },
    { path: 'job', select: 'title' },
  ]);
  return ok(res, items, 'OK', meta);
});

/** GET /company/recordings — completed interviews available for review. */
export const recordings = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { defaultSort: '-completedAt' });
  const filter = scope(req, { status: { $in: ['completed', 'flagged'] } });
  const { items, meta } = await paginateQuery(Interview, filter, opts, [
    { path: 'candidate', select: 'name email' },
    { path: 'job', select: 'title' },
    { path: 'report', select: 'overallScore recommendation' },
  ]);
  const shaped = items.map((i) => ({
    _id: i._id,
    candidate: i.candidate,
    job: i.job,
    status: i.status,
    completedAt: i.completedAt,
    hasVideo: Boolean(i.recordings?.videoUrl),
    videoUrl: i.recordings?.videoUrl || null,
    audioUrl: i.recordings?.audioUrl || null,
    integrityScore: i.proctoring?.integrityScore,
    report: i.report,
  }));
  return ok(res, shaped, 'OK', meta);
});

/** GET /company/interviews/:id */
export const getOne = asyncHandler(async (req, res) => {
  const interview = await Interview.findOne(scope(req, { _id: req.params.id }))
    .populate('candidate', 'name email')
    .populate('job', 'title')
    .populate('report')
    .lean();
  if (!interview) throw ApiError.notFound('Interview not found');
  return ok(res, { ...interview, link: interviewLink(interview) });
});

/** POST /company/interviews — schedule one. */
export const schedule = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOne(scope(req, { _id: req.body.candidate }));
  if (!candidate) throw ApiError.notFound('Candidate not found');

  const job = req.body.job
    ? await Job.findOne(scope(req, { _id: req.body.job }))
    : candidate.job
      ? await Job.findById(candidate.job)
      : null;

  const interview = await scheduleInterview({
    companyId: req.companyId,
    candidate,
    job,
    types: req.body.types,
    config: req.body.config,
    scheduledAt: req.body.scheduledAt,
    invitedBy: req.user._id,
  });

  let invite = null;
  if (req.body.sendInvite) invite = await sendInvite(interview);

  return created(res, { interview, link: interviewLink(interview), invite }, 'Interview scheduled');
});

/**
 * POST /company/interviews/auto — schedule for every candidate of a job
 * (optionally filtered to a pipeline stage).
 */
export const autoSchedule = asyncHandler(async (req, res) => {
  const job = await Job.findOne(scope(req, { _id: req.body.job }));
  if (!job) throw ApiError.notFound('Job not found');

  const filter = scope(req, { job: job._id });
  if (req.body.stage) filter.stage = req.body.stage;
  const candidates = await Candidate.find(filter);

  const results = [];
  for (const candidate of candidates) {
    try {
      const interview = await scheduleInterview({
        companyId: req.companyId,
        candidate,
        job,
        types: req.body.types,
        invitedBy: req.user._id,
      });
      if (req.body.sendInvite) await sendInvite(interview);
      results.push({ candidate: candidate.name, interviewId: interview._id, ok: true });
    } catch (err) {
      results.push({ candidate: candidate.name, ok: false, error: err.message });
    }
  }
  return created(res, { scheduled: results.filter((r) => r.ok).length, results }, 'Auto-scheduling complete');
});

/** POST /company/interviews/:id/invite — (re)send the invitation. */
export const invite = asyncHandler(async (req, res) => {
  const interview = await Interview.findOne(scope(req, { _id: req.params.id }));
  if (!interview) throw ApiError.notFound('Interview not found');
  const result = await sendInvite(interview);
  return ok(res, result, 'Invitation sent');
});

/** GET /company/interviews/:id/monitor — live snapshot for the monitoring view. */
export const monitor = asyncHandler(async (req, res) => {
  const interview = await Interview.findOne(scope(req, { _id: req.params.id }))
    .populate('candidate', 'name email')
    .populate('job', 'title')
    .lean();
  if (!interview) throw ApiError.notFound('Interview not found');

  const total = interview.config?.questionCount || 8;
  const current = Math.min(interview.engineState?.currentIndex || 0, total);
  const events = interview.proctoring?.events || [];
  const lastActivityAt = interview.updatedAt || interview.startedAt || interview.createdAt;
  const live = interview.status === 'in_progress' || interview.status === 'flagged';
  const connected = live && Date.now() - new Date(lastActivityAt).getTime() < STALE_MS;

  const pr = interview.proctoring || {};
  return ok(res, {
    id: interview._id,
    status: interview.status,
    candidate: interview.candidate,
    job: interview.job,
    startedAt: interview.startedAt,
    progress: { current, total, percent: Math.round((current / total) * 100) },
    integrityScore: pr.integrityScore ?? 100,
    // Live AI fraud metrics (§15)
    fraudScore: pr.fraudScore ?? 0,
    riskLevel: pr.riskLevel ?? 'safe',
    attentionScore: pr.attentionScore ?? null,
    eyeContactPct: pr.eyeContactPct ?? null,
    people: (() => { const last = [...events].reverse().find((e) => e.type === 'multiple_faces' || e.type === 'face_missing'); return last?.type === 'multiple_faces' ? (last.detail?.people ?? 2) : 1; })(),
    proctoring: {
      events: events.length,
      high: events.filter((e) => e.severity === 'high').length,
      last: events[events.length - 1] || null,
      recent: events.slice(-8).reverse().map((e) => ({ type: e.type, severity: e.severity, at: e.at, detail: e.detail })),
    },
    evidence: (pr.evidence || []).slice(-6).reverse().map((e) => ({ url: e.url, reason: e.reason, at: e.at })),
    recording: { video: Boolean(interview.recordings?.videoUrl), audio: Boolean(interview.recordings?.audioUrl) },
    connection: connected ? 'connected' : live ? 'reconnecting' : 'offline',
    lastActivityAt,
    transcript: (interview.transcript || []).slice(-10),
  });
});

/** Shared helper for the force controls. */
async function controlInterview(req, { from, to, event, action, message }) {
  const interview = await Interview.findOne(scope(req, { _id: req.params.id }));
  if (!interview) throw ApiError.notFound('Interview not found');
  if (!from.includes(interview.status)) throw ApiError.badRequest(message.error);
  interview.status = to;
  if (to === 'terminated') interview.completedAt = new Date();
  await interview.save();
  emitToInterview(interview._id, event, { id: interview._id, status: to });
  emitToCompany(interview.company, event, { id: interview._id, status: to });
  await logActivity({ company: interview.company, actor: req.user._id, action, entityType: 'Interview', entityId: interview._id, summary: message.log });
  return interview;
}

/** POST /company/interviews/:id/pause — interviewer pauses a live interview. */
export const pause = asyncHandler(async (req, res) => {
  const i = await controlInterview(req, {
    from: ['in_progress', 'flagged'], to: 'paused', event: 'interview:paused', action: 'interview.paused',
    message: { error: 'Only a live interview can be paused', log: 'Interview paused by interviewer' },
  });
  return ok(res, { status: i.status }, 'Interview paused');
});

/** POST /company/interviews/:id/resume — resume a paused interview. */
export const resume = asyncHandler(async (req, res) => {
  const i = await controlInterview(req, {
    from: ['paused'], to: 'in_progress', event: 'interview:resumed', action: 'interview.resumed',
    message: { error: 'Only a paused interview can be resumed', log: 'Interview resumed by interviewer' },
  });
  return ok(res, { status: i.status }, 'Interview resumed');
});

/** POST /company/interviews/:id/terminate — force-stop a live/paused interview. */
export const terminate = asyncHandler(async (req, res) => {
  const i = await controlInterview(req, {
    from: ['in_progress', 'flagged', 'paused'], to: 'terminated', event: 'interview:terminated', action: 'interview.terminated',
    message: { error: 'This interview cannot be terminated', log: 'Interview terminated by interviewer' },
  });
  return ok(res, { status: i.status }, 'Interview terminated');
});

/** POST /company/interviews/:id/cancel */
export const cancel = asyncHandler(async (req, res) => {
  const interview = await Interview.findOneAndUpdate(
    scope(req, { _id: req.params.id, status: { $in: ['scheduled', 'in_progress'] } }),
    { $set: { status: 'cancelled' } },
    { new: true },
  );
  if (!interview) throw ApiError.notFound('Interview not found or not cancellable');
  return ok(res, interview, 'Interview cancelled');
});
