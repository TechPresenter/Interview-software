import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { Job } from '../models/Job.js';
import { Interview } from '../models/Interview.js';
import { AiUsage } from '../models/AiUsage.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Plan-limit enforcement. Each company carries a `limits` snapshot (set from its
 * plan). These helpers compare current usage against those limits and throw a
 * 403 when exceeded.
 */

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/** Current usage counters for a company. */
export async function getUsage(companyId) {
  const since = startOfMonth();
  const [activeJobs, interviewsThisMonth, aiAgg] = await Promise.all([
    Job.countDocuments({ company: companyId, status: { $in: ['open', 'paused', 'draft'] } }),
    Interview.countDocuments({ company: companyId, createdAt: { $gte: since } }),
    AiUsage.aggregate([
      { $match: { company: toId(companyId), createdAt: { $gte: since } } },
      { $group: { _id: null, tokens: { $sum: '$totalTokens' } } },
    ]),
  ]);
  return {
    activeJobs,
    interviewsThisMonth,
    aiTokensThisMonth: aiAgg[0]?.tokens || 0,
  };
}

/** Usage + limits + remaining, for display on the company dashboard/billing. */
export async function usageReport(companyId) {
  const company = await Company.findById(companyId).lean();
  const usage = await getUsage(companyId);
  const limits = company?.limits || {};
  return {
    limits,
    usage,
    remaining: {
      activeJobs: nullableRemaining(limits.activeJobs, usage.activeJobs),
      interviews: nullableRemaining(limits.interviewsPerMonth, usage.interviewsThisMonth),
      aiTokens: nullableRemaining(limits.aiTokensPerMonth, usage.aiTokensThisMonth),
    },
  };
}

/**
 * Assert the company has headroom for `resource`. Throws 403 if at/over limit.
 * @param {string} companyId
 * @param {'activeJobs'|'interviews'} resource
 */
export async function assertWithinLimit(companyId, resource) {
  const company = await Company.findById(companyId).lean();
  if (!company) throw ApiError.notFound('Company not found');
  const usage = await getUsage(companyId);

  if (resource === 'activeJobs') {
    if (usage.activeJobs >= company.limits.activeJobs) {
      throw ApiError.forbidden(`Active job limit reached (${company.limits.activeJobs}). Upgrade your plan.`, {
        code: 'LIMIT_REACHED',
      });
    }
  } else if (resource === 'interviews') {
    if (usage.interviewsThisMonth >= company.limits.interviewsPerMonth) {
      throw ApiError.forbidden(
        `Monthly interview limit reached (${company.limits.interviewsPerMonth}). Upgrade your plan.`,
        { code: 'LIMIT_REACHED' },
      );
    }
  }
}

const nullableRemaining = (limit, used) => (limit == null ? null : Math.max(0, limit - used));
const toId = (id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id);
