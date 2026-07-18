import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getGroup, setMany } from '../../services/settings.service.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { AuditLog } from '../../models/AuditLog.js';
import { audit } from '../../services/audit.service.js';
import { sendEmail, refreshSmtp } from '../../services/email.service.js';
import * as ttsService from '../../services/tts.service.js';
import { config } from '../../config/index.js';

// 'applications' backs the public Apply-for-Interview form (payment link, fee,
// declaration text). It has a typed endpoint of its own —
// controllers/admin/applicationConfig.controller.js — but the generic settings
// screen lists groups from here, so an omission would leave the group invisible
// and every write to it rejected as "Unknown settings group".
const ALLOWED_GROUPS = ['smtp', 'sms', 'payment', 'security', 'general', 'feature_flag', 'voice', 'proctoring', 'captcha', 'applications', 'billing'];

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
  // Apply integration changes immediately (bypass the short read caches).
  if (group === 'voice') ttsService.refreshVoice();
  if (group === 'smtp') refreshSmtp();
  await audit({ req, action: 'system.settings.update', meta: { group } });
  return ok(res, result, 'Settings saved');
});

/**
 * POST /admin/system/test-voice — synthesize a short sample with the current
 * Sarvam config so the admin can hear the selected voice. Returns base64 WAV
 * ({ audios, mime }); { enabled:false } when Sarvam isn't configured.
 */
export const testVoice = asyncHandler(async (req, res) => {
  const lang = req.body?.lang === 'hi' ? 'hi' : 'en';
  const gender = req.body?.gender === 'male' ? 'male' : 'female';
  const sample =
    (req.body?.text && String(req.body.text).slice(0, 300)) ||
    (lang === 'hi'
      ? 'नमस्ते! मैं आपकी AI इंटरव्यूअर हूँ। यह Sarvam आवाज़ का एक परीक्षण है।'
      : 'Hello! I am your AI interviewer. This is a test of the Sarvam voice.');
  const result = await ttsService.synthesize({ text: sample, lang, gender });
  await audit({ req, action: 'system.voice.test', status: result ? 'success' : 'failure', meta: { lang, gender } });
  if (!result) {
    const enabled = await ttsService.ttsEnabled();
    return ok(
      res,
      { audios: [], mime: null, enabled },
      enabled ? 'Voice generation failed — check the API key or server logs' : 'Sarvam voice is not configured',
    );
  }
  return ok(res, { ...result, enabled: true }, 'Voice sample generated');
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
