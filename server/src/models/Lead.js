import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Website leads: contact-form enquiries and newsletter subscriptions.
 * Captured from the public site and managed in the Super-Admin panel.
 */
const leadSchema = new Schema(
  {
    type: { type: String, enum: ['contact', 'newsletter'], required: true, index: true },
    name: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    subject: { type: String, trim: true },
    message: { type: String, trim: true },
    source: { type: String, default: 'website' },
    status: { type: String, enum: ['new', 'in_progress', 'resolved', 'archived'], default: 'new', index: true },
    notes: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

leadSchema.index({ createdAt: -1 });
// One newsletter subscription per email; contact enquiries may repeat.
leadSchema.index({ type: 1, email: 1 }, { unique: true, partialFilterExpression: { type: 'newsletter' } });

export const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
