import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * First-party web-analytics event — one document per page view. Sessions,
 * unique visitors, bounce rate, sources, geo and device breakdowns are all
 * derived from these at query time (see services/analytics.dashboard.service).
 */
const pageViewSchema = new Schema(
  {
    visitorId: { type: String, index: true }, // persistent anon id (localStorage)
    sessionId: { type: String, index: true }, // 30-min sliding session (sessionStorage)
    path: { type: String },
    referrer: { type: String },
    source: { type: String }, // utm_source or derived referrer host
    medium: { type: String, index: true }, // direct | organic | referral | social | utm_medium
    campaign: { type: String }, // utm_campaign
    device: { type: String, enum: ['desktop', 'mobile', 'tablet', 'other'], default: 'other', index: true },
    os: { type: String },
    browser: { type: String },
    country: { type: String, index: true },
    region: { type: String },
    city: { type: String },
    isNewVisitor: { type: Boolean, default: false },
  },
  { timestamps: true },
);

pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ sessionId: 1, createdAt: 1 });

export const PageView = mongoose.model('PageView', pageViewSchema);
export default PageView;
