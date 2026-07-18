import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { config } from '../../config/index.js';
import { Plan } from '../../models/Plan.js';
import { Subscription } from '../../models/Subscription.js';
import { Payment } from '../../models/Payment.js';
import { Company } from '../../models/Company.js';
import { Branding } from '../../models/Branding.js';
import { usageReport } from '../../services/limits.service.js';
import { invoiceToPdf } from '../../services/export.service.js';
import * as payments from '../../services/payment/index.js';
import { getProvider, applyPaidPlan } from '../../services/payment/index.js';

/** GET /billing — current plan, usage, available plans & providers. */
export const summary = asyncHandler(async (req, res) => {
  const [subscription, usage, plans] = await Promise.all([
    Subscription.findOne({ company: req.companyId }).lean(),
    usageReport(req.companyId),
    Plan.find({ isActive: true }).sort('sortOrder').lean(),
  ]);
  return ok(res, {
    subscription,
    usage,
    plans,
    providers: payments.availableProviders(),
    defaultProvider: payments.defaultProvider(), // Cashfree by default
  });
});

/** GET /billing/invoices */
export const invoices = asyncHandler(async (req, res) => {
  // 'created' rows are transient activation claims (or abandoned checkouts),
  // not invoices — showing them reads as "you owe us money you already paid".
  const items = await Payment.find({ company: req.companyId, status: { $ne: 'created' } })
    .sort('-createdAt')
    .limit(100)
    .lean();
  return ok(res, items);
});

/** GET /billing/invoices/:id/pdf — download a payment as a branded PDF invoice. */
export const invoicePdf = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, company: req.companyId }).lean();
  if (!payment) throw ApiError.notFound('Invoice not found');
  const [company, branding] = await Promise.all([Company.findById(req.companyId).lean(), Branding.getGlobal()]);
  const { buffer, filename, contentType } = await invoiceToPdf({ payment, company, branding });
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

/** POST /billing/checkout — start a provider checkout. */
export const checkout = asyncHandler(async (req, res) => {
  const { plan, billingCycle = 'monthly', coupon } = req.body;
  // Default to the platform gateway (Cashfree) when the client doesn't specify.
  const provider = req.body.provider || payments.defaultProvider();
  if (!plan) throw ApiError.badRequest('plan is required');

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

/** The receipt shape the success page renders. Field-by-field on purpose. */
function receiptOf(payment) {
  if (!payment) return null;
  const p = payment.toObject ? payment.toObject() : payment;
  return {
    _id: p._id, // for the invoice PDF download
    invoiceNumber: p.invoiceNumber,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method || p.provider,
    provider: p.provider,
    providerPaymentId: p.providerPaymentId,
    providerOrderId: p.providerOrderId,
    planKey: p.planKey,
    billingCycle: p.billingCycle,
    description: p.description,
    paidAt: p.paidAt,
    tax: p.tax,
  };
}

/**
 * POST /billing/cashfree/verify — the return-from-gateway activation path.
 *
 * The webhook is the primary confirmation; this makes the flow survive a
 * webhook that is late, unregistered, or lost. The order is fetched from
 * Cashfree with OUR credentials and pinned to the calling company — nothing
 * the browser says is trusted, so calling this cannot activate anything that
 * wasn't genuinely paid.
 */
export const verifyCashfree = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw ApiError.badRequest('orderId is required');

  const result = await payments.verifyCashfreeOrder({ companyId: req.companyId, orderId });
  if (result.status !== 'paid') {
    return ok(res, { status: result.status, orderStatus: result.orderStatus });
  }

  const subscription = await Subscription.findOne({ company: req.companyId }).lean();
  return ok(
    res,
    { status: 'paid', duplicate: Boolean(result.duplicate), payment: receiptOf(result.payment), subscription },
    'Subscription activated',
  );
});

/**
 * GET /billing/receipt?orderId= — receipt lookup for the success page when the
 * webhook already activated the plan before the browser got back.
 */
export const receipt = asyncHandler(async (req, res) => {
  const { orderId } = req.query;
  if (!orderId) throw ApiError.badRequest('orderId is required');
  const payment = await Payment.findOne({ company: req.companyId, providerOrderId: orderId, status: 'paid' }).lean();
  if (!payment) throw ApiError.notFound('No paid invoice for that order yet');
  const subscription = await Subscription.findOne({ company: req.companyId }).lean();
  return ok(res, { status: 'paid', payment: receiptOf(payment), subscription });
});

/**
 * POST /billing/razorpay/verify — confirm a Razorpay client checkout and
 * activate the plan (Razorpay's success flow is client-driven + signature-verified).
 */
export const verifyRazorpay = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  const provider = getProvider('razorpay');
  provider.verifyCallback({ orderId, paymentId, signature });

  /**
   * The signature only proves "this payment id belongs to this order id" — it
   * says nothing about how much was paid or for what. Everything else is
   * anchored to the ORDER as Razorpay stores it: its notes carry the plan,
   * cycle and company WE stamped at checkout, and its amount is what checkout
   * actually charged. Nothing plan- or price-shaped is taken from the request
   * body — and comparing against a live re-priced plan would wrongly reject a
   * genuine payment the moment an admin edits the price mid-checkout.
   */
  const [rp, order] = await Promise.all([provider.fetchPayment(paymentId), provider.fetchOrder(orderId)]);
  if (rp.order_id !== orderId) throw ApiError.badRequest('Payment does not belong to that order');
  // Only settled money activates a plan. 'authorized' is a hold, not a charge —
  // it can still be voided or expire without capture.
  if (rp.status !== 'captured') throw ApiError.badRequest('Payment is not captured yet');
  if (Number(rp.amount) !== Number(order.amount)) throw ApiError.badRequest('Paid amount does not match the order');

  const notes = order.notes || {};
  if (String(notes.company || '') !== String(req.companyId)) {
    throw ApiError.forbidden('That payment does not belong to this workspace', { code: 'ORDER_TENANT_MISMATCH' });
  }

  const result = await applyPaidPlan({
    companyId: req.companyId,
    planKey: notes.plan,
    billingCycle: notes.billingCycle || 'monthly',
    provider: 'razorpay',
    amount: Number(order.amount),
    currency: order.currency || rp.currency || 'INR',
    providerPaymentId: paymentId,
    providerOrderId: orderId,
    method: rp.method,
    couponCode: notes.coupon,
    raw: rp,
  });
  return ok(res, { ...result, payment: receiptOf(result.payment) }, 'Payment verified');
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
