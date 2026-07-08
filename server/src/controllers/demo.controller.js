import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { sendEmail, safeSendTemplated } from '../services/email.service.js';
import { verifyCaptcha } from '../services/captcha.service.js';
import { DemoBooking } from '../models/DemoBooking.js';

const DEMO_TO = process.env.CONTACT_TO || config.mail.from || 'support@aipl.online';
const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

const escapeHtml = (s = '') =>
  String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'To be scheduled');

/**
 * POST /demo — public "Book a Demo" request. Persists the booking, emails the
 * requester a confirmation, and notifies the team. De-dupes rapid re-submits.
 */
export const bookDemo = asyncHandler(async (req, res) => {
  const { name, company, email, phone, country, preferredDate, timeSlot, timezone, employees, message, company_website, captchaToken } = req.body;

  // Honeypot — silently accept without persisting.
  if (company_website) {
    logger.info({ email }, 'demo honeypot triggered — ignored');
    return ok(res, { received: true, status: 'pending' }, 'Thanks — your demo request has been received.');
  }

  const captcha = await verifyCaptcha(captchaToken, req.ip, 'contact');
  if (!captcha.success) throw ApiError.badRequest(captcha.error || 'CAPTCHA verification failed');

  // De-dupe: same email requested moments ago.
  const dup = await DemoBooking.findOne({ email, createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } }).select('_id status').lean();
  if (dup) {
    return ok(res, { received: true, duplicate: true, status: dup.status || 'pending' }, 'Thanks — your demo request has already been received.');
  }

  await DemoBooking.create({
    name, company, email, phone, country,
    preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    timeSlot, timezone, employees, message,
    status: 'pending',
    activity: [{ action: 'created', detail: 'Demo requested from website' }],
    meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
  });

  // Notify the team.
  const rows = [
    ['Name', name], ['Company', company], ['Email', email], ['Phone', phone], ['Country', country],
    ['Preferred date', fmtDate(preferredDate)], ['Time slot', timeSlot], ['Timezone', timezone], ['Employees', employees],
  ].filter(([, v]) => v);
  const html = `<h2 style="margin:0 0 12px">New demo booking</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      ${rows.map(([k, v]) => `<tr><td style="color:#666"><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join('')}
    </table>${message ? `<p style="margin:16px 0 4px"><strong>Requirements</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ''}`;
  await sendEmail({ to: DEMO_TO, subject: `[Demo booking] ${name}${company ? ` · ${company}` : ''}`, html, text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'), replyTo: email });

  // Confirm to the requester (branded template).
  await safeSendTemplated('demo_ack', {
    to: email,
    vars: { name: name || 'there', date: fmtDate(preferredDate), timeSlot: timeSlot || 'to be confirmed', link: config.clientUrl },
  });

  logger.info({ email }, 'demo booking created');
  return ok(res, { received: true, status: 'pending' }, 'Thanks — your demo request has been received. Our team will confirm shortly.');
});

export default bookDemo;
