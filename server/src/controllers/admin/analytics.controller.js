import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import * as dash from '../../services/analytics.dashboard.service.js';
import { buildAnalyticsExport } from '../../services/export.service.js';

/** Parse a { from, to } query into a safe, inclusive date range (default 30d). */
function parseRange(q) {
  const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());
  const toRaw = q.to ? new Date(q.to) : new Date();
  const until = valid(toRaw) ? toRaw : new Date();
  until.setHours(23, 59, 59, 999);
  const fromRaw = q.from ? new Date(q.from) : new Date(until.getTime() - 30 * 864e5);
  const since = valid(fromRaw) ? fromRaw : new Date(until.getTime() - 30 * 864e5);
  since.setHours(0, 0, 0, 0);
  return { since, until };
}

/** GET /admin/analytics/summary?from&to — business KPIs + funnel + traffic headline. */
export const summary = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  const [business, funnel, traffic] = await Promise.all([
    dash.businessMetrics(since, until),
    dash.conversionFunnel(since, until),
    dash.trafficOverview(since, until),
  ]);
  return ok(res, { range: { from: since, to: until }, business, funnel, traffic });
});

/** GET /admin/analytics/traffic?from&to — full web-analytics breakdowns. */
export const traffic = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  const [overview, breakdowns] = await Promise.all([
    dash.trafficOverview(since, until),
    dash.trafficBreakdowns(since, until),
  ]);
  return ok(res, { range: { from: since, to: until }, overview, ...breakdowns });
});

/** GET /admin/analytics/engagement?from&to — CTA clicks, events, and the conversion funnel. */
export const engagement = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  const [cta, events, funnel] = await Promise.all([
    dash.ctaAnalytics(since, until),
    dash.eventAnalytics(since, until),
    dash.conversionFunnel(since, until),
  ]);
  return ok(res, { range: { from: since, to: until }, cta, events, funnel });
});

/** GET /admin/analytics/geo?from&to&country&region — geo distribution with drill-down. */
export const geo = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  const country = req.query.country ? String(req.query.country).slice(0, 80) : undefined;
  const region = req.query.region ? String(req.query.region).slice(0, 80) : undefined;
  return ok(res, await dash.geoAnalytics(since, until, { country, region }));
});

/** GET /admin/analytics/features?from&to — feature-usage analytics. */
export const features = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  return ok(res, await dash.featureUsage(since, until));
});

/** GET /admin/analytics/journeys?from&to — session journeys + entry/exit pages. */
export const journeys = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  return ok(res, await dash.journeys(since, until, 20));
});

/** GET /admin/analytics/realtime — active visitors + recent page views. */
export const realtime = asyncHandler(async (_req, res) => ok(res, await dash.realtime()));

/** GET /admin/analytics/export?from&to&format=csv|xlsx|pdf */
export const exportReport = asyncHandler(async (req, res) => {
  const { since, until } = parseRange(req.query);
  const format = ['csv', 'xlsx', 'pdf'].includes(req.query.format) ? req.query.format : 'csv';
  const [business, traffic, funnel] = await Promise.all([
    dash.businessMetrics(since, until),
    dash.trafficOverview(since, until),
    dash.conversionFunnel(since, until),
  ]);
  const { buffer, filename, contentType } = await buildAnalyticsExport(format, { business, traffic, funnel, range: { since, until } });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});
