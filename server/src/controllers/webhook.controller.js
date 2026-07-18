import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { getProvider, applyPaidPlan } from '../services/payment/index.js';
import { markApplicationPaid } from '../services/application.service.js';

/**
 * Provider webhooks. These receive the RAW request body (mounted with
 * express.raw before the JSON parser) so signatures verify correctly. They must
 * respond 200 quickly and be idempotent.
 */

/** POST /webhooks/stripe */
export const stripe = asyncHandler(async (req, res) => {
  const provider = getProvider('stripe');
  let event;
  try {
    event = await provider.verifyWebhook(req.body, req.headers['stripe-signature']);
  } catch (err) {
    logger.warn({ err: err.message }, 'stripe webhook verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const parsed = provider.parseEvent(event);
  if (parsed?.kind === 'payment_succeeded') {
    await applyPaidPlan({ ...parsed });
  }
  return res.json({ received: true });
});

/**
 * POST /webhooks/cashfree
 * Cashfree signs `${timestamp}${rawBody}` (HMAC-SHA256, base64) and sends it as
 * `x-webhook-signature` alongside `x-webhook-timestamp`. Falls back to the
 * secret key when no dedicated webhook secret is configured.
 */
export const cashfree = asyncHandler(async (req, res) => {
  const provider = getProvider('cashfree');
  let event;
  try {
    event = provider.verifyWebhook(
      req.body,
      req.headers['x-webhook-signature'],
      req.headers['x-webhook-timestamp'],
      config.payments.cashfree.webhookSecret,
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'cashfree webhook verification failed');
    return res.status(400).send('invalid signature');
  }

  const parsed = provider.parseEvent(event);
  if (parsed?.kind === 'payment_succeeded') {
    // Application-fee orders and subscription orders share this endpoint, so the
    // order's own tag decides where the money lands. Routing an applicant's fee
    // into applyPaidPlan would look up a company that does not exist.
    if (parsed.orderKind === 'application') {
      await markApplicationPaid(parsed);
    } else {
      await applyPaidPlan({ ...parsed });
    }
  }
  return res.json({ received: true });
});

/** POST /webhooks/razorpay */
export const razorpay = asyncHandler(async (req, res) => {
  const provider = getProvider('razorpay');
  let event;
  try {
    event = provider.verifyWebhook(req.body, req.headers['x-razorpay-signature'], config.payments.razorpay.keySecret);
  } catch (err) {
    logger.warn({ err: err.message }, 'razorpay webhook verification failed');
    return res.status(400).send('invalid signature');
  }

  const parsed = provider.parseEvent(event);
  if (parsed?.kind === 'payment_succeeded') {
    await applyPaidPlan({ ...parsed });
  }
  return res.json({ received: true });
});
