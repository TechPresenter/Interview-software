import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Lightweight activity feed (product-level events) — powers "Live Activity Feed"
 * dashboards. Distinct from AuditLog, which is security/compliance-grade.
 */
const activityLogSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. 'interview.completed'
    entityType: { type: String }, // e.g. 'Interview'
    entityId: { type: Schema.Types.ObjectId },
    summary: { type: String },
    meta: Schema.Types.Mixed,
  },
  { timestamps: true },
);

activityLogSchema.index({ company: 1, createdAt: -1 });
// Auto-expire activity feed entries after 90 days.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
