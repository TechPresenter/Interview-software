import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { logger } from '../config/logger.js';
import { Lead } from '../models/Lead.js';

/**
 * POST /newsletter — public newsletter subscription. Idempotent: re-subscribing
 * with the same email updates the record rather than creating duplicates.
 */
export const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email, source } = req.body;

  await Lead.findOneAndUpdate(
    { type: 'newsletter', email },
    {
      $setOnInsert: { type: 'newsletter', email, source: source || 'newsletter', status: 'new' },
      $set: { meta: { ip: req.ip, userAgent: req.headers['user-agent'] } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  logger.info({ email }, 'newsletter subscription');
  return ok(res, { subscribed: true }, 'You are subscribed — welcome aboard!');
});

export default subscribeNewsletter;
