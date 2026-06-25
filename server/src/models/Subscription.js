import mongoose from 'mongoose';
import { PLAN_VALUES, PLANS } from '../constants/enums.js';

const { Schema } = mongoose;

const subscriptionSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    plan: { type: String, enum: PLAN_VALUES, default: PLANS.FREE },

    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'incomplete'],
      default: 'active',
      index: true,
    },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },

    provider: { type: String, enum: ['stripe', 'razorpay', 'manual'], default: 'manual' },
    providerCustomerId: String,
    providerSubscriptionId: String,

    amount: { type: Number, default: 0 }, // in minor units (cents/paise)
    currency: { type: String, default: 'USD' },

    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEndsAt: Date,
    canceledAt: Date,

    coupon: {
      code: String,
      percentOff: Number,
      amountOff: Number,
    },
  },
  { timestamps: true },
);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
