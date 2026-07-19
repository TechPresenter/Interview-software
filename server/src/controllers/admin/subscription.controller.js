import { Plan } from '../../models/Plan.js';
import { Coupon } from '../../models/Coupon.js';
import { Payment } from '../../models/Payment.js';
import { Subscription } from '../../models/Subscription.js';
import { Company } from '../../models/Company.js';
import { Branding } from '../../models/Branding.js';
import { WebhookLog } from '../../models/WebhookLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';
import { invoiceToPdf } from '../../services/export.service.js';
import { safeSendTemplated, formatMoney } from '../../services/email.service.js';
import { config } from '../../config/index.js';

/* ── Plans ─────────────────────────────────────────────── */

/** GET /admin/plans */
export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.find().sort('sortOrder').lean();
  return ok(res, plans);
});

/** PUT /admin/plans — upsert by `key`. */
export const upsertPlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOneAndUpdate(
    { key: req.body.key },
    { $set: req.body },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await audit({ req, action: 'plan.upsert', entityType: 'Plan', entityId: plan._id });
  return ok(res, plan, 'Plan saved');
});

/**
 * POST /admin/plans/seed — sync the four tiers to the current defaults.
 * Upserts by `key`, so re-running applies the latest pricing/features to
 * existing plans (not just an empty DB).
 */
export const seedPlans = asyncHandler(async (req, res) => {
  const defaults = Plan.defaults();
  await Plan.bulkWrite(
    defaults.map((p) => ({ updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true } })),
  );
  await audit({ req, action: 'plan.seed', meta: { count: defaults.length } });
  return ok(res, await Plan.find().sort('sortOrder').lean(), 'Plans synced to defaults');
});

/* ── Coupons ───────────────────────────────────────────── */

/** GET /admin/coupons */
export const listCoupons = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['code', 'description'] });
  const { items, meta } = await paginateQuery(Coupon, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** POST /admin/coupons */
export const createCoupon = asyncHandler(async (req, res) => {
  const code = req.body.code.toUpperCase();
  if (await Coupon.exists({ code })) throw ApiError.conflict('Coupon code already exists');
  if (req.body.type === 'percent' && req.body.value > 100) {
    throw ApiError.badRequest('Percent discount cannot exceed 100');
  }
  const coupon = await Coupon.create({ ...req.body, code, createdBy: req.user._id });
  await audit({ req, action: 'coupon.create', entityType: 'Coupon', entityId: coupon._id });
  return created(res, coupon, 'Coupon created');
});

/** PATCH /admin/coupons/:id */
export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return ok(res, coupon, 'Coupon updated');
});

/** DELETE /admin/coupons/:id */
export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  await audit({ req, action: 'coupon.delete', entityType: 'Coupon', entityId: req.params.id });
  return ok(res, null, 'Coupon deleted');
});

/* ── Invoices / payments ───────────────────────────────── */

/**
 * The shared filter for the invoice list AND its export, so the file an admin
 * downloads is exactly the table they were looking at.
 *
 * `q` matches invoice number / transaction id / order id directly, and — via a
 * pre-resolved id set — the paying company's name or slug (regex can't cross a
 * ref, so the join runs first).
 */
async function invoiceListOptions(req) {
  const opts = parseListQuery(req.query, { searchFields: ['invoiceNumber', 'providerPaymentId', 'providerOrderId'] });
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const companies = await Company.find({ $or: [{ name: rx }, { slug: rx }] }).select('_id').limit(500).lean();
    if (companies.length) (opts.filter.$or ||= []).push({ company: { $in: companies.map((c) => c._id) } });
  }
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.provider) opts.filter.provider = req.query.provider;
  if (req.query.company) opts.filter.company = req.query.company;
  if (req.query.from || req.query.to) {
    opts.filter.createdAt = {};
    if (req.query.from) opts.filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) opts.filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }
  return opts;
}

/** GET /admin/invoices — all payments across companies (paginated). */
export const listInvoices = asyncHandler(async (req, res) => {
  const opts = await invoiceListOptions(req);
  const { items, meta } = await paginateQuery(Payment, opts.filter, opts, { path: 'company', select: 'name slug' });
  return ok(res, items, 'OK', meta);
});

