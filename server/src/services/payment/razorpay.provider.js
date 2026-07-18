import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Razorpay provider. SDK imported lazily; works without config (throws clearly).
 * Razorpay uses an Order → client checkout → signature verification flow.
 */

/** Constant-time MAC comparison — a short-circuiting !== leaks matched-prefix length. */
function safeEqual(expected, given) {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(given || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let client = null;
async function getClient() {
  if (!config.payments.razorpay.enabled) {
    throw ApiError.badRequest('Razorpay is not configured', { code: 'PROVIDER_DISABLED' });
  }
  if (!client) {
    const { default: Razorpay } = await import('razorpay');
    client = new Razorpay({ key_id: config.payments.razorpay.keyId, key_secret: config.payments.razorpay.keySecret });
  }
  return client;
}

export const razorpayProvider = {
  name: 'razorpay',
  enabled: () => config.payments.razorpay.enabled,

  /** Create an order; the client opens Razorpay Checkout with this order id. */
  async createCheckout({ planKey, planName, amount, currency, billingCycle, company, couponCode }) {
    const rzp = await getClient();
    const order = await rzp.orders.create({
      amount,
      currency: currency || 'INR',
      // plan carries the KEY (activation looks plans up by key); planName is for humans.
      notes: { company: String(company), plan: planKey || planName, planName, billingCycle, ...(couponCode ? { coupon: couponCode } : {}) },
    });
    return { orderId: order.id, keyId: config.payments.razorpay.keyId, amount, currency: order.currency };
  },

  /** Read a payment back from Razorpay — lets the verify endpoint check the real amount. */
  async fetchPayment(paymentId) {
    const rzp = await getClient();
    return rzp.payments.fetch(paymentId); // { amount, currency, status, order_id, method, ... }
  },

  /** Read an order back — its notes carry the plan/cycle WE stamped at checkout. */
  async fetchOrder(orderId) {
    const rzp = await getClient();
    return rzp.orders.fetch(orderId); // { amount, currency, status, notes: { company, plan, billingCycle } }
  },

  /**
   * Verify a Razorpay checkout callback signature (client posts
   * razorpay_order_id, razorpay_payment_id, razorpay_signature).
   */
  verifyCallback({ orderId, paymentId, signature }) {
    const expected = crypto
      .createHmac('sha256', config.payments.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    if (!safeEqual(expected, signature)) throw ApiError.badRequest('Invalid payment signature');
    return true;
  },

  /** Verify webhook signature (X-Razorpay-Signature) against the raw body. */
  verifyWebhook(rawBody, signature, secret) {
    const expected = crypto.createHmac('sha256', secret || config.payments.razorpay.keySecret).update(rawBody).digest('hex');
    if (!safeEqual(expected, signature)) throw ApiError.badRequest('Invalid webhook signature');
    return JSON.parse(rawBody.toString());
  },

  parseEvent(event) {
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload?.payment?.entity || {};
      return {
        kind: 'payment_succeeded',
        provider: 'razorpay',
        company: payment.notes?.company,
        plan: payment.notes?.plan,
        billingCycle: payment.notes?.billingCycle,
        amount: payment.amount,
        currency: payment.currency,
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id,
        method: payment.method,
        raw: payment,
      };
    }
    return null;
  },
};

export default razorpayProvider;
