import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Security/compliance audit trail. Immutable by convention — only ever appended.
 * Captures who did what, from where, and the before/after where relevant.
 */
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },

    action: { type: String, required: true, index: true }, // e.g. 'user.login', 'company.suspend'
    status: { type: String, enum: ['success', 'failure'], default: 'success' },

    entityType: String,
    entityId: { type: Schema.Types.ObjectId },

    ip: String,
    userAgent: String,
    changes: Schema.Types.Mixed, // { before, after }
    meta: Schema.Types.Mixed,
  },
  { timestamps: true },
);

auditLogSchema.index({ company: 1, action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
