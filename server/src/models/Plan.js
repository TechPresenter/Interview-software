import mongoose from 'mongoose';
import { PLAN_VALUES, PLANS } from '../constants/enums.js';

const { Schema } = mongoose;

/**
 * Subscription plan catalog managed by the super-admin. The `limits` here become
 * a Company's `limits` snapshot when it subscribes.
 */
const planSchema = new Schema(
  {
    key: { type: String, enum: PLAN_VALUES, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },

    // Pricing in minor units (cents/paise).
    pricing: {
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' },
    },

    limits: {
      seats: { type: Number, default: 3 },
      activeJobs: { type: Number, default: 3 },
      interviewsPerMonth: { type: Number, default: 50 },
      aiTokensPerMonth: { type: Number, default: 500_000 },
    },

    features: [String], // marketing bullet points
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/** Seed-friendly defaults for the four standard tiers. */
planSchema.statics.defaults = function defaults() {
  return [
    {
      key: PLANS.FREE,
      name: 'Free',
      pricing: { monthly: 0, yearly: 0 },
      limits: { seats: 2, activeJobs: 1, interviewsPerMonth: 15, aiTokensPerMonth: 100_000 },
      features: ['1 active job', '15 AI interviews / mo', 'Basic reports'],
      sortOrder: 0,
    },
    {
      key: PLANS.STARTER,
      name: 'Starter',
      pricing: { monthly: 4900, yearly: 49000 },
      limits: { seats: 5, activeJobs: 5, interviewsPerMonth: 100, aiTokensPerMonth: 1_000_000 },
      features: ['5 active jobs', '100 AI interviews / mo', 'Resume analysis', 'Email support'],
      sortOrder: 1,
    },
    {
      key: PLANS.PROFESSIONAL,
      name: 'Professional',
      pricing: { monthly: 14900, yearly: 149000 },
      limits: { seats: 20, activeJobs: 25, interviewsPerMonth: 500, aiTokensPerMonth: 5_000_000 },
      features: ['25 active jobs', '500 AI interviews / mo', 'Anti-cheat proctoring', 'Priority support'],
      isPopular: true,
      sortOrder: 2,
    },
    {
      key: PLANS.ENTERPRISE,
      name: 'Enterprise',
      pricing: { monthly: 0, yearly: 0 }, // contact sales / custom
      limits: { seats: 1000, activeJobs: 1000, interviewsPerMonth: 100_000, aiTokensPerMonth: 100_000_000 },
      features: ['Unlimited jobs', 'Custom AI weightage', 'SSO & audit logs', 'Dedicated CSM'],
      sortOrder: 3,
    },
  ];
};

export const Plan = mongoose.model('Plan', planSchema);
export default Plan;
