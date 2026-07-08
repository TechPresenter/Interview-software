import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { sendEmail, safeSendTemplated } from '../services/email.service.js';
import { verifyCaptcha } from '../services/captcha.service.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { Lead } from '../models/Lead.js';

/** Where contact submissions are delivered (env → SMTP from → sensible default). */
const CONTACT_TO = process.env.CONTACT_TO || config.mail.from || 'support@aipl.online';

/** De-dupe window: identical submissions within this window are treated as one. */
const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

const escapeHtml = (s = '') =>
  String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/**
 * POST /contact — public contact form submission.
 *
 * - Persists the enquiry to the Lead collection (Admin → Enquiries).
 * - Notifies the team (admin) and sends the customer a confirmation.
 * - De-duplicates rapid identical re-submissions (double-click / retries) so a
 *   single user action results in exactly one saved enquiry + one email.
 * When SMTP is not configured the emails are logged (mocked) and the request
 * still succeeds so the UX stays clean.
 */
export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, company, phone, country, jobTitle, subject, message, company_website, captchaToken } = req.body;

  // Honeypot: hidden field only bots fill. Pretend success (don't tip off bots)
  // but skip saving/emailing. Legit browsers leave it empty.
  if (company_website) {
    logger.info({ email }, 'contact honeypot triggered — ignored');
    return ok(res, { received: true }, 'Thanks — your message has been received.');
  }

  // CAPTCHA (only enforced when enabled for the contact form in Admin → System).
  const captcha = await verifyCaptcha(captchaToken, req.ip, 'contact');
  if (!captcha.success) throw ApiError.badRequest(captcha.error || 'CAPTCHA verification failed');

  // Idempotency: same email + message submitted moments ago ⇒ treat as duplicate.
  const recentDuplicate = await Lead.findOne({
    type: 'contact',
    email,
    message,
    createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
  })
    .select('_id')
    .lean();

  if (recentDuplicate) {
    logger.info({ email, subject }, 'contact form duplicate ignored');
    return ok(res, { received: true, duplicate: true }, 'Thanks — your message has already been received. We will get back to you shortly.');
  }

  // Persist the enquiry so it is visible + manageable from the Admin Panel.
  try {
    await Lead.create({
      type: 'contact',
      name, email, company, phone, country, jobTitle, subject, message,
      source: subject === 'Careers' ? 'careers' : 'contact_form',
      meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
  } catch (err) {
    logger.error({ err: err.message }, 'contact lead save failed');
  }

  const fields = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone],
    ['Country', country],
    ['Company', company],
    ['Job title', jobTitle],
    ['Subject', subject],
  ].filter(([, v]) => v);

  const html = `
    <h2 style="margin:0 0 12px">New contact enquiry</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      ${fields
        .map(
          ([k, v]) =>
            `<tr><td style="color:#666"><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`,
        )
        .join('')}
    </table>
    <p style="margin:16px 0 4px"><strong>Message</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

  const text =
    fields.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${message}`;

  // 1) Notify the team (admin). Reply-to the sender for easy responses.
  const result = await sendEmail({
    to: CONTACT_TO,
    subject: `[Contact: ${subject}] ${name}`,
    html,
    text,
    replyTo: email,
  });

  // 2) Send the customer a branded confirmation (fire-and-forget, never blocks).
  await safeSendTemplated('contact_ack', {
    to: email,
    vars: { name: name || 'there', subject, link: config.clientUrl },
  });

  logger.info(
    { email, subject, delivered: result.delivered, mocked: result.mocked },
    'contact form submission',
  );

  return ok(res, { received: true }, 'Thanks — your message has been received. We will get back to you shortly.');
});

export default submitContact;
