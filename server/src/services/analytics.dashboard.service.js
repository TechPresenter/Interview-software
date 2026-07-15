import { PageView } from '../models/PageView.js';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { Payment } from '../models/Payment.js';
import { AiUsage } from '../models/AiUsage.js';
import { EmailLog } from '../models/EmailLog.js';
import { Notification } from '../models/Notification.js';
import { Lead } from '../models/Lead.js';
import { DemoBooking } from '../models/DemoBooking.js';
import { BlogPost } from '../models/BlogPost.js';
import { redis } from '../config/redis.js';
import { ROLES } from '../constants/enums.js';

/**
 * Aggregations for the admin Analytics dashboard: first-party web traffic
 * (page views / sessions / sources / geo / devices) plus business metrics
 * (users, subscriptions, revenue, AI, email) over a custom date range.
 */

const ACTIVE_KEY = 'analytics:active';
const dayFmt = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

/* ── Ingestion ─────────────────────────────────────────── */

const SEARCH_HOSTS = /google\.|bing\.|duckduckgo\.|yahoo\.|yandex\.|baidu\./i;
const SOCIAL_HOSTS = /facebook\.|instagram\.|t\.co|twitter\.|x\.com|linkedin\.|reddit\.|youtube\.|pinterest\.|tiktok\./i;

/** Best-effort IP → geo. Prefers proxy headers; falls back to a cached ipwho.is lookup. */
async function geoFromRequest(req) {
  const h = req.headers || {};
  const hdrCountry = h['cf-ipcountry'] || h['x-vercel-ip-country'];
  if (hdrCountry && hdrCountry !== 'XX') {
    return {
      country: String(hdrCountry),
      region: h['x-vercel-ip-country-region'] ? String(h['x-vercel-ip-country-region']) : '',
      city: h['x-vercel-ip-city'] ? decodeURIComponent(String(h['x-vercel-ip-city'])) : '',
    };
  }
  const ip = String(h['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return {};
  const cacheKey = `geo:${ip}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`https://ipwho.is/${ip}?fields=success,country,region,city`, { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await r.json();
    const geo = j?.success ? { country: j.country || '', region: j.region || '', city: j.city || '' } : {};
    await redis.set(cacheKey, JSON.stringify(geo), 'EX', 86400);
    return geo;
  } catch {
    return {};
  }
}

/** Classify traffic source from UTM params / referrer. */
function deriveSource(body, referrer) {
  if (body.utmSource) return { source: body.utmSource, medium: body.utmMedium || 'campaign', campaign: body.utmCampaign || '' };
  if (!referrer) return { source: 'direct', medium: 'direct', campaign: '' };
  let host = '';
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch { host = ''; }
  if (!host) return { source: 'direct', medium: 'direct', campaign: '' };
  if (SEARCH_HOSTS.test(host)) return { source: host, medium: 'organic', campaign: '' };
  if (SOCIAL_HOSTS.test(host)) return { source: host, medium: 'social', campaign: '' };
  return { source: host, medium: 'referral', campaign: '' };
}

/** Record a page view from the public beacon. Never throws to the caller. */
export async function ingestPageView(req) {
  try {
    const b = req.body || {};
    if (!b.path || !b.visitorId) return;
    const referrer = typeof b.referrer === 'string' ? b.referrer : '';
    const { source, medium, campaign } = deriveSource(b, referrer);
    const geo = await geoFromRequest(req);

    await PageView.create({
      visitorId: String(b.visitorId).slice(0, 64),
      sessionId: String(b.sessionId || b.visitorId).slice(0, 64),
      path: String(b.path).slice(0, 300),
      referrer: referrer.slice(0, 300),
      source, medium, campaign: String(campaign || '').slice(0, 120),
      device: ['desktop', 'mobile', 'tablet'].includes(b.device) ? b.device : 'other',
      os: String(b.os || '').slice(0, 40),
      browser: String(b.browser || '').slice(0, 40),
      country: geo.country || '', region: geo.region || '', city: geo.city || '',
      isNewVisitor: Boolean(b.isNewVisitor),
    });

    await redis.zadd(ACTIVE_KEY, Date.now(), String(b.visitorId));
    await redis.expire(ACTIVE_KEY, 900);
  } catch {
    /* analytics must never break a page load */
  }
}

/** Record a generic analytics event (CTA click, feature use, custom, …). Never throws. */
export async function ingestEvent(req) {
  try {
    const b = req.body || {};
    if (!b.name || !b.visitorId) return;
    const referrer = typeof b.referrer === 'string' ? b.referrer : '';
    const { source, medium } = deriveSource(b, referrer);
    const geo = await geoFromRequest(req);
    const props = b.props && typeof b.props === 'object' ? b.props : {};

    await AnalyticsEvent.create({
      name: String(b.name).slice(0, 80),
      category: String(b.category || 'event').slice(0, 40),
      visitorId: String(b.visitorId).slice(0, 64),
      sessionId: String(b.sessionId || b.visitorId).slice(0, 64),
      user: req.user?._id, // set only when the beacon happens to be authenticated
      path: String(b.path || '').slice(0, 300),
      referrer: referrer.slice(0, 300),
      source, medium,
      device: ['desktop', 'mobile', 'tablet'].includes(b.device) ? b.device : 'other',
      os: String(b.os || '').slice(0, 40),
      browser: String(b.browser || '').slice(0, 40),
      country: geo.country || '', region: geo.region || '', city: geo.city || '',
      props,
      value: typeof b.value === 'number' ? b.value : undefined,
    });

    await redis.zadd(ACTIVE_KEY, Date.now(), String(b.visitorId));
    await redis.expire(ACTIVE_KEY, 900);
  } catch {
    /* analytics must never break the app */
  }
}

/* ── Web traffic aggregations ──────────────────────────── */

export async function trafficOverview(since, until) {
  const match = { createdAt: { $gte: since, $lte: until } };
  const [sessionAgg, visitors] = await Promise.all([
    PageView.aggregate([
      { $match: match },
      { $group: { _id: '$sessionId', views: { $sum: 1 }, first: { $min: '$createdAt' }, last: { $max: '$createdAt' } } },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          bounces: { $sum: { $cond: [{ $eq: ['$views', 1] }, 1, 0] } },
          durMs: { $sum: { $subtract: ['$last', '$first'] } },
          pageviews: { $sum: '$views' },
        },
      },
    ]),
    PageView.distinct('visitorId', match),
  ]);
  const a = sessionAgg[0] || { sessions: 0, bounces: 0, durMs: 0, pageviews: 0 };
  return {
    pageviews: a.pageviews,
    sessions: a.sessions,
    visitors: visitors.length,
    bounceRate: a.sessions ? Math.round((a.bounces / a.sessions) * 100) : 0,
    avgSessionSeconds: a.sessions ? Math.round(a.durMs / a.sessions / 1000) : 0,
  };
}

