import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Kept in lockstep with PROMPT_KEYS in services/ai/prompts/defaults.js. Models do
 * not import from services anywhere in this codebase, so the list is repeated
 * rather than imported; test/prompt.service.test.js fails if the two drift.
 */
export const PROMPT_TEMPLATE_KEYS = [
  'greeting',
  'nextQuestion',
  'followUp',
  'scoreAnswer',
  'finalReport',
  'generateQuestions',
  'generateAnswerKey',
  'analyzeResume',
];

export const PROMPT_TEMPLATE_CATEGORIES = ['interview', 'scoring', 'report', 'generation', 'resume'];

/** How many superseded bodies to keep. Bounded so a long-edited prompt cannot approach the 16MB document ceiling. */
const MAX_VERSIONS = 20;

const versionSchema = new Schema(
  {
    version: { type: Number, required: true },
    system: String,
    template: String,
    note: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * A super-admin-editable AI prompt.
 *
 * `key` names the engine hook this serves (which prompt the interview engine asks
 * for), NOT the row — several templates may exist per key so an admin can keep a
 * variant alongside the built-in, but exactly one may be active at a time. Note
 * the contrast with Template.js, where `key` is globally unique.
 *
 * Bodies are strings with {{placeholders}}; the placeholder bag is precomputed in
 * defaults.js. See that file for why the conditional logic cannot live here.
 */
const promptTemplateSchema = new Schema(
  {
    // Not `index: true`: the partial unique index below is declared on the same
    // {key: 1} pattern, and two indexes with one key pattern but different options
    // are an IndexOptionsConflict at build time.
    key: { type: String, required: true, enum: PROMPT_TEMPLATE_KEYS },
    name: { type: String, required: true },
    description: String,
    category: { type: String, enum: PROMPT_TEMPLATE_CATEGORIES, default: 'interview', index: true },
    system: { type: String, default: '' },
    // The user message body. Required: a blank body would send the model nothing
    // to act on, so prompt.service treats one as "no template" and falls back.
    template: { type: String, required: true },
    // Documented placeholders. Richer than Template.js's [String] because a prompt
    // like nextQuestion carries 19 of them and no admin can infer what
    // `progressLine` holds without a description.
    variables: [
      {
        _id: false,
        name: { type: String, required: true },
        description: String,
      },
    ],
    isActive: { type: Boolean, default: false },
    // Marks the seeded mirror of defaults.js — the row `resetToDefault` restores
    // and the one seeding refreshes metadata on.
    isBuiltIn: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    versions: { type: [versionSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/**
 * The invariant, enforced by Mongo rather than by convention: at most one active
 * template per key. A partial unique index is what makes "two active templates
 * for one key" impossible even under a concurrent write — application-level
 * deactivate-then-activate alone would race.
 *
 * It also serves the hot path: findOne({key, isActive: true}) filters on a
 * superset of the partial expression, so the lookup on every question is covered.
 */
promptTemplateSchema.index(
  { key: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'uniq_active_per_key' },
);

/**
 * Push the current body onto the history stack and bump the version. Call before
 * overwriting `system`/`template` so the superseded text stays recoverable —
 * every save used to destroy the previous prompt irrecoverably.
 *
 * @param {object} doc a PromptTemplate document
 * @param {{userId?: string, note?: string}} [meta]
 */
export function pushVersion(doc, { userId, note } = {}) {
  doc.versions.push({
    version: doc.version,
    system: doc.system,
    template: doc.template,
    note,
    updatedBy: userId,
    updatedAt: new Date(),
  });
  if (doc.versions.length > MAX_VERSIONS) doc.versions = doc.versions.slice(-MAX_VERSIONS);
  doc.version += 1;
}

/**
 * Make `doc` the active template for its key.
 *
 * Siblings are deactivated FIRST because the partial unique index rejects a
 * second active row. That leaves a sub-millisecond window where the key has no
 * active template; a render landing in it falls back to the built-in default
 * rather than failing, which is why this is safe without a transaction (and
 * transactions would need a replica set).
 *
 * @param {object} doc a PromptTemplate document
 */
export async function setActiveTemplate(doc) {
  await PromptTemplate.updateMany(
    { key: doc.key, _id: { $ne: doc._id }, isActive: true },
    { $set: { isActive: false } },
  );
  doc.isActive = true;
  await doc.save();
  return doc;
}

export const PromptTemplate = mongoose.model('PromptTemplate', promptTemplateSchema);
export default PromptTemplate;
