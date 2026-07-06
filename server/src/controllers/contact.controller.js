import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { sendEmail } from '../services/email.service.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/** Where contact submissions are delivered (env → SMTP from → sensible default). */
const CONTACT_TO = process.env.CONTACT_TO || config.mail.from || 'support@hiresense.ai';

const escapeHtml = (s = '') =>
  String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/**
 * POST /contact — public contact form submission.
 * Emails the team via the shared email service. When SMTP is not configured the
 * message is logged (mocked) and the request still succeeds so the UX is clean.
 */
export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, company, phone, jobTitle, subject, message } = req.body;

  const fields = [
    ['Name', name],
    ['Email', email],
    ['Company', company],
    ['Phone', phone],
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