const groupTop = (match, field, limit = 8) =>
  PageView.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ''] } } },
    { $group: { _id: `$${field}`, value: { $sum: 1 } } },
    { $sort: { value: -1 } },
    { $limit: limit },
  ]).then((r) => r.map((x) => ({ label: x._id, value: x.value })));

export async function trafficBreakdowns(since, until) {
  const match = { createdAt: { $gte: since, $lte: until } };
  const [series, topPages, sources, mediums, devices, browsers, os, countries, referrers, campaigns, heatmap] = await Promise.all([
    PageView.aggregate([
      { $match: match },
      { $group: { _id: dayFmt, pageviews: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
      { $project: { pageviews: 1, sessions: { $size: '$sessions' } } },
      { $sort: { _id: 1 } },
    ]),
    groupTop(match, 'path', 8),
    groupTop(match, 'source', 8),
    groupTop(match, 'medium', 6),
    groupTop(match, 'device', 4),
    groupTop(match, 'browser', 6),
    groupTop(match, 'os', 6),
    groupTop(match, 'country', 10),
    groupTop(match, 'referrer', 8),
    groupTop(match, 'campaign', 8),
    PageView.aggregate([
      { $match: match },
      { $group: { _id: { dow: { $dayOfWeek: '$createdAt' }, hour: { $hour: '$createdAt' } }, value: { $sum: 1 } } },
    ]),
  ]);
  return {
    series: series.map((d) => ({ label: d._id, pageviews: d.pageviews, sessions: d.sessions })),
    topPages, sources, mediums, devices, browsers, os, countries, referrers, campaigns,
    heatmap: heatmap.map((h) => ({ dow: h._id.dow, hour: h._id.hour, value: h.value })),
  };
}

/** Active visitors in the last 5 minutes (from the Redis sorted set). */
export async function realtime() {
  const cutoff = Date.now() - 5 * 60_000;
  try {
    await redis.zremrangebyscore(ACTIVE_KEY, 0, cutoff);
    const active = await redis.zcard(ACTIVE_KEY);
    const recent = await PageView.find().sort('-createdAt').limit(8).select('path country device createdAt').lean();
    return { active, recent };
  } catch {
    return { active: 0, recent: [] };
  }
}

/* ── Business aggregations ─────────────────────────────── */

export async function businessMetrics(since, until) {
  const now = new Date();
  const dayAgo = new Date(now - 864e5);
  const weekAgo = new Date(now - 7 * 864e5);
  const monthAgo = new Date(now - 30 * 864e5);

  const [
    totalUsers, newUsers, dau, wau, mau, registrations,
    subsByStatus, mrrAgg, churned, revenueSeries,
    aiTotals, emailAgg, notifications, enquiries, newsletter, demos, blogAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: since, $lte: until } }),
    User.countDocuments({ lastLoginAt: { $gte: dayAgo } }),
    User.countDocuments({ lastLoginAt: { $gte: weekAgo } }),
    User.countDocuments({ lastLoginAt: { $gte: monthAgo } }),
    User.aggregate([
      { $match: { createdAt: { $gte: since, $lte: until } } },
      { $group: { _id: dayFmt, value: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Subscription.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Subscription.aggregate([
      { $match: { status: 'active', amount: { $gt: 0 } } },
      { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: ['$billingCycle', 'yearly'] }, { $divide: ['$amount', 12] }, '$amount'] } } } },
    ]),
    Subscription.countDocuments({ canceledAt: { $gte: since, $lte: until } }),
    Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: since, $lte: until } } },
      { $group: { _id: dayFmt, value: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since, $lte: until } } },
      { $group: { _id: null, tokens: { $sum: '$totalTokens' }, cost: { $sum: '$costUsd' }, calls: { $sum: 1 } } },
    ]),
    EmailLog.aggregate([
      { $match: { createdAt: { $gte: since, $lte: until } } },
      { $group: { _id: null, sent: { $sum: 1 }, opened: { $sum: { $cond: [{ $gt: ['$openCount', 0] }, 1, 0] } }, clicked: { $sum: { $cond: [{ $gt: ['$clickCount', 0] }, 1, 0] } } } },
    ]),
    Notification.countDocuments({ createdAt: { $gte: since, $lte: until } }),
    Lead.countDocuments({ type: 'contact', createdAt: { $gte: since, $lte: until } }),
    Lead.countDocuments({ type: 'newsletter', createdAt: { $gte: since, $lte: until } }),
    DemoBooking.countDocuments({ createdAt: { $gte: since, $lte: until } }),
    BlogPost.aggregate([{ $group: { _id: null, views: { $sum: '$views' }, posts: { $sum: 1 } } }]),
  ]);

  const statusMap = Object.fromEntries(subsByStatus.map((s) => [s._id, s.n]));
  const paid = statusMap.active || 0;
  const trialing = statusMap.trialing || 0;
  const mrr = Math.round(mrrAgg[0]?.mrr || 0); // paise (minor units); client divides by 100 at display
  const churnBase = paid + churned;
  const email = emailAgg[0] || { sent: 0, opened: 0, clicked: 0 };

  return {
    users: { total: totalUsers, new: newUsers, dau, wau, mau },
    registrations: registrations.map((r) => ({ label: r._id, value: r.value })),
    subscriptions: { paid, trialing, pastDue: statusMap.past_due || 0, canceled: statusMap.canceled || 0 },
    revenue: {
      mrr, arr: mrr * 12,
      churnRate: churnBase ? Math.round((churned / churnBase) * 100) : 0,
      series: revenueSeries.map((r) => ({ label: r._id, value: r.value })), // paise
    },
    ai: aiTotals[0] || { tokens: 0, cost: 0, calls: 0 },
    email: { ...email, openRate: email.sent ? Math.round((email.opened / email.sent) * 100) : 0 },
    notifications,
    enquiries, newsletter, demos,
    blog: blogAgg[0] || { views: 0, posts: 0 },
  };
}

