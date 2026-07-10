import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Generic first-party analytics event — the extensible backbone for CTA clicks,
 * feature usage, custom events, scroll depth, outbound links, form submits, and
 * errors. New event types need NO schema change: give a `name` + `category` and
 * stash anything else in `props`. Aggregations live in analytics.dashboard.service.
 *
 * Distinct from PageView (one doc per route change); an Event is any tracked
 * interaction. Device/geo are captured the same way as page views.
 */
const analyticsEventSchema = new Schema(
  {
    name: { type: String, required: true, index: true }, // e.g. 'get_started', 'ai_chat', 'resume_upload'
    category: { type: String, default: 'event', index: true }, // cta | feature | event | form | scroll | outbound | error | api
    visitorId: { type: String, index: true },
    sessionId: { type: String, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // set server-side if the beacon is authenticated
    path: { type: String },
    referrer: { type: String },
    source: { type: String },
    medium: { type: String },
    device: { type: String, enum: ['desktop', 'mobile', 'tablet', 'other'], default: 'other', index: true },
    os: { type: String },
    browser: { type: String },
    country: { type: String, index: true },
    region: { type: String },
    city: { type: String },
    /** Arbitrary event payload (label, href, depth %, feature area, value, …). */
    props: { type: Schema.Types.Mixed, default: {} },
    /** Optional numeric value for conversion / revenue events. */
    value: { type: Number },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ category: 1, name: 1, createdAt: -1 });

export const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
export default AnalyticsEvent;