/** GET /admin/invoices/export?format=csv|xlsx — the current view, as a file. */
export const exportInvoices = asyncHandler(async (req, res) => {
  const opts = await invoiceListOptions(req);
  const rows = await Payment.find(opts.filter).sort(opts.sort).limit(20000).populate('company', 'name').lean();
  await audit({ req, action: 'billing.export', meta: { count: rows.length, format: req.query.format || 'csv' } });

  const HEAD = ['Invoice', 'Company', 'Plan', 'Cycle', 'Amount', 'Currency', 'GST', 'Method', 'Provider', 'Transaction ID', 'Order ID', 'Status', 'Paid at', 'Created'];
  const line = (p) => [
    p.invoiceNumber || '', p.company?.name || '', p.planKey || '', p.billingCycle || '',
    (p.amount || 0) / 100, p.currency || 'INR', p.tax?.tax ? p.tax.tax / 100 : '',
    p.method || '', p.provider, p.providerPaymentId || '', p.providerOrderId || '',
    p.status, p.paidAt ? new Date(p.paidAt).toISOString() : '', new Date(p.createdAt).toISOString(),
  ];

  if (req.query.format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Payments');
    ws.addRow(HEAD);
    ws.getRow(1).font = { bold: true };
    rows.forEach((p) => ws.addRow(line(p)));
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="payments.xlsx"');
    await wb.xlsx.write(res);
    return res.end();
  }

  // Quote-double AND neutralise formula injection: a company named
  // "=HYPERLINK(...)" must open in Excel as text, not execute.
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [HEAD, ...rows.map(line)].map((r) => r.map(esc).join(',')).join('\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="payments.csv"');
  // A UTF-8 BOM ('\ufeff' spelled as an escape — a literal one trips
  // no-irregular-whitespace) so Excel decodes Unicode company names correctly.
  return res.send('\ufeff' + csv);
});

/** GET /admin/invoices/:id/pdf — any company's invoice, admin-side. */
export const invoicePdf = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).lean();
  if (!payment) throw ApiError.notFound('Invoice not found');
  const [company, branding] = await Promise.all([Company.findById(payment.company).lean(), Branding.getGlobal()]);
  const { buffer, filename, contentType } = await invoiceToPdf({ payment, company, branding });
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

/** POST /admin/invoices/:id/resend — re-email the receipt with the PDF attached. */
export const resendInvoice = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).lean();
  if (!payment) throw ApiError.notFound('Invoice not found');
  // A claim row that never finalized is not an invoice — emailing it would
  // send a receipt for money that never arrived.
  if (payment.status !== 'paid') throw ApiError.badRequest('Only paid invoices can be re-sent');
  const company = await Company.findById(payment.company).lean();
  const to = req.body.to || payment.receiptEmail || company?.billingEmail || company?.contactEmail;
  if (!to) throw ApiError.badRequest('This company has no billing email on file — pass { to } explicitly.');

  const branding = await Branding.getGlobal();
  const pdf = await invoiceToPdf({ payment, company, branding });
  const log = await safeSendTemplated('payment_receipt', {
    to,
    vars: {
      name: company?.name || 'there',
      amount: formatMoney(payment.amount, payment.currency),
      invoiceNumber: payment.invoiceNumber || String(payment._id),
      date: new Date(payment.paidAt || payment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      link: `${config.clientUrl}/dashboard/billing`,
    },
    company: payment.company,
    attachments: [{ filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' }],
  });
  await audit({ req, action: 'billing.invoice.resend', entityType: 'Payment', entityId: payment._id, meta: { to } });
  return ok(res, { sent: Boolean(log), to }, 'Invoice re-sent');
});

/* ── Webhook logs (payment debugging) ──────────────────── */

/** GET /admin/webhook-logs — every gateway delivery and what became of it. */
export const listWebhookLogs = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['orderId', 'paymentId', 'event', 'error'] });
  if (req.query.provider) opts.filter.provider = req.query.provider;
  if (req.query.outcome) opts.filter.outcome = req.query.outcome;
  const { items, meta } = await paginateQuery(WebhookLog, opts.filter, opts, { path: 'company', select: 'name' });
  return ok(res, items, 'OK', meta);
});

/** GET /admin/subscriptions — all subscriptions (paginated). */
export const listSubscriptions = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, {});
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.plan) opts.filter.plan = req.query.plan;
  const { items, meta } = await paginateQuery(Subscription, opts.filter, opts, { path: 'company', select: 'name slug' });
  return ok(res, items, 'OK', meta);
});
