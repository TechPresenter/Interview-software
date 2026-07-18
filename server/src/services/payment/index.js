import { nanoid } from 'nanoid';
import { stripeProvider } from './stripe.provider.js';
import { razorpayProvider } from './razorpay.provider.js';
import { cashfreeProvider } from './cashfree.provider.js';
import { Company } from '../../models/Company.js';
import { Plan } from '../../models/Plan.js';
import { Subscription } from '../../models/Subscription.js';
import { Payment } from '../../models/Payment.js';
import { Coupon } from '../../models/Coupon.js';
import { User } from '../../models/User.js';
import { Branding } from '../../models/Branding.js';
import { ApiError } from '../../utils/ApiError.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { logActivity, audit } from '../audit.service.js';
import { safeSendTemplated, formatMoney } from '../email.service.js';
import { billingIdentity, gstBreakdown } from '../billingConfig.service.js';
import { notify } from '../notification.service.js';
import { emitToCompany } from '../../socket/emitters.js';
import { invoiceToPdf } from '../export.service.js';

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
    planKey: plan.key,
    planName: plan.name,
    amount,
    currency,
    billingCycle,
    couponCode,
    company: company._id,
    customerEmail: customerEmail || company.billingEmail || company.contactEmail,
    // The dedicated success page verifies the order server-side and shows the
    // receipt; Cashfree appends &cf_order_id={order_id}, Stripe &session_id=….
    successUrl: `${baseUrl}/dashboard/billing/success?provider=${providerName}`,
    cancelUrl: `${baseUrl}/dashboard/billing?status=cancelled`,
  });
}

/** Escape a string for use inside a RegExp (plan-name fallback lookup). */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * now + N months with the day-of-month clamped: a plan bought Jan 31 must end
 * Feb 28/29, not roll over to Mar 3 (setMonth alone does exactly that).
 */
