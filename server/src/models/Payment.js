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

    amount: { type: Number, required: true }, // minor units
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: PAYMENT_STATUS, default: 'created', index: true },

    invoiceNumber: { type: String, unique: true, sparse: true },
    invoiceUrl: String,

    description: String,
    receiptEmail: String,
    paidAt: Date,
    raw: Schema.Types.Mixed, // provider webhook payload for audit
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
