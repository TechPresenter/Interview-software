import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { getProvider, applyPaidPlan } from '../services/payment/index.js';
import { markApplicationPaid } from '../services/application.service.js';
import { WebhookLog } from '../models/WebhookLog.js';

/**
 * Provider webhooks. These receive the RAW request body (mounted with
 * express.raw before the JSON parser) so signatures verify correctly. They must
 * respond 200 quickly and be idempotent.
 *
 * Every delivery is recorded in WebhookLog whatever becomes of it. The class of
 * bug this guards against is an activation that verifies, parses, and then
 * throws — the gateway sees a 500 and retries, the company stays on free, and
 * without a log the only evidence is a console line nobody kept.
 */

/** Verified payloads only, and never more than ~100KB of them — the log is for
 *  debugging activations, not for archiving whatever strangers POST at us. */
function boundedPayload(event) {
  try {
    const s = JSON.stringify(event);
    if (s.length <= 100_000) return event;
    return { truncated: true, bytes: s.length, head: s.slice(0, 2000) };
  } catch {
    return undefined;
  }
}

/** Best-effort log write — a logging failure must never break the webhook. */
async function record(fields) {
  try {
    await WebhookLog.create(fields);
  } catch (err) {
    logger.warn({ err: err.message }, 'webhook log write failed');
  }
}

/**
 * Shared post-verification pipeline: parse → dispatch → record the outcome.
 * Re-throws activation errors so the provider keeps retrying (non-2xx).
 */
async function dispatch({ providerName, provider, event, eventName, res }) {
  const parsed = provider.parseEvent(event);
  const meta = {
    provider: providerName,
    event: eventName,
    signatureValid: true,
    kind: parsed?.kind,
    orderId: parsed?.providerOrderId,
    paymentId: parsed?.providerPaymentId,
    payload: boundedPayload(event),
  };

  if (parsed?.kind !== 'payment_succeeded') {
    await record({ ...meta, outcome: 'ignored' });
    return res.json({ received: true });
  }

  try {
    if (parsed.orderKind === 'application') {
      // Public application-fee orders (Cashfree only) — not a subscription.
      const app = await markApplicationPaid({ ...parsed, orderId: parsed.providerOrderId });
      await record({ ...meta, outcome: 'processed', application: app?._id });
    } else {
      const result = await applyPaidPlan(parsed);
      await record({ ...meta, outcome: result?.duplicate ? 'duplicate' : 'processed', company: parsed.company || undefined });
    }
  } catch (err) {
    await record({ ...meta, outcome: 'error', error: err.message, company: parsed.company || undefined });
    throw err; // non-2xx → the gateway retries; the log row is what the admin debugs from
  }
  return res.json({ received: true });
}

/** POST /webhooks/stripe */
export const stripe = asyncHandler(async (req, res) => {
  const provider = getProvider('stripe');
  let event;
  try {
    event = await provider.verifyWebhook(req.body, req.headers['stripe-signature']);
  } catch (err) {
    logger.warn({ err: err.message }, 'stripe webhook verification failed');
    await record({ provider: 'stripe', signatureValid: false, outcome: 'invalid_signature', error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  return dispatch({ providerName: 'stripe', provider, event, eventName: event?.type, res });
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
    await record({ provider: 'cashfree', signatureValid: false, outcome: 'invalid_signature', error: err.message });
    return res.status(400).send('invalid signature');
  }
  return dispatch({ providerName: 'cashfree', provider, event, eventName: event?.type, res });
});

/** POST /webhooks/razorpay */
export const razorpay = asyncHandler(async (req, res) => {
  const provider = getProvider('razorpay');
  let event;
  try {
    event = provider.verifyWebhook(req.body, req.headers['x-razorpay-signature'], config.payments.razorpay.keySecret);
  } catch (err) {
    logger.warn({ err: err.message }, 'razorpay webhook verification failed');
    await record({ provider: 'razorpay', signatureValid: false, outcome: 'invalid_signature', error: err.message });
    return res.status(400).send('invalid signature');
  }
  return dispatch({ providerName: 'razorpay', provider, event, eventName: event?.event, res });
});