/** Acquisition → activation → revenue funnel (6 steps) for the given window. */
export async function conversionFunnel(since, until) {
  const range = { createdAt: { $gte: since, $lte: until } };
  const subRange = { createdAt: { $gte: since, $lte: until } };
  const [visitors, signups, verified, loggedIn, trials, paid] = await Promise.all([
    PageView.distinct('visitorId', range).then((v) => v.length),
    User.countDocuments(range),
    User.countDocuments({ ...range, isEmailVerified: true }),
    User.countDocuments({ ...range, lastLoginAt: { $ne: null } }),
    Subscription.countDocuments({ status: { $in: ['trialing', 'active'] }, ...subRange }),
    Subscription.countDocuments({ status: 'active', amount: { $gt: 0 }, ...subRange }),
  ]);
  return [
    { label: 'Visitors', value: visitors },
    { label: 'Sign-ups', value: signups },
    { label: 'Email verified', value: verified },
    { label: 'Logged in', value: loggedIn },
    { label: 'Free trial', value: trials },
    { label: 'Paid plan', value: paid },
  ];
}

/* ── Event / CTA aggregations ──────────────────────────── */

const eventGroupTop = (match, field, limit = 8) =>
  AnalyticsEvent.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ''] } } },
    { $group: { _id: `$${field}`, value: { $sum: 1 } } },
    { $sort: { value: -1 } },
    { $limit: limit },
  ]).then((r) => r.map((x) => ({ label: x._id, value: x.value })));

