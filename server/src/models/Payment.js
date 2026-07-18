import mongoose from 'mongoose';
import { PAYMENT_STATUS, PAYMENT_PROVIDERS } from '../constants/enums.js';

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },

    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    providerPaymentId: { type: String, index: true },
    providerOrderId: String,

    amount: { type: Number, required: true }, // minor units (paise)
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: PAYMENT_STATUS, default: 'created', index: true },

    invoiceNumber: { type: String, unique: true, sparse: true },
    invoiceUrl: String,

    description: String,
    receiptEmail: String,
    paidAt: Date,
    raw: Schema.Types.Mixed, // provider webhook payload for audit

    /** How they paid, as the gateway reported it (upi / card / netbanking …). */
    method: String,

    /**
     * GST snapshot taken AT PAYMENT TIME (minor units). The invoice must keep
     * saying what was actually charged — deriving tax from live config at
     * download time silently rewrites historical invoices when the rate changes.
     * Prices are GST-inclusive, so taxable + tax === amount.
     */
    tax: {
      percent: Number,
      taxable: Number,
      tax: Number,
      gstin: String, // seller GSTIN as it stood that day
    },

    /** The discount actually applied, so the invoice can show it. */
    coupon: { code: String, discount: Number },

    failureReason: String,
    refundedAt: Date,

    /** The plan/cycle this payment bought, kept even if the Plan doc changes. */
    planKey: String,
    billingCycle: { type: String, enum: ['monthly', 'yearly'] },
  },
  { timestamps: true },
);

/**
 * The real duplicate-activation guard. applyPaidPlan's check-then-create can
 * race (a webhook retry + the return-page verify land together); only a unique
 * index makes the second insert fail instead of double-charging the record.
 * Partial with $gt:'' so rows without a gateway payment id stay unconstrained.
 */
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $exists: true, $gt: '' } }, name: 'one_per_provider_payment' },
);
// One PAID row per gateway order (an order may have failed attempts before the
// one that succeeded, so uniqueness only holds over paid rows).
paymentSchema.index(
  { provider: 1, providerOrderId: 1 },
  { unique: true, partialFilterExpression: { providerOrderId: { $exists: true, $gt: '' }, status: 'paid' }, name: 'one_paid_per_order' },
);
paymentSchema.index({ createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