function addPeriod(from, billingCycle) {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * Activate a paid plan after a successful payment (webhooks + verify endpoints).
 *
 * Accepts BOTH field spellings — the razorpay verify endpoint sends
 * { companyId, planKey } while every provider's parseEvent emits
 * { company, plan }. That mismatch used to make Company.findById(undefined)
 * throw on every webhook, which is exactly the "paid but still on free"
 * bug: normalization here is the fix, not a convenience.
 *
 * Exactly-once under retries: the Payment row is CLAIMED first (insert with a
 * unique index on provider+providerPaymentId), then the subscription/company
 * writes run, then the row is finalized as 'paid'. A concurrent duplicate
 * insert loses to the index and returns { duplicate }; a crash between claim
 * and finalize leaves a 'created' row that the next delivery resumes — every
 * step after the claim is an idempotent $set, so replaying is harmless.
 */
export async function applyPaidPlan(evt) {
  const {
    billingCycle = 'monthly', provider, amount, currency,
    providerPaymentId, providerOrderId, providerCustomerId, providerSubscriptionId,
    raw, method, couponCode,
  } = evt;
  const companyId = evt.companyId || evt.company;
  const planKey = evt.planKey || evt.plan;
  if (!provider) throw ApiError.badRequest('Payment event is missing its provider');
  if (!companyId || !planKey) throw ApiError.badRequest('Payment event is missing its company or plan tag');

  // Fast-path duplicate checks; the unique indexes below are the real guarantee.
  if (providerPaymentId) {
    const prior = await Payment.findOne({ provider, providerPaymentId });
    if (prior?.status === 'paid') return { duplicate: true, payment: prior };
  }
  if (providerOrderId) {
    const prior = await Payment.findOne({ provider, providerOrderId, status: 'paid' });
    if (prior) return { duplicate: true, payment: prior };
  }

  const company = await Company.findById(companyId);
  // By key first; by name (case-insensitive) as a fallback for orders created
  // before checkout metadata carried the key — those tagged 'Professional'.
  let plan = planKey ? await Plan.findOne({ key: planKey }) : null;
  if (!plan && planKey) plan = await Plan.findOne({ name: new RegExp(`^${escapeRegex(planKey)}$`, 'i') });
  if (!company || !plan) throw ApiError.notFound('Company or plan not found');

  const now = new Date();

  // ── Claim the payment row (the idempotency lock) ─────────────────────────
  // Adopt an existing row for this order first: the return-page verify may
  // have claimed it without a gateway payment id (attempts fetch failed) while
  // the webhook arrives WITH one — creating a second row would leave a phantom
  // 'created' invoice behind and blow the one_paid_per_order index at finalize.
  let payment = providerOrderId ? await Payment.findOne({ provider, providerOrderId }) : null;
  if (payment?.status === 'paid') return { duplicate: true, payment };
  if (payment && providerPaymentId && !payment.providerPaymentId) {
    // The adopter knows more than the claimer did — attach the id (best-effort;
    // a concurrent writer attaching the same id loses nothing).
    await Payment.updateOne({ _id: payment._id, providerPaymentId: { $exists: false } }, { $set: { providerPaymentId } }).catch(() => {});
  }
  if (!payment) {
    try {
      payment = await Payment.create({
        company: company._id,
        provider,
        providerPaymentId: providerPaymentId || undefined,
        providerOrderId: providerOrderId || undefined,
        amount,
        currency: currency || 'INR',
        status: 'created',
        description: `${plan.name} (${billingCycle})`,
        planKey: plan.key,
        billingCycle,
        method,
        coupon: couponCode ? { code: couponCode } : undefined,
        raw,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      payment = providerPaymentId
        ? await Payment.findOne({ provider, providerPaymentId })
        : await Payment.findOne({ provider, providerOrderId });
      if (!payment) throw err;
      if (payment.status === 'paid') return { duplicate: true, payment };
      // else: an earlier delivery claimed it and hasn't finished — the atomic
      // finalize below decides which of us completes it.
    }
  }

  // ── Activate: subscription + plan/limits snapshot (idempotent $sets) ─────
  const periodEnd = addPeriod(now, billingCycle);

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

  // Snapshot plan limits onto the company — this is what every limit check and
  // the sidebar read, so the new quotas are live on the very next request.
  company.plan = plan.key;
  company.subscription = subscription._id;
  company.limits = plan.limits;
  await company.save();

  // ── Finalize the payment/invoice record (exactly-once gate) ──────────────
  // A single atomic transition 'not paid' → 'paid' decides the winner between
  // a webhook and the return-page verify racing on the same charge. Only the
  // request whose update matches runs the side effects below — the loser gets
  // { duplicate } — so ONE invoice number, ONE receipt email, ONE audit row.
  const identity = await billingIdentity();
  let finalized;
  try {
    finalized = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'paid' } },
      {
        $set: {
          subscription: subscription._id,
          status: 'paid',
          paidAt: payment.paidAt || now,
          invoiceNumber: payment.invoiceNumber || `INV-${now.getFullYear()}-${nanoid(8).toUpperCase()}`,
          receiptEmail: company.billingEmail || company.contactEmail || undefined,
          // GST frozen at payment time so the invoice never changes retroactively.
          tax: payment.tax?.percent ? payment.tax : gstBreakdown(amount, identity),
          ...(method && !payment.method ? { method } : {}),
        },
      },
      { new: true },
    );
  } catch (err) {
    // one_paid_per_order: another row for this order finalized first.
    if (err?.code !== 11000) throw err;
    finalized = null;
  }
  if (!finalized) {
    const winner = await Payment.findOne({ provider, providerOrderId, status: 'paid' })
      || (providerPaymentId ? await Payment.findOne({ provider, providerPaymentId, status: 'paid' }) : null);
    return { duplicate: true, payment: winner || payment };
  }
  payment = finalized;

  // Coupon bookkeeping — the winner counts the redemption exactly once.
  if (couponCode) {
    await Coupon.updateOne({ code: String(couponCode).toUpperCase() }, { $inc: { redemptions: 1 } }).catch(() => {});
  }

  // ── Trail: permanent audit + live activity feed + dashboards ────────────
  await audit({
    action: 'billing.activated', status: 'success', entityType: 'Payment', entityId: payment._id,
    company: company._id,
    meta: { plan: plan.key, billingCycle, amount, currency: payment.currency, provider, invoiceNumber: payment.invoiceNumber },
  });
  await logActivity({ company: company._id, action: 'billing.paid', entityType: 'Payment', entityId: payment._id, summary: `Upgraded to ${plan.name}` });
  emitToCompany(company._id, 'billing:activated', { plan: plan.key, invoiceNumber: payment.invoiceNumber });

  // Tell the platform admins a purchase happened (best-effort).
  try {
    const admins = await User.find({ role: 'super_admin', isActive: { $ne: false } }).select('_id').lean();
    await Promise.all(admins.map((a) => notify({
      recipient: a._id,
      type: 'billing',
      title: 'New subscription purchase',
      body: `${company.name} upgraded to ${plan.name} (${billingCycle}) — ${formatMoney(amount, payment.currency)}`,
      link: '/dashboard/subscriptions',
    })));
  } catch (err) {
    logger.warn({ err: err.message }, 'admin purchase notification failed');
  }

  // ── Branded billing emails, receipt carrying the PDF invoice ─────────────
  const to = payment.receiptEmail;
  if (to) {
    const money = formatMoney(amount, payment.currency);
    const billingLink = `${config.clientUrl}/dashboard/billing`;
    let attachments;
    try {
      const branding = await Branding.getGlobal();
      const pdf = await invoiceToPdf({ payment, company, branding });
      attachments = [{ filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' }];
    } catch (err) {
      logger.warn({ err: err.message }, 'invoice PDF for receipt email failed — sending without it');
    }
    await safeSendTemplated('subscription_confirmation', {
      to,
      vars: { name: company.name, planName: plan.name, amount: money, renewalDate: fmtDate(periodEnd), link: billingLink },
      company: company._id,
    });
    await safeSendTemplated('payment_receipt', {
      to,
      vars: { name: company.name, amount: money, invoiceNumber: payment.invoiceNumber, date: fmtDate(payment.paidAt), link: billingLink },
      company: company._id,
      attachments,
    });
  }

  return { subscription, payment };
}

/**
 * Verify a Cashfree order server-side and activate it — the return-page path.
 *
 * The webhook is the primary activation; this is what makes the flow survive a
 * webhook that is late, unregistered, or lost. Nothing from the browser is
 * trusted: the order is fetched from Cashfree with our credentials, the tenant
 * check pins it to the calling company, and the cf_payment_id keeps this path
 * deduplicating against the same key the webhook uses.
 */
export async function verifyCashfreeOrder({ companyId, orderId }) {
  const provider = getProvider('cashfree');
  const order = await provider.fetchOrder(orderId);
  const tags = order?.order_tags || {};

  if (String(tags.company || '') !== String(companyId)) {
    // A distinct code: the client must tell "wrong workspace" (terminal, be
    // honest) apart from "role may not activate" (fall back to read-only polling).
    throw ApiError.forbidden('That payment does not belong to this workspace', { code: 'ORDER_TENANT_MISMATCH' });
  }
  if (tags.kind === 'application') throw ApiError.badRequest('Not a subscription order');

  const orderStatus = order.order_status;
  if (orderStatus !== 'PAID') {
    // ACTIVE = checkout still open / payment settling; anything else is dead.
    return { status: orderStatus === 'ACTIVE' ? 'pending' : 'failed', orderStatus };
  }

  const attempts = await provider.fetchOrderPayments(orderId).catch(() => []);
  const success = attempts.find((p) => p.payment_status === 'SUCCESS');

  const result = await applyPaidPlan({
    companyId: tags.company,
    planKey: tags.plan,
    billingCycle: tags.billingCycle || 'monthly',
    provider: 'cashfree',
    amount: Math.round(Number(order.order_amount || 0) * 100),
    currency: order.order_currency || 'INR',
    providerPaymentId: success ? String(success.cf_payment_id) : '',
    providerOrderId: order.order_id || orderId,
    method: success?.payment_group,
    couponCode: tags.coupon,
    raw: { order, payment: success },
  });
  return { status: 'paid', ...result };
}

export default { getProvider, availableProviders, defaultProvider, startCheckout, applyPaidPlan, verifyCashfreeOrder, priceFor };
