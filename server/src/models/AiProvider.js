import mongoose from 'mongoose';
import { decryptSecret } from '../utils/crypto.js';

const { Schema } = mongoose;

export const PROVIDER_TYPES = [
  'claude',
  'openai',
  'gemini',
  'grok',
  'deepseek',
  'mistral',
  'azure_openai',
  'groq',
  'openrouter',
  'custom',
];

/** Modules a provider can be assigned to serve. */
/**
 * Modules a provider can be routed to. These MUST stay in sync with the
 * `feature` names the AI services actually pass to complete()/completeJson() —
 * a feature name missing here cannot be routed in the admin UI and only reaches
 * a provider through the isDefault escape hatch.
 */
export const AI_MODULES = [
  'chat', 'content', 'image', 'embeddings',
  'interview', 'scoring', 'report', 'resume',
  'question_generation', 'answer_key',
];

/**
 * Configurable AI provider. Super-admins register multiple providers and route
 * them to modules. API keys are stored AES-256-GCM encrypted (see utils/crypto).
 * The registry (services/ai/registry.js) resolves + fails over between them.
 */
const aiProviderSchema = new Schema(
  {
    label: { type: String, required: true }, // e.g. "OpenAI (Prod)"
    type: { type: String, enum: PROVIDER_TYPES, required: true, index: true },
    apiKey: { type: String, select: false }, // encrypted at rest

    // Connection / request config
    baseUrl: { type: String }, // custom endpoint / proxy / azure resource
    apiVersion: { type: String }, // azure api-version / anthropic-version
    organization: { type: String }, // OpenAI org id
    projectId: { type: String }, // OpenAI / GCP project id
    model: { type: String },
    timeoutMs: { type: Number, default: 30000 },
    maxRetries: { type: Number, default: 2 },
    rateLimitPerMin: { type: Number },
    rateLimitPerDay: { type: Number },

    // Routing
    modules: { type: [String], default: [] }, // which modules this provider serves
    priority: { type: Number, default: 100 }, // lower = tried first on failover
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    company: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: true }, // null = global / platform

    // Health (updated by the registry + test connection)
    health: { type: String, enum: ['unknown', 'healthy', 'degraded', 'down'], default: 'unknown' },
    lastSuccessAt: { type: Date },
    lastErrorAt: { type: Date },
    lastError: { type: String },
    lastLatencyMs: { type: Number },

    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/** Only one provider is the default within a scope (global vs a given company). */
aiProviderSchema.statics.setDefault = async function setDefault(id) {
  const doc = await this.findById(id);
  if (!doc) return null;
  await this.updateMany({ company: doc.company ?? null, isDefault: true }, { $set: { isDefault: false } });
  return this.findByIdAndUpdate(id, { $set: { isDefault: true, isActive: true } }, { new: true });
};

/** Decrypt the stored API key. Requires the apiKey field to be selected. */
aiProviderSchema.methods.getApiKey = function getApiKey() {
  return this.apiKey ? decryptSecret(this.apiKey) : null;
};

export const AiProvider = mongoose.model('AiProvider', aiProviderSchema);
export default AiProvider;
