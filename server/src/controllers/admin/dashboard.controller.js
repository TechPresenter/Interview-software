import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import * as analytics from '../../services/analytics.service.js';
import { Interview } from '../../models/Interview.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';

/** GET /admin/overview — headline KPIs. */
export const overview = asyncHandler(async (_req, res) => {
  const data = await analytics.platformOverview();
  return ok(res, data);
});

/** GET /admin/overview/timeseries?days= — revenue + interviews series. */
export const series = asyncHandler(async (req, res) => {
  const days = Math.min(365, Number(req.query.days) || 30);
  return ok(res, await analytics.timeSeries(days));
});

/** GET /admin/ai/analytics?days= */
export const aiAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(365, Number(req.query.days) || 30);
  return ok(res, await analytics.aiAnalytics(days));
});

/** GET /admin/health */
export const health = asyncHandler(async (_req, res) => ok(res, await analytics.systemHealth()));

/** GET /admin/activity?limit= */
export const activity = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 20);
  return ok(res, await analytics.recentActivity({ limit }));
});

/** GET /admin/recordings — completed interviews across all companies. */
export const recordings = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { defaultSort: '-completedAt' });
  const filter = { status: { $in: ['completed', 'flagged'] } };
  if (req.query.company) filter.company = req.query.company;
  const { items, meta } = await paginateQuery(Interview, filter, opts, [
    { path: 'candidate', select: 'name email' },
    { path: 'job', select: 'title' },
    { path: 'company', select: 'name' },
    { path: 'report', select: 'overallScore recommendation' },
  ]);
  const shaped = items.map((i) => ({
    _id: i._id,
    candidate: i.candidate,
    job: i.job,
    company: i.company,
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

/** GET /admin/recordings/:id — full interview for review (video, transcript, report). */
export const recordingDetail = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate('candidate', 'name email')
    .populate('job', 'title')
    .populate('company', 'name')
    .populate('report')
    .lean();
  if (!interview) throw ApiError.notFound('Interview not found');
  return ok(res, interview);
});
