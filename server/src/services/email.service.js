import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Email transport. Uses nodemailer SMTP when configured; otherwise logs the
 * message (so flows are testable without a mailbox). The nodemailer dependency
 * is imported lazily so the app runs even if it isn't installed.
 */

let transporter = null;
async function getTransporter() {
  if (transporter) return transporter;
  const { default: nodemailer } = await import('nodemailer');
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port || 587,
    secure: (config.mail.port || 587) === 465,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transporter;
}

/**
 * @param {{ to: string, subject: string, html?: string, text?: string }} msg
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!config.mail.enabled) {
    logger.info({ to, subject, text: text || html }, '✉️  [dev] email (SMTP disabled — not sent)');
    return { delivered: false, mocked: true };
  }
  try {
    const t = await getTransporter();
    const info = await t.sendMail({ from: config.mail.from, to, subject, html, text });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ err: err.message, to }, 'email send failed');
    return { delivered: false, error: err.message };
  }
}

/** Convenience helpers for the auth flows. */
export const emails = {
  verification: (to, code) =>
    sendEmail({ to, subject: 'Verify your HireSense email', text: `Your verification code is ${code}. It expires in 10 minutes.` }),
  otp: (to, code) =>
    sendEmail({ to, subject: 'Your HireSense login code', text: `Your one-time login code is ${code}. It expires in 5 minutes.` }),
  passwordReset: (to, code) =>
    sendEmail({ to, subject: 'Reset your HireSense password', text: `Use this code to reset your password: ${code}. It expires in 15 minutes.` }),
};

export default sendEmail;
