import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * SMS + WhatsApp delivery via a provider abstraction (Twilio by default). The
 * SDK is imported lazily and calls fall back to logging when unconfigured.
 */

let client = null;
async function getClient() {
  if (client) return client;
  const { default: twilio } = await import('twilio');
  client = twilio(config.sms.twilio.sid, config.sms.twilio.token);
  return client;
}

/** Send a plain SMS. */
export async function sendSms(to, body) {
  if (!config.sms.enabled) {
    logger.info({ to, body }, '📱 [dev] SMS (provider disabled — not sent)');
    return { delivered: false, mocked: true };
  }
  try {
    const c = await getClient();
    const msg = await c.messages.create({ to, from: config.sms.twilio.from, body });
    return { delivered: true, sid: msg.sid };
  } catch (err) {
    logger.error({ err: err.message, to }, 'SMS send failed');
    return { delivered: false, error: err.message };
  }
}

/** Send a WhatsApp message (Twilio whatsapp: channel). */
export async function sendWhatsApp(to, body) {
  if (!config.sms.enabled || !config.sms.twilio.whatsappFrom) {
    logger.info({ to, body }, '💬 [dev] WhatsApp (provider disabled — not sent)');
    return { delivered: false, mocked: true };
  }
  try {
    const c = await getClient();
    const msg = await c.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${config.sms.twilio.whatsappFrom}`,
      body,
    });
    return { delivered: true, sid: msg.sid };
  } catch (err) {
    logger.error({ err: err.message, to }, 'WhatsApp send failed');
    return { delivered: false, error: err.message };
  }
}

export default { sendSms, sendWhatsApp };
