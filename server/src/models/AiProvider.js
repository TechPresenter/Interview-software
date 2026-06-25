import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PROVIDER_TYPES = ['claude', 'gemini', 'openai', 'azure_openai', 'groq', 'openrouter', 'custom'];

/**
 * Configurable AI provider. The super-admin can register multiple providers and
 * mark one as default. The interview/scoring engines read the default provider.
 *
 * NOTE: Claude is the live-wired implementation today; other types store config
 * and can be activated as adapters are added (see services/ai/claude.client.js).
 */
const aiProviderSchema = new Schema(
  {
    label: { type: String, required: true }, // display name e.g. "Claude (Prod)"
    type: { type: String, enum: PROVIDER_TYPES, required: true, index: true },
    apiKey: { type: String, select: false }, // secret
    baseUrl: { type: String }, // for openrouter / azure / custom
    model: { type: String },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    rateLimitPerMin: { type: Number },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/** Only one provider can be the default at a time. */
aiProviderSchema.statics.setDefault = async function setDefault(id) {
  await this.updateMany({ isDefault: true }, { $set: { isDefault: false } });
  return this.findByIdAndUpdate(id, { $set: { isDefault: true, isActive: true } }, { new: true });
};

export const AiProvider = mongoose.model('AiProvider', aiProviderSchema);
export default AiProvider;
