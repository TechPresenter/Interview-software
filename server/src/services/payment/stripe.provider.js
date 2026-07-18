import { config } from '../../config/index.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Stripe provider. The SDK is imported lazily so the app runs without Stripe
 * configured; calls throw a clear error until keys are set.
 */

let client = null;
async function getClient() {
  if (!config.payments.stripe.enabled) {
    throw ApiError.badRequest('Stripe is not configured', { code: 'PROVIDER_DISABLED' });
  }
  if (!client) {
    const { default: Stripe } = await import('stripe');
    client = new Stripe(config.payments.stripe.secretKey);
  }
  return client;
}

export const stripeProvider = {
  name: 'stripe',
  enabled: () => config.payments.stripe.enabled,

  /** Create a hosted Checkout Session and return its URL. */
  async createCheckout({ planKey, planName, amount, currency, billingCycle, company, customerEmail, successUrl, cancelUrl }) {
    const stripe = await getClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: (currency || 'usd').toLowerCase(),
            product_data: { name: planName },
            recurring: { interval: billingCycle === 'yearly' ? 'year' : 'month' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      // {CHECKOUT_SESSION_ID} is substituted by Stripe on redirect, so the
      // success page knows which session to reconcile if the webhook is late.
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      // plan carries the KEY (activation looks plans up by key); planName is for humans.
      metadata: { company: String(company), plan: planKey || planName, planName, billingCycle },
    });
    return { url: session.url, sessionId: session.id };
  },

  /** Verify the webhook signature and return the parsed event. */
  async verifyWebhook(rawBody, signature) {
    const stripe = await getClient();
    if (!config.payments.stripe.webhookSecret) {
      throw ApiError.badRequest('Stripe webhook secret not configured');
    }
    return stripe.webhooks.constructEvent(rawBody, signature, config.payments.stripe.webhookSecret);
  },

  /** Normalize a Stripe event into our internal payment shape (or null to ignore). */
  parseEvent(event) {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      return {
        kind: 'payment_succeeded',
        provider: 'stripe',
        company: s.metadata?.company,
        plan: s.metadata?.plan,
        billingCycle: s.metadata?.billingCycle,
        amount: s.amount_total,
        currency: (s.currency || 'usd').toUpperCase(),
        providerPaymentId: s.payment_intent || s.id,
        providerCustomerId: s.customer,
        providerSubscriptionId: s.subscription,
        raw: s,
      };
    }
    return null;
  },
};

export default stripeProvider;
