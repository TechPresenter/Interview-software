import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { Template } from '../../models/Template.js';
import { EmailLog } from '../../models/EmailLog.js';
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS } from '../../services/email/templates.js';
import { previewTemplate, sendTemplated } from '../../services/email.service.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/**
 * Sample values used for previews + test sends.
 *
 * Must cover EVERY variable declared across DEFAULT_TEMPLATES — a template whose
 * variable is missing here previews with a blank where real content goes, which
 * is worse than useless for someone checking their copy. test/email.templates.test.js
 * asserts this stays complete.
 */
export const SAMPLE = {
  name: 'Alex Doe', code: '482913', link: 'https://app.example.com/welcome', platformName: 'HireSense',
  jobTitle: 'Senior Engineer', company: 'Acme Inc', scheduledAt: 'Mon, 24 Jun · 3:00 PM', expiresAt: 'in 7 days',
  score: '82%', recommendation: 'Hire', amount: '$49.00', invoiceNumber: 'INV-2026-AB12', date: 'Jun 24, 2026',
  dueDate: 'Jul 1, 2026', planName: 'Professional', renewalDate: 'Jul 24, 2026', daysLeft: '3', role: 'Recruiter',
  ticketId: '1042', subject: 'We shipped an update', status: 'In progress', message: 'Thanks for reaching out — we’re on it.',
  event: 'New sign-in from Chrome', ip: '203.0.113.7', time: 'just now',
  email: 'alex.doe@example.com', phone: '+91 98765 43210', password: 'Tmp-8fQ2xR!vZ',
  newStatus: 'Suspended', reason: 'The role was filled internally.', severity: 'High',
  previousAt: 'Fri, 21 Jun · 11:00 AM', timeSlot: 'Tue, 25 Jun · 10:30 AM IST',
  salary: '₹24,00,000 per annum', startDate: 'Mon, 1 Sep 2026',
  unsubscribeUrl: 'https://app.example.com/unsubscribe?t=sample',
};

/** GET /admin/email/templates — catalog merged with overrides. */
export const listTemplates = asyncHandler(async (_req, res) => {
  const overrides = await Template.find({ key: { $in: TEMPLATE_KEYS } }).lean();
  const omap = Object.fromEntries(overrides.map((t) => [t.key, t]));
  const items = TEMPLATE_KEYS.map((key) => {
    const def = DEFAULT_TEMPLATES[key];
    const o = omap[key];
    return { key, name: def.name, category: def.category, subject: o?.subject ?? def.subject, variables: def.variables, isOverridden: Boolean(o), isActive: o ? o.isActive !== false : true };
  });
  return ok(res, items);
});

/** GET /admin/email/templates/:key — full template (override or default) for editing. */
export const getTemplate = asyncHandler(async (req, res) => {
  const def = DEFAULT_TEMPLATES[req.params.key];
  if (!def) throw ApiError.notFound('Unknown template');
  const o = await Template.findOne({ key: req.params.key }).lean();
  return ok(res, {
    key: req.params.key, name: def.name, category: def.category, variables: def.variables,
    subject: o?.subject ?? def.subject, body: o?.body ?? def.html,
    isOverridden: Boolean(o), isActive: o ? o.isActive !== false : true,
    defaultSubject: def.subject, defaultBody: def.html,
  });
});

/** PUT /admin/email/templates/:key — save an override. */
export const upsertTemplate = asyncHandler(async (req, res) => {
  const def = DEFAULT_TEMPLATES[req.params.key];
  if (!def) throw ApiError.notFound('Unknown template');
  const { subject, body, isActive } = req.body;
  if (!body) throw ApiError.badRequest('Body is required');
  const tpl = await Template.findOneAndUpdate(
    { key: req.params.key },
    { $set: { key: req.params.key, name: def.name, channel: 'email', subject, body, variables: def.variables, isActive: isActive !== false, updatedBy: req.user._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await audit({ req, action: 'email.template.update', meta: { key: req.params.key } });
  return ok(res, tpl, 'Template saved');
});

/** DELETE /admin/email/templates/:key — revert to the built-in default. */
export const resetTemplate = asyncHandler(async (req, res) => {
  await Template.deleteOne({ key: req.params.key });
  await audit({ req, action: 'email.template.reset', meta: { key: req.params.key } });
  return ok(res, null, 'Reverted to default');
});

/** POST /admin/email/preview — render branded HTML with sample (or supplied) vars. */
export const preview = asyncHandler(async (req, res) => {
  const key = req.body.key || req.query.key;
  if (!DEFAULT_TEMPLATES[key]) throw ApiError.notFound('Unknown template');
  const out = await previewTemplate(key, { ...SAMPLE, ...(req.body.vars || {}) });
  return ok(res, out);
});

/** POST /admin/email/test — send a test email of a template. */
export const sendTest = asyncHandler(async (req, res) => {
  const { key } = req.body;
  if (!DEFAULT_TEMPLATES[key]) throw ApiError.notFound('Unknown template');
  const to = req.body.to || req.user.email;
  const log = await sendTemplated(key, { to, vars: { ...SAMPLE, ...(req.body.vars || {}) }, createdBy: req.user._id });
  await audit({ req, action: 'email.test', status: log.status === 'failed' ? 'failure' : 'success', meta: { key, to } });
  return ok(res, log, log.status === 'mocked' ? 'SMTP not configured — email logged, not delivered' : log.status === 'failed' ? `Send failed: ${log.error}` : `Test sent to ${to}`);
});

/** GET /admin/email/logs — paginated email history. */
export const logs = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['to', 'subject'] });
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.templateKey) opts.filter.templateKey = req.query.templateKey;
  const { items, meta } = await paginateQuery(EmailLog, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** POST /admin/email/logs/:id/resend */
export const resend = asyncHandler(async (req, res) => {
  const log = await EmailLog.findById(req.params.id);
  if (!log) throw ApiError.notFound('Email not found');
  const out = await sendTemplated(log.templateKey, { to: log.to, vars: log.meta?.vars || {}, company: log.company, createdBy: req.user._id });
  await audit({ req, action: 'email.resend', meta: { id: log._id, to: log.to } });
  return ok(res, out, 'Email resent');
});

/** GET /admin/email/stats — counts by delivery status. */
export const stats = asyncHandler(async (_req, res) => {
  const rows = await EmailLog.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  return ok(res, { total: rows.reduce((a, r) => a + r.n, 0), byStatus });
});
