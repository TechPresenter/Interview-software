import os from 'node:os';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { Interview } from '../models/Interview.js';
import { Candidate } from '../models/Candidate.js';
import { Payment } from '../models/Payment.js';
import { Subscription } from '../models/Subscription.js';
import { AiUsage } from '../models/AiUsage.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { redis } from '../config/redis.js';
import { ROLES } from '../constants/enums.js';

/**
 * Aggregations powering the super-admin dashboard: platform KPIs, revenue,
 * AI usage, system health, and the live activity feed.
 */

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Headline counters + period deltas. */
export async function platformOverview() {
  const [companies, candidates, interviews, completed, activeSubs] = await Promise.all([
    Company.countDocuments(),
    User.countDocuments({ role: ROLES.CANDIDATE }),
    Interview.countDocuments(),
    Interview.countDocuments({ status: 'completed' }),
    Subscription.countDocuments({ status: 'active' }),
  ]);

  // MRR from active paid subscriptions (normalize yearly → monthly).
  const mrrAgg = await Subscription.aggregate([
    { $match: { status: 'active', amount: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        mrr: {
          $sum: { $cond: [{ $eq: ['$billingCycle', 'yearly'] }, { $divide: ['$amount', 12] }, '$amount'] },
        },
      },
    },
  ]);

  const newCompanies7d = await Company.countDocuments({ createdAt: { $gte: daysAgo(7) } });
  const interviews7d = await Interview.countDocuments({ createdAt: { $gte: daysAgo(7) } });

  return {
    totalCompanies: companies,
    totalCandidates: candidates,
    totalInterviews: interviews,
    completedInterviews: completed,
    activeSubscriptions: activeSubs,
    mrr: Math.round((mrrAgg[0]?.mrr || 0)),
    newCompanies7d,
    interviews7d,
  };
}

/** Revenue + interview time series for charts (last `days` days). */
export async function timeSeries(days = 30) {
  const since = daysAgo(days);
  const fmt = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

  const [revenue, interviews] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: since } } },
      { $group: { _id: fmt, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Interview.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: fmt, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return { revenue, interviews };
}

/** AI usage analytics: tokens + cost by feature and over time. */
export async function aiAnalytics(days = 30) {
  const since = daysAgo(days);
  const [byFeature, totals, daily] = await Promise.all([
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$feature',
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$costUsd' },
          calls: { $sum: 1 },
        },
      },
    ]),
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$costUsd' },
          calls: { $sum: 1 },
          failures: { $sum: { $cond: ['$success', 0, 1] } },
        },
      },
    ]),
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$costUsd' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return { byFeature, totals: totals[0] || { tokens: 0, cost: 0, calls: 0, failures: 0 }, daily };
}

/** Liveness/health snapshot for the system-health card. */
export async function systemHealth() {
  const dbState = mongoose.connection.readyState; // 1 = connected
  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  const mem = process.memoryUsage();
  return {
    db: dbState === 1 ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
    uptimeSeconds: Math.round(process.uptime()),
    memory: { rssMb: Math.round(mem.rss / 1e6), heapMb: Math.round(mem.heapUsed / 1e6) },
    load: os.loadavg?.()[0] ?? null,
    node: process.version,
  };
}

/** Recent activity feed (optionally company-scoped). */
export async function recentActivity({ company, limit = 20 } = {}) {
  const filter = company ? { company } : {};
  return ActivityLog.find(filter)
    .sort('-createdAt')
    .limit(limit)
    .populate('actor', 'name email role')
    .lean();
}

/** Per-company analytics (for the company detail page). */
export async function companyAnalytics(companyId) {
  const [staff, candidates, interviews, completed, aiCost] = await Promise.all([
    User.countDocuments({ company: companyId }),
    Candidate.countDocuments({ company: companyId }),
    Interview.countDocuments({ company: companyId }),
    Interview.countDocuments({ company: companyId, status: 'completed' }),
    AiUsage.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: null, cost: { $sum: '$costUsd' }, tokens: { $sum: '$totalTokens' } } },
    ]),
  ]);
  return {
    staff,
    candidates,
    interviews,
    completedInterviews: completed,
    aiCost: aiCost[0]?.cost || 0,
    aiTokens: aiCost[0]?.tokens || 0,
  };
}
