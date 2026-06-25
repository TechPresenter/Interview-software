import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { Job } from '../../models/Job.js';
import { Candidate } from '../../models/Candidate.js';
import { Interview } from '../../models/Interview.js';
import { Report } from '../../models/Report.js';
import { usageReport } from '../../services/limits.service.js';
import { recentActivity } from '../../services/analytics.service.js';
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
  });
});

const toId = (id) => new mongoose.Types.ObjectId(id);