/** CTA click analytics: per-CTA clicks + unique clickers + CTR + breakdowns + trend. */
export async function ctaAnalytics(since, until) {
  const match = { category: 'cta', createdAt: { $gte: since, $lte: until } };
  const [byCta, totals, uniqueVisitors, devices, sources, countries, trend] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: '$name', clicks: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $project: { clicks: 1, unique: { $size: '$visitors' } } },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]),
    AnalyticsEvent.countDocuments(match),
    PageView.distinct('visitorId', { createdAt: { $gte: since, $lte: until } }).then((v) => v.length),
    eventGroupTop(match, 'device', 4),
    eventGroupTop(match, 'source', 6),
    eventGroupTop(match, 'country', 8),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: dayFmt, value: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return {
    byCta: byCta.map((c) => ({
      name: c._id,
      clicks: c.clicks,
      unique: c.unique,
      ctr: uniqueVisitors ? Math.round((c.unique / uniqueVisitors) * 1000) / 10 : 0,
    })),
    totals: { clicks: totals, uniqueVisitors },
    devices, sources, countries,
    trend: trend.map((d) => ({ label: d._id, value: d.value })),
  };
}

/** Generic event analytics: totals by category + top events + recent stream + trend. */
export async function eventAnalytics(since, until) {
  const match = { createdAt: { $gte: since, $lte: until } };
  const [byCategory, topEvents, recent, trend] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: '$category', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: { name: '$name', category: '$category' }, value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 12 },
    ]),
    AnalyticsEvent.find(match).sort('-createdAt').limit(12).select('name category path device country createdAt').lean(),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: dayFmt, value: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return {
    total: byCategory.reduce((s, c) => s + c.value, 0),
    byCategory: byCategory.map((c) => ({ label: c._id, value: c.value })),
    topEvents: topEvents.map((e) => ({ name: e._id.name, category: e._id.category, value: e.value })),
    recent,
    trend: trend.map((d) => ({ label: d._id, value: d.value })),
  };
}

/**
 * Geographic analytics with Country → State/region → City drill-down.
 * No filter → group by country (world map). `country` → group by region (state
 * map). `country` + `region` → group by city. Each row carries visitors,
 * sessions, page views and new visitors.
 */
