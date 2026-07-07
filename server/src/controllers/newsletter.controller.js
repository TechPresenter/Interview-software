import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { safeSendTemplated } from '../services/email.service.js';
import { Lead } from '../models/Lead.js';

/**
 * POST /newsletter — public newsletter subscription. Idempotent: re-subscribing
 * with the same email updates the record rather than creating duplicates. A
 * welcome email is sent only the first time an address subscribes.
 */
export const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email, source } = req.body;

  const result = await Lead.findOneAndUpdate(
    { type: 'newsletter', email },
    {
      $setOnInsert: { type: 'newsletter', email, source: source || 'newsletter', status: 'new' },
      $set: { meta: { ip: req.ip, userAgent: req.headers['user-agent'] } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true },
  );

  const isNew = !result?.lastErrorObject?.updatedExisting;

  if (isNew) {
    await safeSendTemplated('newsletter_welcome', {
      to: email,
      vars: { email, link: config.clientUrl },
    });
    logger.info({ email }, 'newsletter subscription (new)');
    return ok(res, { subscribed: true, isNew }, 'You are subscribed — welcome aboard!');
  }

  logger.info({ email }, 'newsletter subscription (already subscribed)');
  return ok(res, { subscribed: true, isNew }, 'You are already subscribed — thanks for staying with us!');
});

export default subscribeNewsletter;
