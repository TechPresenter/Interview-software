import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { Job } from '../models/Job.js';
import { Interview } from '../models/Interview.js';
import { AiUsage } from '../models/AiUsage.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { COMPANY_ROLES } from '../constants/enums.js';

/**
 * Plan-limit enforcement. Each company carries a `limits` snapshot (set from its
 * plan). These helpers compare current usage against those limits and throw a
 * 403 when exceeded.
 */

/**
 * Maps each field of `Plan.limits` to the `assertWithinLimit` resource that
 * enforces it. Every limit a plan sells must appear here — a limit with no
 * enforcement is a number on a pricing page and nothing more, which is what
 * `seats` and `aiTokensPerMonth` were. test/plan.defaults.test.js asserts the
 * mapping stays total, so adding a limit without a check fails the build.
 */
export const ENFORCED_BY_LIMIT_KEY = Object.freeze({
  activeJobs: 'activeJobs',
  interviewsPerMonth: 'interviews',
  seats: 'seats',
  aiTokensPerMonth: 'aiTokens',
});

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/** Current usage counters for a company. */
export async function getUsage(companyId) {
  const since = startOfMonth();
  const [activeJobs, interviewsThisMonth, interviewsTotal, aiAgg, seats] = await Promise.all([
    Job.countDocuments({ company: companyId, status: { $in: ['open', 'paused', 'draft'] } }),
    Interview.countDocuments({ company: companyId, createdAt: { $gte: since } }),
    Interview.countDocuments({ company: companyId }), // all-time (Free plan is one-time)
    AiUsage.aggregate([
      { $match: { company: toId(companyId), createdAt: { $gte: since } } },
      { $group: { _id: null, tokens: { $sum: '$totalTokens' } } },
    ]),
    // Staff occupy seats; candidates are not workspace members.
    User.countDocuments({ company: companyId, role: { $in: COMPANY_ROLES }, isActive: true }),
  ]);
  return {
    activeJobs,
    interviewsThisMonth,
    interviewsTotal,
    aiTokensThisMonth: aiAgg[0]?.tokens || 0,
    seats,
  };
}

/** Usage + limits + remaining, for display on the company dashboard/billing. */
export async function usageReport(companyId) {
  const company = await Company.findById(companyId).lean();
  const usage = await getUsage(companyId);
  const limits = company?.limits || {};
  const isFree = (company?.plan || 'free') === 'free';
  const interviewsUsed = isFree ? usage.interviewsTotal : usage.interviewsThisMonth;
  return {
    limits,
    usage: { ...usage, interviewsUsed },
    remaining: {
      activeJobs: nullableRemaining(limits.activeJobs, usage.activeJobs),
      interviews: nullableRemaining(limits.interviewsPerMonth, interviewsUsed),
      aiTokens: nullableRemaining(limits.aiTokensPerMonth, usage.aiTokensThisMonth),
      seats: nullableRemaining(limits.seats, usage.seats),
    },
  };
}

/**
 * Assert the company has headroom for `resource`. Throws 403 if at/over limit.
 *
 * Every limit a plan advertises MUST have a branch here. `seats` and `aiTokens`
 * were carried on the plan, snapshotted onto the company and rendered on the
 * pricing page for a long time while nothing checked them — an advertised limit
 * that is not enforced is a promise in the wrong direction, and it is the reason
 * plans could not honestly differ by "users" or "AI credits".
 *
 * @param {string} companyId
 * @param {'activeJobs'|'interviews'|'seats'|'aiTokens'} resource
 */
export async function assertWithinLimit(companyId, resource) {
  const company = await Company.findById(companyId).lean();
  if (!company) throw ApiError.notFound('Company not found');
  const usage = await getUsage(companyId);

  if (resource === 'seats') {
    const limit = company.limits?.seats;
    if (limit != null && usage.seats >= limit) {
      throw ApiError.forbidden(`Team member limit reached (${limit}). Upgrade your plan to add more.`, {
        code: 'LIMIT_REACHED',
      });
    }
  } else if (resource === 'aiTokens') {
    // Checked when scheduling, never mid-interview: stranding a candidate
    // half-way through because the workspace ran out of budget is not a failure
    // mode worth having. In-flight interviews always finish.
    const limit = company.limits?.aiTokensPerMonth;
    if (limit != null && usage.aiTokensThisMonth >= limit) {
      throw ApiError.forbidden('Monthly AI usage limit reached. Upgrade your plan to schedule more interviews.', {
        code: 'LIMIT_REACHED',
      });
    }
  } else if (resource === 'activeJobs') {
    if (usage.activeJobs >= company.limits.activeJobs) {
      throw ApiError.forbidden(`Active job limit reached (${company.limits.activeJobs}). Upgrade your plan.`, {
        code: 'LIMIT_REACHED',
      });
    }
  } else if (resource === 'interviews') {
    // Free plan interviews are a ONE-TIME allowance (all-time total); paid plans
    // reset monthly.
    const isFree = (company.plan || 'free') === 'free';
    const used = isFree ? usage.interviewsTotal : usage.interviewsThisMonth;
    const limit = company.limits.interviewsPerMonth;
    if (used >= limit) {
      throw ApiError.forbidden(
        isFree
          ? `You've used all ${limit} free interviews. Upgrade your plan for more.`
          : `Monthly interview limit reached (${limit}). Upgrade your plan.`,
        { code: 'LIMIT_REACHED' },
      );
    }
  }
}

const nullableRemaining = (limit, used) => (limit == null ? null : Math.max(0, limit - used));
const toId = (id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id);