export async function geoAnalytics(since, until, { country, region } = {}) {
  const match = { createdAt: { $gte: since, $lte: until } };
  let field = 'country';
  if (country) { match.country = country; field = 'region'; }
  if (country && region) { match.region = region; field = 'city'; }

  const rows = await PageView.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ''] } } },
    {
      $group: {
        _id: `$${field}`,
        pageviews: { $sum: 1 },
        sessions: { $addToSet: '$sessionId' },
        visitors: { $addToSet: '$visitorId' },
        newVisitors: { $sum: { $cond: ['$isNewVisitor', 1, 0] } },
      },
    },
    { $project: { pageviews: 1, newVisitors: 1, sessions: { $size: '$sessions' }, visitors: { $size: '$visitors' } } },
    { $sort: { visitors: -1 } },
    { $limit: 400 },
  ]);

  return {
    level: field === 'country' ? 'country' : field === 'region' ? 'region' : 'city',
    filter: { country: country || null, region: region || null },
    rows: rows.map((r) => ({
      name: r._id,
      visitors: r.visitors,
      sessions: r.sessions,
      pageviews: r.pageviews,
      newVisitors: r.newVisitors,
      returningVisitors: Math.max(0, r.visitors - r.newVisitors),
    })),
  };
}

/**
 * Feature-usage analytics from `category: 'feature'` events. Any feature
 * instrumented with `trackFeature(name)` shows up here automatically — no
 * schema or query changes needed.
 */
export async function featureUsage(since, until) {
  const match = { category: 'feature', createdAt: { $gte: since, $lte: until } };
  const [byFeature, totals, trend, visitors] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: '$name', uses: { $sum: 1 }, users: { $addToSet: '$visitorId' }, last: { $max: '$createdAt' } } },
      { $project: { uses: 1, last: 1, users: { $size: '$users' } } },
      { $sort: { uses: -1 } },
      { $limit: 30 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: null, uses: { $sum: 1 }, users: { $addToSet: '$visitorId' } } },
      { $project: { uses: 1, users: { $size: '$users' } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: dayFmt, value: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    PageView.distinct('visitorId', { createdAt: { $gte: since, $lte: until } }).then((v) => v.length),
  ]);

  const t = totals[0] || { uses: 0, users: 0 };
  const rows = byFeature.map((f) => ({ name: f._id, uses: f.uses, users: f.users, lastUsedAt: f.last }));
  return {
    totals: {
      uses: t.uses,
      activeUsers: t.users,
      visitors,
      adoptionRate: visitors ? Math.round((t.users / visitors) * 1000) / 10 : 0,
      features: rows.length,
    },
    byFeature: rows,
    mostUsed: rows.slice(0, 5),
    leastUsed: [...rows].reverse().slice(0, 5),
    trend: trend.map((d) => ({ label: d._id, value: d.value })),
  };
}

/**
 * User-journey analytics: per-session entry → navigation path → exit, plus the
 * top entry and exit pages for the window.
 */
export async function journeys(since, until, limit = 20) {
  const match = { createdAt: { $gte: since, $lte: until } };
  const firstLast = (op) => [
    { $match: match },
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$sessionId', path: { [op]: '$path' } } },
    { $group: { _id: '$path', value: { $sum: 1 } } },
    { $sort: { value: -1 } },
    { $limit: 8 },
  ];

  const [sessions, entryPages, exitPages] = await Promise.all([
    PageView.aggregate([
      { $match: match },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$sessionId',
          steps: { $push: '$path' },
          entryPath: { $first: '$path' },
          exitPath: { $last: '$path' },
          start: { $min: '$createdAt' },
          end: { $max: '$createdAt' },
          country: { $first: '$country' },
          device: { $first: '$device' },
          source: { $first: '$source' },
        },
      },
      {
        $project: {
          steps: { $slice: ['$steps', 12] },
          pages: { $size: '$steps' },
          entryPath: 1, exitPath: 1, start: 1, end: 1, country: 1, device: 1, source: 1,
          durationMs: { $subtract: ['$end', '$start'] },
        },
      },
      { $sort: { start: -1 } },
      { $limit: limit },
    ]),
    PageView.aggregate(firstLast('$first')),
    PageView.aggregate(firstLast('$last')),
  ]);

  return {
    sessions: sessions.map((s) => ({
      sessionId: s._id,
      entry: s.entryPath || '—',
      exit: s.exitPath || '—',
      steps: s.steps || [],
      pages: s.pages,
      durationSeconds: Math.max(0, Math.round((s.durationMs || 0) / 1000)),
      country: s.country || '',
      device: s.device || '',
      source: s.source || '',
      startedAt: s.start,
    })),
    entryPages: entryPages.map((e) => ({ label: e._id, value: e.value })),
    exitPages: exitPages.map((e) => ({ label: e._id, value: e.value })),
  };
}

export const ROLE_LABELS = ROLES;
