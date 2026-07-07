import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { sendEmail } from '../services/email.service.js';
import { logger } from '../config/logger.js';
import { Lead } from '../models/Lead.js';

/** Where contact submissions are delivered (env → SMTP from → sensible default). */
const CONTACT_TO = process.env.CONTACT_TO || 'support@aipl.online';

const escapeHtml = (s = '') =>
  String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/**
 * POST /contact — public contact form submission.
 * Emails the team via the shared email service. When SMTP is not configured the
 * message is logged (mocked) and the request still succeeds so the UX is clean.
 */
export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, company, phone, country, jobTitle, subject, message } = req.body;

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

  const result = await sendEmail({
    to: CONTACT_TO,
    subject: `[Contact: ${subject}] ${name}`,
    html,
    text,
    replyTo: email,
  });

  logger.info(
    { email, subject, delivered: result.delivered, mocked: result.mocked },
    'contact form submission',
  );

  return ok(res, { received: true }, 'Thanks — your message has been received. We will get back to you shortly.');
});

export default submitContact;
