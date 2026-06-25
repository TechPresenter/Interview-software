import { Interview } from '../../models/Interview.js';
import { Candidate } from '../../models/Candidate.js';
import { Job } from '../../models/Job.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { scheduleInterview, sendInvite, interviewLink } from '../../services/interview.service.js';

const scope = (req, extra = {}) => ({ company: req.companyId, ...extra });

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
