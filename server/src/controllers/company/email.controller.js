import { Company } from '../../models/Company.js';
import { EmailLog } from '../../models/EmailLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { encryptSecret } from '../../utils/crypto.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { logActivity } from '../../services/audit.service.js';
import { sendEmail, sendTemplated, smtpEnabled, refreshSmtp } from '../../services/email.service.js';
import { gmailConfigured } from '../../services/email/gmail.js';

/** Read + shape a company's email config (secrets never returned in plaintext). */
async function readConfig(companyId) {
  // NOTE: select only the `+` overrides — projecting the bare `emailConfig`
  // together with a sub-path (emailConfig.pass) collides in MongoDB once the
  // sub-doc has nested select:false fields (emailConfig.gmail.refreshToken).
  const doc = await Company.findById(companyId).select('+emailConfig.pass').lean();
  const ec = doc?.emailConfig || {};
  const gm = ec.gmail || {};
  return {
    enabled: Boolean(ec.enabled),
    host: ec.host || '',
    port: ec.port || 587,
    secure: Boolean(ec.secure),
    user: ec.user || '',
    fromName: ec.fromName || '',
    fromEmail: ec.fromEmail || '',
    signature: ec.signature || '',
    passSet: Boolean(ec.pass),
    gmail: {
      available: gmailConfigured(), // server has Google OAuth credentials
      connected: Boolean(gm.connected),
      email: gm.email || '',
      connectedAt: gm.connectedAt || null,
    },
  };
}

/** GET /company/email-config — the company's SMTP config (password never returned). */
export const getConfig = asyncHandler(async (req, res) => {
  return ok(res, await readConfig(req.companyId));
});

/** PUT /company/email-config — update SMTP config (password encrypted at rest). */
export const updateConfig = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const set = {};
  for (const f of ['enabled', 'host', 'port', 'secure', 'user', 'fromName', 'fromEmail', 'signature']) {
    if (b[f] !== undefined) set[`emailConfig.${f}`] = b[f];
  }
  // Only overwrite the password when a real (non-masked) value is supplied.
  if (typeof b.pass === 'string' && b.pass && !b.pass.includes('•')) {
    set['emailConfig.pass'] = encryptSecret(b.pass);
  }
  await Company.findByIdAndUpdate(req.companyId, { $set: set });
  refreshSmtp(req.companyId);
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'email.config.update', summary: 'Updated company email settings' });
  return ok(res, await readConfig(req.companyId), 'Email settings saved');
});

/** POST /company/email-config/test — send a test using the company's SMTP. */
export const testConfig = asyncHandler(async (req, res) => {
  const to = (req.body?.to || req.user.email || '').trim();
  if (!to) throw ApiError.badRequest('Provide a recipient email');
  refreshSmtp(req.companyId); // pick up any just-saved config
  const result = await sendEmail({
    to,
    subject: 'AIPL Hire · SMTP test ✅',
    html: `<p>This is a test email sent using your company's SMTP configuration at ${new Date().toISOString()}.</p><p>If you received it, outbound email is working.</p>`,
    text: 'Company SMTP test — if you received this, outbound email is working.',
    company: req.companyId,
  });
  const enabled = await smtpEnabled(req.companyId);
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'email.config.test', status: result.delivered ? 'success' : 'failure', meta: { to } });
  const message = result.delivered
    ? `Test email sent to ${to}`
    : result.mocked
      ? 'No SMTP configured — using platform default or nothing. Add your SMTP host to send for real.'
      : `Send failed${result.error ? `: ${result.error}` : ''}`;
  return ok(res, { to, enabled, ...result }, message);
});

/** GET /company/email-logs — this company's email history + delivery status. */
export const logs = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { defaultSort: '-createdAt', searchFields: ['to', 'subject'] });
  const filter = { company: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const { items, meta } = await paginateQuery(EmailLog, filter, opts);
  return ok(res, items, 'OK', meta);
});

/** POST /company/email-logs/:id/retry — re-send a failed/mocked message. */
export const retry = asyncHandler(async (req, res) => {
  const log = await EmailLog.findOne({ _id: req.params.id, company: req.companyId }).lean();
  if (!log) throw ApiError.notFound('Email not found');
  if (!log.templateKey) throw ApiError.badRequest('This message can’t be retried automatically');
  const out = await sendTemplated(log.templateKey, { to: log.to, vars: log.meta?.vars || {}, company: req.companyId, createdBy: req.user._id });
  return ok(res, { status: out.status }, out.status === 'sent' ? 'Email resent' : `Retry ${out.status}`);
});
