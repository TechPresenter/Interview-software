import { toId } from '../../utils/ids.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { Job } from '../../models/Job.js';
import { Candidate } from '../../models/Candidate.js';
import { Interview } from '../../models/Interview.js';
import { Report } from '../../models/Report.js';
import { Company } from '../../models/Company.js';
import { usageReport } from '../../services/limits.service.js';
import { recentActivity } from '../../services/analytics.service.js';
import { saveBuffer } from '../../services/file.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { PIPELINE_STAGES } from '../../constants/enums.js';

/** GET /company/overview — company dashboard KPIs + funnel + usage. */
export const overview = asyncHandler(async (req, res) => {
  const company = req.companyId;

  const [activeJobs, totalCandidates, scheduled, completed, avgAgg, funnelAgg, usage, activity] =
    await Promise.all([
      Job.countDocuments({ company, status: 'open' }),
      Candidate.countDocuments({ company }),
      Interview.countDocuments({ company, status: 'scheduled' }),
      Interview.countDocuments({ company, status: 'completed' }),
      Report.aggregate([
        { $match: { company: toId(company) } },
        { $group: { _id: null, avg: { $avg: '$overallScore' } } },
      ]),
      Candidate.aggregate([
        { $match: { company: toId(company) } },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ]),
      usageReport(company),
      recentActivity({ company, limit: 8 }),
    ]);

  // Normalize the funnel to include every stage (zero-filled).
  const funnelMap = Object.fromEntries(funnelAgg.map((f) => [f._id, f.count]));
  const funnel = PIPELINE_STAGES.map((stage) => ({ stage, count: funnelMap[stage] || 0 }));

  // Onboarding checklist — derived from real company state.
  const [totalJobs, companyDoc] = await Promise.all([Job.countDocuments({ company }), Company.findById(company).lean()]);
  const steps = [
    { key: 'job', label: 'Create your first job', done: totalJobs > 0, href: '/dashboard/jobs' },
    { key: 'candidate', label: 'Add a candidate', done: totalCandidates > 0, href: '/dashboard/candidates' },
    { key: 'interview', label: 'Schedule an interview', done: scheduled + completed > 0, href: '/dashboard/interviews' },
    { key: 'completed', label: 'Run an AI interview to completion', done: completed > 0, href: '/dashboard/reports' },
    { key: 'plan', label: 'Choose a subscription plan', done: Boolean(companyDoc?.plan && companyDoc.plan !== 'free'), href: '/dashboard/billing' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const onboarding = { steps, done: doneCount, total: steps.length, progress: Math.round((doneCount / steps.length) * 100), complete: doneCount === steps.length };

  return ok(res, {
    kpis: {
      activeJobs,
      totalCandidates,
      interviewsScheduled: scheduled,
      interviewsCompleted: completed,
      avgScore: Math.round(avgAgg[0]?.avg || 0),
    },
    funnel,
    usage,
    activity,
    onboarding,
  });
});

/* ── Custom AI interviewer (candidate-facing) ──────────── */

/** GET /company/ai-interviewer */
export const getInterviewer = asyncHandler(async (req, res) => {
  const c = await Company.findById(req.companyId).select('aiInterviewer').lean();
  return ok(res, c?.aiInterviewer || { name: 'Sense', voice: 'female' });
});

/** PUT /company/ai-interviewer */
export const updateInterviewer = asyncHandler(async (req, res) => {
  const patch = {};
  for (const f of ['name', 'voice', 'intro']) if (req.body[f] !== undefined) patch[`aiInterviewer.${f}`] = req.body[f];
  const c = await Company.findByIdAndUpdate(req.companyId, { $set: patch }, { new: true }).select('aiInterviewer');
  return ok(res, c.aiInterviewer, 'AI interviewer updated');
});

/** POST /company/ai-interviewer/avatar */
export const uploadInterviewerAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded');
  const { url } = await saveBuffer(req.file.buffer, req.file.originalname);
  const c = await Company.findByIdAndUpdate(req.companyId, { $set: { 'aiInterviewer.avatarUrl': url } }, { new: true }).select('aiInterviewer');
  return ok(res, c.aiInterviewer, 'Avatar updated');
});

