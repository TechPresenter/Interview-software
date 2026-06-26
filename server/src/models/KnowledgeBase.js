import mongoose from 'mongoose';

const { Schema } = mongoose;

export const KB_SCOPES = ['company', 'job', 'interview', 'global'];
export const KB_SOURCE_KINDS = ['file', 'url', 'text'];

/** A single ingested source within a knowledge base. */
const sourceSchema = new Schema(
  {
    kind: { type: String, enum: KB_SOURCE_KINDS, required: true },
    label: { type: String }, // filename / url / "Pasted text"
    url: { type: String }, // stored file path or original URL
    mime: { type: String },
    bytes: { type: Number },
    chars: { type: Number, default: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * Knowledge Base: uploaded reference material that drives KB-grounded interviews.
 * The AI generates and follows up on questions using ONLY this content. A KB can
 * be scoped to a company, a specific job/role, or a single interview round.
 */
const knowledgeBaseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    company: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: true }, // null = global (super-admin)
    scope: { type: String, enum: KB_SCOPES, default: 'company' },
    job: { type: Schema.Types.ObjectId, ref: 'Job', default: null, index: true },

    sources: { type: [sourceSchema], default: [] },
    content: { type: String, default: '', select: false }, // full extracted text (large)
    chunks: { type: [{ text: String, source: String }], default: [], select: false },
    topics: { type: [String], default: [] },
    summary: { type: String },

    charCount: { type: Number, default: 0 },
    tokensApprox: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    lastIndexedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

knowledgeBaseSchema.index({ company: 1, status: 1 });

export const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
export default KnowledgeBase;
