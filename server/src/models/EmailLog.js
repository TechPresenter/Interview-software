import mongoose from 'mongoose';

const { Schema } = mongoose;

export const EMAIL_STATUS = ['queued', 'scheduled', 'sent', 'mocked', 'failed', 'opened', 'clicked'];

/**
 * One row per outbound email. Powers email history, delivery status, open/click
 * tracking, and resend. `meta.vars` keeps the render variables so a log can be
 * re-rendered and resent.
 */
const emailLogSchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String },
    templateKey: { type: String, index: true },
    category: { type: String },
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    relatedUser: { type: Schema.Types.ObjectId, ref: 'User' },

    status: { type: String, enum: EMAIL_STATUS, default: 'queued', index: true },
    messageId: { type: String },
    error: { type: String },

    openCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    openedAt: { type: Date },
    lastClickAt: { type: Date },

    scheduledFor: { type: Date },
    sentAt: { type: Date },

    meta: { type: Schema.Types.Mixed }, // { vars, ... }
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

emailLogSchema.index({ createdAt: -1 });

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
export default EmailLog;
