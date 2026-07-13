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
 */
planSchema.statics.defaults = function defaults() {
  return [
    {
      key: PLANS.FREE,
      name: 'Free Trial',
      description: 'Free · valid for 7 days',
      pricing: { monthly: 0, yearly: 0, currency: 'INR' },
      limits: { seats: 1, activeJobs: 1, interviewsPerMonth: 3, aiTokensPerMonth: 50_000 },
      features: [
        '3 AI Interviews (one-time)',
        '1 Active Job',
        'Resume Upload',
        'Basic Dashboard',
        'Email Support',
        'Valid for 7 Days',
      ],
      sortOrder: 0,
    },
    {
      key: PLANS.STARTER,
      name: 'Starter',
      pricing: { monthly: 999900, yearly: 9999000, currency: 'INR' },
      limits: { seats: 5, activeJobs: 10, interviewsPerMonth: 100, aiTokensPerMonth: 2_000_000 },
      features: [
        'Up to 100 AI Interviews / month',
        'Up to 10 Active Jobs',
        'Resume Analysis & Scoring',
        'AI Candidate Ranking',
        'Interview Reports',
        'Email Support',
        'Up to 5 Team Members',
      ],
      sortOrder: 1,
    },
    {
      key: PLANS.PROFESSIONAL,
      name: 'Professional',
      description: 'Most Popular',
      pricing: { monthly: 2499900, yearly: 24999000, currency: 'INR' },
      limits: { seats: 25, activeJobs: 999_999, interviewsPerMonth: 2500, aiTokensPerMonth: 20_000_000 },
      features: [
        'Up to 2,500 AI Interviews / month',
        'Unlimited Active Jobs',
        'AI Resume Screening',
        'AI Candidate Ranking',
        'Anti-Cheat Monitoring',
        'Video Interview Recording',
        'Custom Interview Templates',
        'Analytics Dashboard',
        'Priority Support',
        'Up to 25 Team Members',
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
        'Unlimited AI Interviews',
        'Unlimited Active Jobs',
        'Custom AI Evaluation Weightage',
        'SSO & Enterprise Security',
        'API Access',
        'ATS & HRMS Integrations',
        'White Label Solution',
        'Dedicated Account Manager',
        'SLA & Onboarding Support',
        'Unlimited Team Members',
      ],
      sortOrder: 3,
    },
  ];
};

export const Plan = mongoose.model('Plan', planSchema);
export default Plan;
