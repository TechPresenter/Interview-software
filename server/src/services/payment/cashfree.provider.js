import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Cashfree Payments provider (PG, API version 2023-08-01).
 *
 * Uses the global `fetch` (Node >= 18) so no SDK dependency is required. Works
 * without config — every method throws a clear PROVIDER_DISABLED error until the
 * CASHFREE_* env vars are set. Flow: create an order → client opens Cashfree
 * Checkout with the returned `payment_session_id` → Cashfree calls our webhook.
 */

const API_VERSION = '2023-08-01';
const baseUrl = () =>
  config.payments.cashfree.mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

function ensureEnabled() {
  if (!config.payments.cashfree.enabled) {
    throw ApiError.badRequest('Cashfree is not configured', { code: 'PROVIDER_DISABLED' });
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-version': API_VERSION,
    'x-client-id': config.payments.cashfree.appId,
    'x-client-secret': config.payments.cashfree.secretKey,
  };
}

export const cashfreeProvider = {
  name: 'cashfree',
  enabled: () => config.payments.cashfree.enabled,

  /**
   * Create a Cashfree order. `amount` is in minor units (cents/paise) to match the
   * rest of the billing layer; Cashfree expects major units, so we convert.
   */
  async createCheckout({ planName, amount, currency, billingCycle, company, customerEmail, successUrl }) {
    ensureEnabled();
    const orderId = `cf_${company}_${Date.now()}`;
    const res = await fetch(`${baseUrl()}/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number((amount / 100).toFixed(2)),
        order_currency: currency || 'INR',
        customer_details: {
          customer_id: String(company),
          customer_email: customerEmail || 'billing@example.com',
          customer_phone: '9999999999',
        },
        order_meta: { return_url: `${successUrl}&cf_order_id={order_id}` },
        order_note: `${planName} (${billingCycle})`,
        order_tags: { company: String(company), plan: planName, billingCycle },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw ApiError.badRequest(data?.message || 'Cashfree order creation failed');
    return {
      provider: 'cashfree',
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id,
      amount,
      currency: data.order_currency,
      mode: config.payments.cashfree.mode,
    };
  },

  /**
   * Create an order for a public interview-application fee.
   *
   * NOTE the units: `amount` here is in MAJOR units (rupees), unlike
   * createCheckout() above which takes the billing layer's minor units and
   * divides. The application fee is typed by the admin as "500" meaning ₹500 and
   * shown to the applicant verbatim, so converting it would charge 100x.
   *
   * Tagged `kind: 'application'` so the webhook can tell this apart from a
   * subscription order — both arrive at the same endpoint.
   */
  async createApplicationOrder({ orderId, amount, currency, applicationId, customerId, customerName, customerEmail, customerPhone, returnUrl, note }) {
    ensureEnabled();
    const res = await fetch(`${baseUrl()}/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number(Number(amount).toFixed(2)),
        order_currency: currency || 'INR',
        customer_details: {
          customer_id: String(customerId),
          customer_name: customerName || undefined,
          customer_email: customerEmail,
          customer_phone: customerPhone,
        },
        order_meta: { return_url: returnUrl },
        order_note: note,
        order_tags: { kind: 'application', applicationId: String(applicationId) },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw ApiError.badRequest(data?.message || 'Could not start the payment. Please try again.');
    return {
      provider: 'cashfree',
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id,
      amount,
      currency: data.order_currency,
      mode: config.payments.cashfree.mode,
    };
  },

  /** Read an order back from Cashfree — the fallback when a webhook is late. */
  async fetchOrder(orderId) {
    ensureEnabled();
    const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw ApiError.badRequest(data?.message || 'Could not read the payment status.');
    return data; // { order_status: 'PAID' | 'ACTIVE' | 'EXPIRED', ... }
  },

  /**
   * Verify a Cashfree webhook. Cashfree signs `${timestamp}${rawBody}` with the
   * secret key (HMAC-SHA256, base64) and sends it as `x-webhook-signature` with
   * the `x-webhook-timestamp` header.
   */
  verifyWebhook(rawBody, signature, timestamp, secret) {
    const key = secret || config.payments.cashfree.secretKey;
    const payload = `${timestamp}${rawBody.toString()}`;
    const expected = crypto.createHmac('sha256', key).update(payload).digest('base64');
    if (expected !== signature) throw ApiError.badRequest('Invalid Cashfree webhook signature');
    return JSON.parse(rawBody.toString());
  },

  parseEvent(event) {
    if (event?.type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const order = event.data?.order || {};
      const payment = event.data?.payment || {};
      const tags = order.order_tags || {};
      return {
        kind: 'payment_succeeded',
        /**
         * What the money was FOR. Subscription orders carry company/plan tags;
         * public application-fee orders carry kind:'application'. Both land on
         * the same webhook endpoint, so without this the handler would try to
         * activate a subscription for an applicant who has no company.
         */
        orderKind: tags.kind === 'application' ? 'application' : 'subscription',
        applicationId: tags.applicationId,
        company: tags.company,
        plan: tags.plan,
        billingCycle: tags.billingCycle,
        amount: Math.round(Number(order.order_amount || 0) * 100),
        currency: order.order_currency,
        providerPaymentId: String(payment.cf_payment_id || ''),
        providerOrderId: order.order_id,
        raw: event.data,
      };
    }
    return null;
  },
};

export default cashfreeProvider;
