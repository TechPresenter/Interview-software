import mongoose from 'mongoose';
import { COMPANY_STATUS, PLANS, PLAN_VALUES } from '../constants/enums.js';

const { Schema } = mongoose;

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    logo: { type: String },
    website: { type: String },
    industry: { type: String },
    size: { type: String }, // e.g. "1-10", "11-50", ...
    about: { type: String, maxlength: 2000 },

    owner: { type: Schema.Types.ObjectId, ref: 'User' },

    status: { type: String, enum: COMPANY_STATUS, default: 'active', index: true },

    // Denormalized subscription snapshot for fast gating; source of truth is the
    // Subscription collection.
    plan: { type: String, enum: PLAN_VALUES, default: PLANS.FREE },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },

    // Usage limits derived from plan (enforced by middleware/services).
    limits: {
      seats: { type: Number, default: 3 },
      activeJobs: { type: Number, default: 3 },
      interviewsPerMonth: { type: Number, default: 50 },
      aiTokensPerMonth: { type: Number, default: 500_000 },
    },

    // Per-company branding for the candidate experience.
    branding: {
      primaryColor: { type: String, default: '#6366f1' },
      accentColor: { type: String, default: '#22d3ee' },
    },

    // Company-customizable AI interviewer shown to candidates.
    aiInterviewer: {
      name: { type: String, default: 'Sense' },
      avatarUrl: { type: String },
      voice: { type: String, enum: ['female', 'male', 'auto'], default: 'female' },
      intro: { type: String }, // optional custom opening line spoken to candidates
    },

    contactEmail: { type: String, lowercase: true },
    billingEmail: { type: String, lowercase: true },

    // Per-company outbound email (SMTP). `pass` is encrypted at rest. When
    // enabled + host set, the email service uses this instead of the global one.
    emailConfig: {
      enabled: { type: Boolean, default: false },
      host: { type: String, trim: true },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      user: { type: String, trim: true },
      pass: { type: String, select: false }, // encrypted blob
      fromName: { type: String, trim: true },
      fromEmail: { type: String, lowercase: true, trim: true },
      signature: { type: String },

      // Connected Gmail account (OAuth 2.0). When connected, outgoing email is
      // sent through this Gmail account via the Gmail SMTP + OAuth2 transport.
      // Refresh token is encrypted at rest; access token is a short-lived cache.
      gmail: {
        connected: { type: Boolean, default: false },
        email: { type: String, lowercase: true, trim: true },
        refreshToken: { type: String, select: false }, // encrypted blob
        scope: { type: String },
        connectedAt: { type: Date },
      },
    },
  },
  { timestamps: true },
);

export const Company = mongoose.model('Company', companySchema);
export default Company;
