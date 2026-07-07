import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { getGroup } from './settings.service.js';
import { Branding } from '../models/Branding.js';
import { Template } from '../models/Template.js';
import { EmailLog } from '../models/EmailLog.js';
import { interpolate } from './template.service.js';
import { renderBranded } from './email/layout.js';
import { DEFAULT_TEMPLATES } from './email/templates.js';

/**
 * Email transport + branded templated sending.
 *
 * SMTP config is resolved from the Admin Panel settings (group "smtp") first,
 * falling back to env (config.mail). When nothing is configured the message is
 * logged instead of sent (mocked) so flows are testable without a mailbox. Every
 * send is recorded to EmailLog for history, delivery status, and open tracking.
 */

const API_BASE = config.apiPublicUrl || `http://localhost:${config.port}${config.apiPrefix}`;
const ASSET_BASE = config.apiPublicUrl ? config.apiPublicUrl.replace(config.apiPrefix, '') : `http://localhost:${config.port}`;

let _tx = null;
let _sig = null;
let _smtpCache = null;
let _smtpAt = 0;

/** Merge admin-panel SMTP settings over env defaults (cached 30s). */
async function resolveSmtp() {
  if (_smtpCache && Date.now() - _smtpAt < 30000) return _smtpCache;
  let db = {};
  try {
    const rows = await getGroup('smtp');
    db = Object.fromEntries((rows || []).map((r) => [r.key.replace('smtp.', ''), r.value]));
  } catch {
    /* settings unavailable — fall back to env */
  }
  const host = db.host || config.mail.host;
  const port = Number(db.port || config.mail.port || 587);
  const user = db.user || config.mail.user;
  const pass = db.password ?? db.pass ?? config.mail.pass;
  const from = db.from || config.mail.from;
  _smtpCache = { host, port, user, pass, from, enabled: Boolean(host) };
  _smtpAt = Date.now();
  return _smtpCache;
}

/** Invalidate the cached transporter/SMTP after settings change. */
export function refreshSmtp() {
  _smtpCache = null;
  _tx = null;
  _sig = null;
}

async function getTransporter(smtp) {
  const sig = `${smtp.host}:${smtp.port}:${smtp.user}`;
  if (_tx && _sig === sig) return _tx;
  const { default: nodemailer } = await import('nodemailer');
  _tx = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  _sig = sig;
  return _tx;
}

/** True when SMTP is configured (admin panel or env). */
export async function smtpEnabled() {
  return (await resolveSmtp()).enabled;
}

/**
 * Low-level send. Returns { delivered, mocked?, messageId?, error? }.
 * @param {{ to:string, subject:string, html?:string, text?:string, from?:string }} msg
 */
export async function sendEmail({ to, subject, html, text, from, replyTo }) {
  const smtp = await resolveSmtp();
  if (!smtp.enabled) {
    logger.info({ to, subject }, '✉️  [dev] email (SMTP not configured — not sent)');
    return { delivered: false, mocked: true };
  }
  try {
    const t = await getTransporter(smtp);
    const info = await t.sendMail({ from: from || smtp.from, to, subject, html, text, replyTo });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ err: err.message, to }, 'email send failed');
    return { delivered: false, error: err.message };
  }
}

async function safeBranding() {
  try {
    return (await Branding.getGlobal()).toObject();
  } catch {
    return { platformName: 'AIPL Hire' };
  }
}

/** Resolve a template (DB override → built-in default) and interpolate it. */
async function resolveTemplate(key, vars) {
  const def = DEFAULT_TEMPLATES[key];
  let dbTpl = null;
  try {
    dbTpl = await Template.findOne({ key, isActive: true }).lean();
  } catch {
    /* ignore */
  }
  return {
    subject: interpolate(dbTpl?.subject ?? def?.subject ?? key, vars),
    bodyHtml: interpolate(dbTpl?.body ?? def?.html ?? '<p>{{message}}</p>', vars),
    preheader: interpolate(def?.preheader ?? '', vars),
    category: def?.category,
  };
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Render the full branded HTML for a template without sending (preview). */
export async function previewTemplate(key, vars = {}) {
  const branding = await safeBranding();
  const tpl = await resolveTemplate(key, { platformName: branding.platformName || 'HireSense', name: 'there', ...vars });
  const html = renderBranded({ branding, subject: tpl.subject, bodyHtml: tpl.bodyHtml, preheader: tpl.preheader, assetBase: ASSET_BASE });
  return { subject: tpl.subject, html, category: tpl.category };
}

/**
 * Send a branded, templated email and log it.
 * @param {string} key  template key (see services/email/templates.js)
 * @param {{ to:string, vars?:object, company?:string, relatedUser?:string, createdBy?:string, scheduledFor?:Date }} opts
 * @returns {Promise<import('../models/EmailLog.js').EmailLog>}
 */
export async function sendTemplated(key, { to, vars = {}, company, relatedUser, createdBy, scheduledFor } = {}) {
  const branding = await safeBranding();
  const mergedVars = { platformName: branding.platformName || 'AIPL Hire', name: 'there', dashboardUrl: config.clientUrl, ...vars };
  const tpl = await resolveTemplate(key, mergedVars);
  const log = await EmailLog.create({
    to,
    subject: tpl.subject,
    templateKey: key,
    category: tpl.category,
    company,
    relatedUser,
    createdBy,
    status: scheduledFor && new Date(scheduledFor) > new Date() ? 'scheduled' : 'queued',
    scheduledFor,
    meta: { vars: mergedVars },
  });
  if (log.status === 'scheduled') return log; // a scheduler/cron will dispatch it later

  const pixel = `${API_BASE}/track/open/${log._id}`;
  const html = renderBranded({ branding, subject: tpl.subject, bodyHtml: tpl.bodyHtml, preheader: tpl.preheader, assetBase: ASSET_BASE, trackingPixel: pixel });
  const result = await sendEmail({ to, subject: tpl.subject, html, text: stripHtml(tpl.bodyHtml) });
  log.status = result.delivered ? 'sent' : result.mocked ? 'mocked' : 'failed';
  log.messageId = result.messageId;
  log.error = result.error;
  log.sentAt = new Date();
  await log.save();
  return log;
}

/**
 * Fire-and-forget templated send that never throws. Email problems must never
 * break the business flow (payment, interview completion, stage change…) that
 * triggered them, so failures are logged and swallowed.
 */
export async function safeSendTemplated(key, opts = {}) {
  if (!opts.to) return null;
  try {
    return await sendTemplated(key, opts);
  } catch (err) {
    logger.warn({ err: err.message, key, to: opts.to }, 'email trigger failed');
    return null;
  }
}

/** Format a money amount for emails (major units, e.g. 9999 → ₹9,999). */
export function formatMoney(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Auth-flow convenience helpers — now branded + logged. */
export const emails = {
  verification: (to, code, link) => sendTemplated('account_verification', { to, vars: { code, link: link || config.clientUrl } }),
  otp: (to, code) => sendTemplated('login_otp', { to, vars: { code } }),
  passwordReset: (to, code, link) => sendTemplated('password_reset', { to, vars: { code, link: link || config.clientUrl } }),
  welcome: (to, name, link) => sendTemplated('welcome', { to, vars: { name, link: link || config.clientUrl } }),
};

export default sendEmail;
