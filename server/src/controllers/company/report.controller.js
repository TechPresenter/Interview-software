import { Report } from '../../models/Report.js';
import { Candidate } from '../../models/Candidate.js';
import { Job } from '../../models/Job.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { reportToPdf, rankingToExcel } from '../../services/export.service.js';

const scope = (req, extra = {}) => ({ company: req.companyId, ...extra });

/** GET /company/reports */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { defaultSort: '-overallScore' });
  const filter = scope(req, opts.filter);
  if (req.query.job) filter.job = req.query.job;
  if (req.query.recommendation) filter.recommendation = req.query.recommendation;
  const { items, meta } = await paginateQuery(Report, filter, opts, [
    { path: 'candidate', select: 'name email' },
    { path: 'job', select: 'title' },
  ]);
  return ok(res, items, 'OK', meta);
});

/** GET /company/reports/:id */
export const getOne = asyncHandler(async (req, res) => {
  const report = await Report.findOne(scope(req, { _id: req.params.id }))
    .populate('candidate', 'name email')
    .populate('job', 'title')
    .populate('interview', 'transcript proctoring types completedAt')
    .lean();
  if (!report) throw ApiError.notFound('Report not found');
  return ok(res, report);
});

/** GET /company/reports/ranking?job= — candidates ranked by overall score. */
export const ranking = asyncHandler(async (req, res) => {
  const filter = scope(req);
  if (req.query.job) filter.job = req.query.job;
  const reports = await Report.find(filter)
    .sort('-overallScore')
    .populate('candidate', 'name email')
    .lean();
  const rows = reports.map((r) => ({ candidate: r.candidate, report: r }));
  return ok(res, rows);
});

/** GET /company/reports/analytics — hiring funnel + score distribution. */
export const analytics = asyncHandler(async (req, res) => {
  const filter = scope(req);
  const [byRecommendation, scoreBuckets] = await Promise.all([
    Report.aggregate([{ $match: { company: req.companyId } }, { $group: { _id: '$recommendation', count: { $sum: 1 } } }]),
    Report.aggregate([
      { $match: { company: req.companyId } },
      {
        $bucket: {
          groupBy: '$overallScore',
          boundaries: [0, 50, 70, 85, 101],
          default: 'unknown',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
  ]);
  return ok(res, { byRecommendation, scoreBuckets });
});

/** GET /company/reports/:id/export?format=pdf — download a single report. */
export const exportReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne(scope(req, { _id: req.params.id }))
    .populate('candidate', 'name email')
    .populate('job', 'title')
    .lean();
  if (!report) throw ApiError.notFound('Report not found');

  const { buffer, filename, contentType } = await reportToPdf({
    report,
    candidate: report.candidate,
    job: report.job,
  });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

/** GET /company/reports/ranking/export?job= — download ranking as Excel. */
export const exportRanking = asyncHandler(async (req, res) => {
  const filter = scope(req);
  if (req.query.job) filter.job = req.query.job;
  const reports = await Report.find(filter).sort('-overallScore').populate('candidate', 'name email').lean();
  const rows = reports.map((r) => ({ candidate: r.candidate, report: r }));

  let jobTitle = 'all';
  if (req.query.job) {
    const job = await Job.findById(req.query.job).select('title').lean();
    jobTitle = job?.title || 'job';
  }

  const { buffer, filename, contentType } = await rankingToExcel({ rows, jobTitle });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});
