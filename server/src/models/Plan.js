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
      currency: { type: String, default: 'INR' },
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

/**
 * Seed-friendly defaults for the four standard tiers (India / INR pricing).
 * Prices are in minor units (paise): ₹9,999 = 999900. Yearly = 10× monthly
 * (two months free). "Unlimited" tiers use a very high numeric limit.
 *
 * Tiers differ by usage limits alone. Every capability is available on every
 * plan — the catalog lives in constants/platformFeatures.js, and no code path
 * reads a company's plan before serving a capability. So `features` below
 * carries only this tier's quotas plus its human service level: a capability
 * bullet here would imply a gate that nothing enforces, which is how the
 * per-tier drift started the last time.
 *
 * Every quota bullet below must have a matching branch in limits.service.js
 * assertWithinLimit — all four now do (activeJobs, interviews, seats, aiTokens).
 * Advertising a quota the code does not enforce is the same unkept promise as
 * advertising a feature gate that does not exist, so if you add a bullet here,
 * add the check first.
 */
planSchema.statics.defaults = function defaults() {
  return [
    {
      key: PLANS.FREE,
      name: 'Free Trial',
      // The Free gate is the one-time interview allowance, not a clock: nothing
      // expires a Free company (jobs/reminders.js only emails 'trialing' subs).
      description: 'Free · 3 one-time interviews',
      pricing: { monthly: 0, yearly: 0, currency: 'INR' },
      limits: { seats: 1, activeJobs: 1, interviewsPerMonth: 3, aiTokensPerMonth: 50_000 },
      features: [
        '3 AI interviews (one-time)',
        '1 active job',
        '1 team member',
        '50K AI tokens / month',
        'Every platform feature included',
        'Email support',
      ],
      sortOrder: 0,
    },
    {
      key: PLANS.STARTER,
      name: 'Starter',
      pricing: { monthly: 999900, yearly: 9999000, currency: 'INR' },
      limits: { seats: 5, activeJobs: 10, interviewsPerMonth: 100, aiTokensPerMonth: 2_000_000 },
      features: [
        '100 AI interviews / month',
        '10 active jobs',
        '5 team members',
        '2M AI tokens / month',
        'Every platform feature included',
        'Email support',
      ],
      sortOrder: 1,
    },
    {
      key: PLANS.PROFESSIONAL,
      name: 'Professional',
      description: 'Most Popular',
      pricing: { monthly: 2499900, yearly: 24999000, currency: 'INR' },
      limits: { seats: 25, activeJobs: 999_999, interviewsPerMonth: 250, aiTokensPerMonth: 20_000_000 },
      features: [
        '250 AI interviews / month',
        'Unlimited active jobs',
        '25 team members',
        '20M AI tokens / month',
        'Every platform feature included',
        'Priority support',
      ],
      isPopular: true,
      sortOrder: 2,
    },
    {
      key: PLANS.ENTERPRISE,
      name: 'Enterprise',
      description: 'Custom Pricing',
      pricing: { monthly: 0, yearly: 0, currency: 'INR' }, // contact sales / custom
      limits: { seats: 999_999, activeJobs: 999_999, interviewsPerMonth: 999_999, aiTokensPerMonth: 1_000_000_000 },
      features: [
        'Unlimited AI interviews',
        'Unlimited active jobs',
        'Unlimited team members',
        'Unlimited AI tokens',
        'Every platform feature included',
        'Dedicated account manager',
        'SLA & onboarding support',
      ],
      sortOrder: 3,
    },
  ];
};

export const Plan = mongoose.model('Plan', planSchema);
export default Plan;
