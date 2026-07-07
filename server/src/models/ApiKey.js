import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Company-scoped API key for integrations. The raw key is shown once at creation
 * and never stored — only its SHA-256 hash is kept, plus a display prefix + last4.
 */
const apiKeySchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    prefix: { type: String, required: true },
    last4: { type: String, required: true },
    keyHash: { type: String, required: true, select: false, index: true },
    scopes: { type: [String], default: ['read'] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

apiKeySchema.index({ company: 1, createdAt: -1 });

export const ApiKey = mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
