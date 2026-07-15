import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One row per Claude API call. Powers super-admin AI usage analytics and
 * per-company token quota enforcement.
 */
const aiUsageSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    provider: { type: Schema.Types.ObjectId, ref: 'AiProvider', index: true },
    providerType: { type: String },
    feature: {
      type: String,
      // Keep in sync with AI_MODULES (models/AiProvider.js) and the `feature`
      // names the services pass. A missing name throws a ValidationError that
      // recordUsage swallows, so the call's tokens/cost vanish from analytics
      // with only a log line — question_generation/answer_key did exactly that.
      enum: [
        'interview', 'scoring', 'report', 'resume',
        'question_generation', 'answer_key',
        'chat', 'content', 'image', 'embeddings', 'test', 'other',
      ],
      required: true,
      index: true,
    },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    latencyMs: { type: Number },
    success: { type: Boolean, default: true },
    interview: { type: Schema.Types.ObjectId, ref: 'Interview' },
  },
  { timestamps: true },
);

aiUsageSchema.index({ company: 1, createdAt: -1 });
aiUsageSchema.index({ feature: 1, createdAt: -1 });
aiUsageSchema.index({ provider: 1, createdAt: -1 });

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);
export default AiUsage;
