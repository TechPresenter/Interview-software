import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { config } from '../../config/index.js';
import { Plan } from '../../models/Plan.js';
import { Subscription } from '../../models/Subscription.js';
import { Payment } from '../../models/Payment.js';
import { Company } from '../../models/Company.js';
import { usageReport } from '../../services/limits.service.js';
import * as payments from '../../services/payment/index.js';
import { getProvider, applyPaidPlan } from '../../services/payment/index.js';

/** GET /billing — current plan, usage, available plans & providers. */
export const summary = asyncHandler(async (req, res) => {
  const [subscription, usage, plans] = await Promise.all([
    Subscription.findOne({ company: req.companyId }).lean(),
    usageReport(req.companyId),
    Plan.find({ isActive: true }).sort('sortOrder').lean(),
  ]);
  return ok(res, { subscription, usage, plans, providers: payments.availableProviders() });
});

/** GET /billing/invoices */
export const invoices = asyncHandler(async (req, res) => {
  const items = await Payment.find({ company: req.companyId }).sort('-createdAt').limit(100).lean();
  return ok(res, items);
});

/** POST /billing/checkout — start a provider checkout. */
export const checkout = asyncHandler(async (req, res) => {
  const { provider, plan, billingCycle = 'monthly', coupon } = req.body;
  if (!provider || !plan) throw ApiError.badRequest('provider and plan are required');

  const result = await payments.startCheckout({
    companyId: req.companyId,
    providerName: provider,
    planKey: plan,
    billingCycle,
    couponCode: coupon,
    customerEmail: req.user.email,
    baseUrl: config.clientUrl,
  });
  return ok(res, { provider, ...result }, 'Checkout created');
});

/**
 * POST /billing/razorpay/verify — confirm a Razorpay client checkout and
 * activate the plan (Razorpay's success flow is client-driven + signature-verified).
 */
export const verifyRazorpay = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature, plan, billingCycle = 'monthly', amount, currency } = req.body;
  const provider = getProvider('razorpay');
  provider.verifyCallback({ orderId, paymentId, signature });

  const result = await applyPaidPlan({
    companyId: req.companyId,
    planKey: plan,
    billingCycle,
    provider: 'razorpay',
    amount,
    currency,
    providerPaymentId: paymentId,
    providerOrderId: orderId,
  });
  return ok(res, result, 'Payment verified');
});

/** POST /billing/cancel — cancel the subscription, revert to Free limits. */
export const cancel = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOneAndUpdate(
    { company: req.companyId },
    { $set: { status: 'canceled', canceledAt: new Date() } },
    { new: true },
  );
  const free = await Plan.findOne({ key: 'free' }).lean();
  await Company.findByIdAndUpdate(req.companyId, { $set: { plan: 'free', limits: free?.limits } });
  return ok(res, subscription, 'Subscription cancelled');
});
