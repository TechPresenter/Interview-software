import { nanoid } from 'nanoid';
import { stripeProvider } from './stripe.provider.js';
import { razorpayProvider } from './razorpay.provider.js';
import { cashfreeProvider } from './cashfree.provider.js';
import { Company } from '../../models/Company.js';
import { Plan } from '../../models/Plan.js';
import { Subscription } from '../../models/Subscription.js';
import { Payment } from '../../models/Payment.js';
import { Coupon } from '../../models/Coupon.js';
import { ApiError } from '../../utils/ApiError.js';
import { config } from '../../config/index.js';
import { logActivity } from '../audit.service.js';
import { safeSendTemplated, formatMoney } from '../email.service.js';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const PROVIDERS = { stripe: stripeProvider, razorpay: razorpayProvider, cashfree: cashfreeProvider };

/** Resolve a provider by name, ensuring it's enabled. */
export function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) throw ApiError.badRequest(`Unknown payment provider: ${name}`);
  return provider;
}

/** Which providers are currently configured (for the UI). */
export function availableProviders() {
  return Object.values(PROVIDERS)
    .filter((p) => p.enabled())
    .map((p) => p.name);
}

/**
 * The default payment gateway for subscription purchases. Cashfree is the
 * platform default; if it isn't configured we fall back to any other configured
 * provider, else still return 'cashfree' so the UI shows it (and the checkout
 * returns a clear "not configured" message until CASHFREE_* env vars are set).
 */
export function defaultProvider() {
  const available = availableProviders();
  if (available.includes('cashfree')) return 'cashfree';
  return available[0] || 'cashfree';
}

/** Compute the price for a plan/cycle, applying an optional coupon. */
export async function priceFor(plan, billingCycle, couponCode) {
  let amount = billingCycle === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly;
  const currency = plan.pricing.currency || 'INR';
  let coupon = null;

  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon || !coupon.isRedeemable()) throw ApiError.badRequest('Invalid or expired coupon');
    if (coupon.appliesToPlans?.length && !coupon.appliesToPlans.includes(plan.key)) {
      throw ApiError.badRequest('Coupon does not apply to this plan');
    }
    // A fixed-amount coupon must be in the same currency as the plan.
    if (coupon.type === 'amount' && coupon.currency && coupon.currency !== currency) {
      throw ApiError.badRequest('Coupon currency does not match this plan');
    }
    amount =
      coupon.type === 'percent'
        ? Math.round(amount * (1 - Math.min(100, Math.max(0, coupon.value)) / 100))
        : Math.max(0, amount - coupon.value);
  }
  return { amount, currency, coupon };
}

/**
 * Create a checkout for a company to subscribe to a plan via the chosen provider.
 */
export async function startCheckout({ companyId, providerName, planKey, billingCycle = 'monthly', couponCode, customerEmail, baseUrl }) {
  const [company, plan] = await Promise.all([Company.findById(companyId), Plan.findOne({ key: planKey, isActive: true })]);
  if (!company) throw ApiError.notFound('Company not found');
  if (!plan) throw ApiError.notFound('Plan not found');
  if (!plan.pricing.monthly && !plan.pricing.yearly) {
    throw ApiError.badRequest('This plan is not self-serve — contact sales');
  }

  const provider = getProvider(providerName);
  const { amount, currency } = await priceFor(plan, billingCycle, couponCode);

  return provider.createCheckout({
    planName: plan.name,
    amount,
    currency,
    billingCycle,
    company: company._id,
    customerEmail: customerEmail || company.billingEmail || company.contactEmail,
    successUrl: `${baseUrl}/dashboard/billing?status=success`,
    cancelUrl: `${baseUrl}/dashboard/billing?status=cancelled`,
  });
}

/**
 * Activate a paid plan after a successful payment (called from webhooks/callbacks).
 * Updates the Subscription, snapshots plan limits onto the Company, and records
 * a Payment/invoice. Idempotent on providerPaymentId.
 */
export async function applyPaidPlan({ companyId, planKey, billingCycle, provider, amount, currency, providerPaymentId, providerOrderId, providerCustomerId, providerSubscriptionId, raw }) {
  if (providerPaymentId && (await Payment.exists({ providerPaymentId }))) {
    return { duplicate: true };
  }

  const [company, plan] = await Promise.all([Company.findById(companyId), Plan.findOne({ key: planKey })]);
  if (!company || !plan) throw ApiError.notFound('Company or plan not found');

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await Subscription.findOneAndUpdate(
    { company: company._id },
    {
      $set: {
        plan: plan.key,
        status: 'active',
        billingCycle,
        provider,
        amount,
        currency,
        providerCustomerId,
        providerSubscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  // Snapshot plan limits onto the company.
  company.plan = plan.key;
  company.subscription = subscription._id;
  company.limits = plan.limits;
  await company.save();

  const payment = await Payment.create({
    company: company._id,
    subscription: subscription._id,
    provider,
    providerPaymentId,
    providerOrderId,
    amount,
    currency,
    status: 'paid',
    invoiceNumber: `INV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`,
    description: `${plan.name} (${billingCycle})`,
    paidAt: now,
    raw,
  });

  await logActivity({ company: company._id, action: 'billing.paid', entityType: 'Payment', entityId: payment._id, summary: `Upgraded to ${plan.name}` });

  // Branded billing emails (best-effort): plan confirmation + payment receipt.
  const to = company.billingEmail || company.contactEmail;
  if (to) {
    const money = formatMoney(amount, currency);
    const billingLink = `${config.clientUrl}/dashboard/billing`;
    await safeSendTemplated('subscription_confirmation', {
      to,
      vars: { name: company.name, planName: plan.name, amount: money, renewalDate: fmtDate(periodEnd), link: billingLink },
      company: company._id,
    });
    await safeSendTemplated('payment_receipt', {
      to,
      vars: { name: company.name, amount: money, invoiceNumber: payment.invoiceNumber, date: fmtDate(now), link: billingLink },
      company: company._id,
    });
  }

  return { subscription, payment };
}

export default { getProvider, availableProviders, defaultProvider, startCheckout, applyPaidPlan, priceFor };
