import { Interview } from '../models/Interview.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../utils/query.js';
import { summarizeEvents } from '../services/proctoring.service.js';

/**
 * Proctoring audit endpoints (§12). Role-scoped: company routes set req.companyId
 * (tenant), so results are limited to that company; the super-admin routes leave
 * it unset and see every company (optionally filtered by ?company=).
 */

function scopeFilter(req) {
  const f = {};
  if (req.companyId) f.company = req.companyId;
  else if (req.query.company) f.company = req.query.company;
  return f;
}

/** Compact row for the audit table. */
function shapeSummary(i) {
  return {
    _id: i._id,
    candidate: i.candidate ? { _id: i.candidate._id, name: i.candidate.name, email: i.candidate.email } : null,
    company: i.company ? { _id: i.company._id, name: i.company.name } : null,
    status: i.status,
    startedAt: i.startedAt,
    completedAt: i.completedAt,
    createdAt: i.createdAt,
    fraudScore: i.proctoring?.fraudScore ?? 0,
    riskLevel: i.proctoring?.riskLevel ?? 'safe',
    integrityScore: i.proctoring?.integrityScore ?? 100,
    attentionScore: i.proctoring?.attentionScore ?? null,
    eventCount: i.proctoring?.events?.length ?? 0,
    evidenceCount: i.proctoring?.evidence?.length ?? 0,
    device: i.proctoring?.device ? { browser: i.proctoring.device.browser, os: i.proctoring.device.os, deviceType: i.proctoring.device.deviceType } : null,
    network: i.proctoring?.network ? { country: i.proctoring.network.country, city: i.proctoring.network.city, vpn: i.proctoring.network.vpn } : null,
  };
}

/** GET /(admin|company)/proctoring — list proctored interview sessions. */
export const list = asyncHandler(async (req, res) => {
  const filter = scopeFilter(req);
  if (req.query.riskLevel) filter['proctoring.riskLevel'] = req.query.riskLevel;
  if (req.query.status) filter.status = req.query.status;

  const opts = parseListQuery(req.query, { defaultSort: '-proctoring.fraudScore' });
  const { items, meta } = await paginateQuery(Interview, filter, opts, [
    { path: 'candidate', select: 'name email' },
    { path: 'company', select: 'name' },
  ]);
  return ok(res, items.map(shapeSummary), 'OK', meta);
});

/** GET /(admin|company)/proctoring/stats — KPI + risk distribution. */
export const stats = asyncHandler(async (req, res) => {
  const match = scopeFilter(req);
  const [byRisk, agg] = await Promise.all([
    Interview.aggregate([{ $match: match }, { $group: { _id: '$proctoring.riskLevel', n: { $sum: 1 } } }]),
    Interview.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgFraud: { $avg: '$proctoring.fraudScore' },
          flagged: { $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] } },
          totalEvents: { $sum: { $size: { $ifNull: ['$proctoring.events', []] } } },
        },
      },
    ]),
  ]);
  const risk = { safe: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of byRisk) if (r._id) risk[r._id] = r.n;
  const a = agg[0] || {};
  return ok(res, {
    total: a.total || 0,
    avgFraud: Math.round(a.avgFraud || 0),
    flagged: a.flagged || 0,
    totalEvents: a.totalEvents || 0,
    risk,
  });
});

/** GET /(admin|company)/proctoring/:id — full session detail + evidence + timeline. */
export const detail = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...scopeFilter(req) };
  const doc = await Interview.findOne(filter)
    .populate('candidate', 'name email phone')
    .populate('company', 'name')
    .populate('job', 'title')
    .lean();
  if (!doc) throw ApiError.notFound('Proctoring session not found');
  return ok(res, {
    ...shapeSummary(doc),
    job: doc.job ? { _id: doc.job._id, title: doc.job.title } : null,
    proctoring: doc.proctoring || {},
    eventSummary: summarizeEvents(doc.proctoring?.events || []),
    recordings: doc.recordings,
    durationMinutes: doc.config?.durationMinutes,
  });
});

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /(admin|company)/proctoring/export — CSV of proctoring sessions. */
export const exportCsv = asyncHandler(async (req, res) => {
  const filter = scopeFilter(req);
  if (req.query.riskLevel) filter['proctoring.riskLevel'] = req.query.riskLevel;
  const rows = await Interview.find(filter)
    .sort('-proctoring.fraudScore')
    .limit(20000)
    .populate('candidate', 'name email')
    .populate('company', 'name')
    .lean();

  const cols = [
    ['Candidate', (r) => r.candidate?.name],
    ['Email', (r) => r.candidate?.email],
    ['Company', (r) => r.company?.name],
    ['Status', (r) => r.status],
    ['Fraud score', (r) => r.proctoring?.fraudScore ?? 0],
    ['Risk', (r) => r.proctoring?.riskLevel ?? 'safe'],
    ['Attention', (r) => r.proctoring?.attentionScore ?? ''],
    ['Events', (r) => r.proctoring?.events?.length ?? 0],
    ['Browser', (r) => r.proctoring?.device?.browser],
    ['OS', (r) => r.proctoring?.device?.os],
    ['Country', (r) => r.proctoring?.network?.country],
    ['VPN', (r) => (r.proctoring?.network?.vpn ? 'yes' : 'no')],
    ['Started', (r) => (r.startedAt ? new Date(r.startedAt).toISOString() : '')],
  ];
  const header = cols.map(([h]) => csvCell(h)).join(',');
  const body = rows.map((r) => cols.map(([, get]) => csvCell(get(r))).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="proctoring-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(`\uFEFF${header}\n${body}`);
});
