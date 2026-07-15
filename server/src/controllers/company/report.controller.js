import { Report } from '../../models/Report.js';
import { Job } from '../../models/Job.js';
import { Interview } from '../../models/Interview.js';
import { Answer } from '../../models/Answer.js';
import { Branding } from '../../models/Branding.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { reportToPdf, rankingToExcel } from '../../services/export.service.js';
import { generateReport } from '../../services/ai/report.engine.js';
import { getAiWeightage } from '../../services/settings.service.js';
import { logActivity } from '../../services/audit.service.js';
import { config } from '../../config/index.js';
import { isAiConfigured } from '../../services/ai/ai.status.js';
import { toId } from '../../utils/ids.js';

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

/**
 * POST /company/reports/:id/regenerate — re-run the AI evaluation.
 *
 * Useful after the weightage or prompts change, or when a report was produced
 * while AI was degraded. The transcript is immutable, so this only ever rewrites
 * the evaluation — recruiter notes are preserved.
 */
export const regenerate = asyncHandler(async (req, res) => {
  if (!(await isAiConfigured('report', { company: req.companyId }))) throw ApiError.badRequest('AI is not configured');
  const report = await Report.findOne(scope(req, { _id: req.params.id }));
  if (!report) throw ApiError.notFound('Report not found');

  const [interview, answers, job] = await Promise.all([
    Interview.findById(report.interview).lean(),
    Answer.find({ interview: report.interview }).sort('order').lean(),
    report.job ? Job.findById(report.job).lean() : null,
  ]);
  if (!interview) throw ApiError.notFound('Interview not found');
  if (!answers.length) throw ApiError.badRequest('This interview has no answers to evaluate');

  const weightage = await getAiWeightage();
  const generated = await generateReport({
    job,
    transcript: (interview.transcript || []).map((t) => `${t.role.toUpperCase()}: ${t.text}`).join('\n'),
    evaluations: answers.map((a) => a.evaluation || {}),
    answers,
    integrityScore: interview.proctoring?.integrityScore,
    weightage,
    company: req.companyId,
    interview: interview._id,
    language: req.body?.language || interview.config?.language || 'en',
  });

  // Assign field-by-field so recruiterNotes (human-authored) survive.
  Object.assign(report, generated, { model: config.ai.model, generatedBy: 'ai' });
  await report.save();
  await logActivity({
    company: req.companyId,
    user: req.user._id,
    action: 'report.regenerated',
    entityType: 'Report',
    entityId: report._id,
    summary: `Report regenerated for interview ${report.interview}`,
  });
  return ok(res, report, 'Report regenerated');
});

/** POST /company/reports/:id/notes — append a recruiter note. */
export const addNote = asyncHandler(async (req, res) => {
  const note = String(req.body?.note || '').trim();
  if (!note) throw ApiError.badRequest('Note cannot be empty');
  const report = await Report.findOne(scope(req, { _id: req.params.id }));
  if (!report) throw ApiError.notFound('Report not found');

  report.recruiterNotes.push({
    author: req.user._id,
    authorName: req.user.name,
    note: note.slice(0, 4000),
  });
  await report.save();
  return ok(res, report.recruiterNotes, 'Note added');
});

/** DELETE /company/reports/:id/notes/:noteId — remove one's own note. */
export const removeNote = asyncHandler(async (req, res) => {
  const report = await Report.findOne(scope(req, { _id: req.params.id }));
  if (!report) throw ApiError.notFound('Report not found');
  const note = report.recruiterNotes.id(req.params.noteId);
  if (!note) throw ApiError.notFound('Note not found');
  // A recruiter may delete their own note; company admins may delete any.
  if (String(note.author) !== String(req.user._id) && req.user.role !== 'company_admin') {
    throw ApiError.forbidden('You can only delete your own notes');
  }
  note.deleteOne();
  await report.save();
  return ok(res, report.recruiterNotes, 'Note removed');
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
  const [byRecommendation, scoreBuckets] = await Promise.all([
    Report.aggregate([{ $match: { company: toId(req.companyId) } }, { $group: { _id: '$recommendation', count: { $sum: 1 } } }]),
    Report.aggregate([
      { $match: { company: toId(req.companyId) } },
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
    .populate({ path: 'interview', select: 'proctoring.fraudScore proctoring.riskLevel proctoring.integrityScore proctoring.attentionScore proctoring.eyeContactPct' })
    .lean();
  if (!report) throw ApiError.notFound('Report not found');

  const branding = await Branding.getGlobal().catch(() => null);
  const { buffer, filename, contentType } = await reportToPdf({
    report,
    candidate: report.candidate,
    job: report.job,
    branding: branding?.toObject?.() || branding,
    proctoring: report.interview?.proctoring || null,
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
