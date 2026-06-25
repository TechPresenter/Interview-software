import { Notification } from '../models/Notification.js';
import { emitToUser } from '../socket/emitters.js';
import { sendEmail } from './email.service.js';
import { sendSms, sendWhatsApp } from './sms.service.js';
import { logger } from '../config/logger.js';

/**
 * Create an in-app notification, push it over Socket.IO in real time, and
 * optionally fan out to email (SMS/WhatsApp wired in Phase 5).
 *
 * @param {object} args
 * @param {string} args.recipient User id
 * @param {string} [args.company]
 * @param {string} args.type
 * @param {string} args.title
 * @param {string} [args.body]
 * @param {string} [args.link]
 * @param {string[]} [args.channels] e.g. ['in_app','email','sms','whatsapp']
 * @param {string} [args.email] recipient email (required if 'email' channel)
 * @param {string} [args.phone] recipient phone (required if 'sms'/'whatsapp')
 */
export async function notify({ recipient, company, type, title, body, link, channels = ['in_app'], email, phone }) {
  try {
    const doc = await Notification.create({ recipient, company, type, title, body, link, channels });
    emitToUser(recipient, 'notification:new', doc.toObject());

    if (channels.includes('email') && email) await sendEmail({ to: email, subject: title, text: body });
    if (channels.includes('sms') && phone) await sendSms(phone, `${title}: ${body}`);
    if (channels.includes('whatsapp') && phone) await sendWhatsApp(phone, `${title}\n${body}`);

    return doc;
  } catch (err) {
    logger.error({ err }, 'notify failed');
    return null;
  }
}

export default notify;
