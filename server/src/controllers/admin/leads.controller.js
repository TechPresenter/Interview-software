import { Lead } from '../../models/Lead.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/** GET /admin/leads — list contact enquiries + newsletter subscribers. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, {
    searchFields: ['name', 'email', 'company', 'subject', 'message'],
    defaultSort: '-createdAt',
  });
  if (req.query.type) opts.filter.type = req.query.type;
  if (req.query.status) opts.filter.status = req.query.status;
  const { items, meta } = await paginateQuery(Lead, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /admin/leads/stats — counts for the dashboard cards. */
export const stats = asyncHandler(async (_req, res) => {
  const [total, contact, newsletter, unread] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ type: 'contact' }),
    Lead.countDocuments({ type: 'newsletter' }),
    Lead.countDocuments({ status: 'new' }),
  ]);
  return ok(res, { total, contact, newsletter, unread });
});

/** PATCH /admin/leads/:id — update status / notes. */
export const update = asyncHandler(async (req, res) => {
  const doc = await Lead.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!doc) throw ApiError.notFound('Lead not found');
  await audit({ req, action: 'lead.update', entityType: 'Lead', entityId: doc._id });
  return ok(res, doc, 'Updated');
});

/** DELETE /admin/leads/:id */
export const remove = asyncHandler(async (req, res) => {
  const doc = await Lead.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound('Lead not found');
  await audit({ req, action: 'lead.delete', entityType: 'Lead', entityId: req.params.id });
  return ok(res, null, 'Deleted');
});

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * GET /admin/leads/export — download enquiries / newsletter subscribers.
 * Query: ?type=contact|newsletter (optional), ?format=csv|xlsx (default csv).
 */
export const exportLeads = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  const rows = await Lead.find(filter).sort('-createdAt').limit(50000).lean();
  const isNewsletter = req.query.type === 'newsletter';
  const stamp = new Date().toISOString().slice(0, 10);
  const base = isNewsletter ? 'newsletter-subscribers' : req.query.type === 'contact' ? 'contact-enquiries' : 'website-leads';

  const columns = isNewsletter
    ? [
        ['Email', (r) => r.email],
        ['Status', (r) => r.status],
        ['Source', (r) => r.source],
        ['Subscribed', (r) => new Date(r.createdAt).toISOString()],
      ]
    : [
        ['Type', (r) => r.type],
        ['Name', (r) => r.name],
        ['Email', (r) => r.email],
        ['Phone', (r) => r.phone],
        ['Country', (r) => r.country],
        ['Company', (r) => r.company],
        ['Job title', (r) => r.jobTitle],
        ['Subject', (r) => r.subject],
        ['Message', (r) => r.message],
        ['Status', (r) => r.status],
        ['Source', (r) => r.source],
        ['Received', (r) => new Date(r.createdAt).toISOString()],
      ];

  await audit({ req, action: 'lead.export', entityType: 'Lead', meta: { count: rows.length, type: req.query.type || 'all' } });

  if (req.query.format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(isNewsletter ? 'Subscribers' : 'Enquiries');
    ws.columns = columns.map(([header]) => ({ header, width: header === 'Message' ? 60 : 22 }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(columns.map(([, get]) => get(r) ?? ''));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  const header = columns.map(([h]) => csvCell(h)).join(',');
  const body = rows.map((r) => columns.map(([, get]) => csvCell(get(r))).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${base}-${stamp}.csv"`);
  return res.send(`\uFEFF${header}\n${body}`);
});
