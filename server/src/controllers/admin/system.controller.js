import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getGroup, setMany } from '../../services/settings.service.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { AuditLog } from '../../models/AuditLog.js';
import { audit } from '../../services/audit.service.js';
import { sendEmail } from '../../services/email.service.js';
import { config } from '../../config/index.js';

const ALLOWED_GROUPS = ['smtp', 'sms', 'payment', 'security', 'general', 'feature_flag'];

/** GET /admin/system/:group — settings for a group (secrets masked). */
export const getSettingsGroup = asyncHandler(async (req, res) => {
  const { group } = req.params;
  if (!ALLOWED_GROUPS.includes(group)) throw ApiError.badRequest('Unknown settings group');
  return ok(res, await getGroup(group));
});

/** PUT /admin/system/:group — upsert a batch of settings. */
export const updateSettingsGroup = asyncHandler(async (req, res) => {
  const { group } = req.params;
  if (!ALLOWED_GROUPS.includes(group)) throw ApiError.badRequest('Unknown settings group');
  const result = await setMany(group, req.body.entries, req.user._id);
  await audit({ req, action: 'system.settings.update', meta: { group } });
  return ok(res, result, 'Settings saved');
});

/** GET /admin/audit-logs — filterable security trail. */
export const auditLogs = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['action'] });
  if (req.query.action) opts.filter.action = req.query.action;
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.company) opts.filter.company = req.query.company;
  const { items, meta } = await paginateQuery(AuditLog, opts.filter, opts, { path: 'actor', select: 'name email role' });
  return ok(res, items, 'OK', meta);
});

/**
 * POST /admin/backup — trigger a logical backup job.
 * Backups should run via `mongodump` in an ops job / cron; this endpoint records
 * the request and returns guidance (real execution wired in Phase 6 DevOps).
 */
export const triggerBackup = asyncHandler(async (req, res) => {
  await audit({ req, action: 'system.backup.requested' });
  return ok(
    res,
    {
      status: 'queued',
      note: 'Backup is performed by the ops job (mongodump → object storage). See docs/DEPLOYMENT.md.',
      requestedAt: new Date(),
    },
    'Backup requested',
  );
});

/**
 * POST /admin/system/test-email — send a test message to verify SMTP config.
 * Defaults to the admin's own email when no recipient is supplied. When SMTP is
 * not configured the email service logs instead of sending (mocked), which we
 * surface so the admin knows it wasn't actually delivered.
 */
export const testEmail = asyncHandler(async (req, res) => {
  const to = (req.body?.to || req.user.email || '').trim();
  if (!to) throw ApiError.badRequest('No recipient — provide an email or set one on your account');
  const sentAt = new Date().toISOString();
  const result = await sendEmail({
    to,
    subject: 'HireSense SMTP test ✅',
    html: `<p>This is a test email from <strong>HireSense</strong>, sent at ${sentAt}.</p><p>If you received this, your SMTP settings are working correctly.</p>`,
    text: `HireSense SMTP test sent at ${sentAt}. If you received this, your SMTP settings are working correctly.`,
  });
  await audit({ req, action: 'system.email.test', status: result.delivered ? 'success' : 'failure', meta: { to } });
  const message = result.delivered
    ? `Test email sent to ${to}`
    : result.mocked
      ? 'SMTP is not configured — the email was logged on the server, not delivered'
      : `Send failed${result.error ? `: ${result.error}` : ''}`;
  return ok(res, { to, smtpEnabled: config.mail.enabled, ...result }, message);
});

/**
 * DELETE /admin/audit-logs — clear audit logs (super-admin only). Pass
 * `?before=<ISO date>` to clear only entries older than that date; otherwise all
 * entries are removed. The clear action itself is audited afterwards so the trail
 * always shows that (and by whom) it was cleared.
 */
export const clearAuditLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.before) {
    const before = new Date(req.query.before);
    if (Number.isNaN(before.getTime())) throw ApiError.badRequest('Invalid "before" date');
    filter.createdAt = { $lt: before };
  }
  const { deletedCount } = await AuditLog.deleteMany(filter);
  await audit({ req, action: 'system.audit.clear', meta: { deletedCount, before: req.query.before || 'all' } });
  return ok(res, { deletedCount }, `Cleared ${deletedCount} audit log${deletedCount === 1 ? '' : 's'}`);
});
