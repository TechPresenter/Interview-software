import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';
import { PromptTemplate, pushVersion, setActiveTemplate } from '../../models/PromptTemplate.js';
import { previewPrompt, invalidatePromptCache } from '../../services/ai/prompt.service.js';
import { DEFAULT_PROMPTS, PROMPT_KEYS } from '../../services/ai/prompts/defaults.js';

/**
 * Super-admin CRUD over the AI prompt templates.
 *
 * Every write invalidates the render cache, which is what lets an edit reach the
 * next question without a restart. Reads go straight to PromptTemplate rather
 * than through the settings store — prompts are no longer key/value settings, and
 * settings.getGroup('ai') would mask any key matching /key/i (which
 * 'generateAnswerKey' does) and export a row of bullets in place of the prompt.
 */

const byId = async (id) => {
  const doc = await PromptTemplate.findById(id);
  if (!doc) throw ApiError.notFound('Prompt template not found');
  return doc;
};

/** GET /admin/prompts — every template, newest first, optionally filtered. */
export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.key) filter.key = req.query.key;
  if (req.query.category) filter.category = req.query.category;
  // The bodies are large and the list only needs to summarise them.
  const docs = await PromptTemplate.find(filter).select('-versions').sort({ key: 1, createdAt: -1 }).lean();
  return ok(res, {
    templates: docs,
    keys: PROMPT_KEYS.map((key) => ({
      key,
      name: DEFAULT_PROMPTS[key].name,
      category: DEFAULT_PROMPTS[key].category,
      description: DEFAULT_PROMPTS[key].description,
      variables: DEFAULT_PROMPTS[key].variables,
      // True when the built-in is what runs today, so the UI need not guess.
      usingDefault: !docs.some((d) => d.key === key && d.isActive),
    })),
  });
});

/** GET /admin/prompts/:id */
export const getOne = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  return ok(res, doc);
});

/** POST /admin/prompts — add a template for an existing engine key. */
export const create = asyncHandler(async (req, res) => {
  const { key, name, description, system, template, variables, isActive } = req.body;
  if (!PROMPT_KEYS.includes(key)) {
    throw ApiError.badRequest(`Unknown prompt key "${key}"`, { details: { allowed: PROMPT_KEYS } });
  }
  if (!String(template || '').trim()) throw ApiError.badRequest('Template body is required');

  const def = DEFAULT_PROMPTS[key];
  const doc = await PromptTemplate.create({
    key,
    name: name || `${def.name} (custom)`,
    description,
    category: def.category,
    system: system ?? '',
    template,
    // Default to the built-in's documented placeholders; a custom template uses
    // the same precomputed bag, so the list is the same unless told otherwise.
    variables: variables?.length ? variables : def.variables,
    isBuiltIn: false,
    updatedBy: req.user._id,
  });
  if (isActive) await setActiveTemplate(doc);

  invalidatePromptCache(key);
  await audit({ req, action: 'ai.prompt.create', entityType: 'PromptTemplate', entityId: doc._id, meta: { key } });
  return created(res, doc, 'Prompt template created');
});

/** PUT /admin/prompts/:id — edit a body; the superseded text is kept as a version. */
export const update = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  const { name, description, category, system, template, variables, isActive, note } = req.body;
  if (template !== undefined && !String(template).trim()) {
    throw ApiError.badRequest('Template body cannot be empty');
  }

  // Only a body change is worth a version entry; renaming is not.
  const bodyChanged = (system !== undefined && system !== doc.system)
    || (template !== undefined && template !== doc.template);
  if (bodyChanged) pushVersion(doc, { userId: req.user._id, note });

  if (name !== undefined) doc.name = name;
  if (description !== undefined) doc.description = description;
  if (category !== undefined) doc.category = category;
  if (system !== undefined) doc.system = system;
  if (template !== undefined) doc.template = template;
  if (variables !== undefined) doc.variables = variables;
  doc.updatedBy = req.user._id;
  await doc.save();

  // The validator accepts isActive, so ignoring it here answered 200 while the
  // template stayed dormant — the precise silent-save failure this rewrite exists
  // to end. Activation goes through setActiveTemplate so the one-active-per-key
  // rule holds.
  if (isActive === true && !doc.isActive) {
    await setActiveTemplate(doc);
  } else if (isActive === false && doc.isActive) {
    doc.isActive = false;
    await doc.save();
  }

  invalidatePromptCache(doc.key);
  await audit({ req, action: 'ai.prompt.update', entityType: 'PromptTemplate', entityId: doc._id, meta: { key: doc.key, version: doc.version } });
  return ok(res, doc, 'Prompt template saved');
});

/** DELETE /admin/prompts/:id */
export const remove = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  if (doc.isActive) {
    const siblings = await PromptTemplate.countDocuments({ key: doc.key, _id: { $ne: doc._id } });
    if (!siblings) {
      throw ApiError.badRequest(
        `"${doc.name}" is the only template for "${doc.key}" and is live. Create a replacement and activate it before deleting this one, or reset it to the built-in instead.`,
      );
    }
  }
  await doc.deleteOne();

  invalidatePromptCache(doc.key);
  await audit({ req, action: 'ai.prompt.delete', entityType: 'PromptTemplate', entityId: doc._id, meta: { key: doc.key } });
  return ok(res, { id: doc._id }, 'Prompt template deleted');
});

/** PATCH /admin/prompts/:id/activate — make this the live template for its key. */
export const setActive = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  await setActiveTemplate(doc);

  invalidatePromptCache(doc.key);
  await audit({ req, action: 'ai.prompt.activate', entityType: 'PromptTemplate', entityId: doc._id, meta: { key: doc.key } });
  return ok(res, doc, `"${doc.name}" is now live for ${doc.key}`);
});

/** PATCH /admin/prompts/:id/toggle — enable or disable. Disabling reverts the key to the built-in. */
export const toggle = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  if (doc.isActive) {
    doc.isActive = false;
    await doc.save();
  } else {
    await setActiveTemplate(doc);
  }

  invalidatePromptCache(doc.key);
  await audit({ req, action: 'ai.prompt.toggle', entityType: 'PromptTemplate', entityId: doc._id, meta: { key: doc.key, isActive: doc.isActive } });
  return ok(res, doc, doc.isActive ? 'Prompt template enabled' : 'Prompt template disabled — the built-in is live again');
});

/**
 * Stand-in engine arguments for previews, in the shape the engines really pass
 * (defaults.js `vars()` flattens them). Without these every placeholder renders
 * empty and the "renders empty" warning becomes noise that hides a real typo.
 * One merged object serves all eight prompts — each vars() takes only what it needs.
 */
const PREVIEW_INPUT = {
  candidateName: 'Asha Menon',
  jobTitle: 'Senior Backend Engineer',
  jobDescription: 'Own the payments ledger and its reconciliation pipeline. High volume, idempotency-critical.',
  department: 'Engineering',
  industry: 'software_development',
  interviewType: 'technical',
  round: 'technical',
  difficulty: 'hard',
  language: 'en',
  skills: [{ name: 'node', weight: 3, required: true }, { name: 'postgres', weight: 2 }],
  requiredSkills: ['node', 'postgres'],
  experienceLevel: 'senior',
  yearsExperience: 6,
  education: 'B.Tech, Computer Science',
  certifications: ['AWS Solutions Architect'],
  durationMinutes: 45,
  questionCount: 8,
  questionNumber: 3,
  minutesRemaining: 19,
  count: 5,
  types: ['technical', 'scenario'],
  askedQuestions: ['What is a database index?'],
  existingQuestions: ['Explain ACID guarantees.'],
  lastAnswer: 'I would use an idempotency key stored alongside the charge.',
  transcriptSummary: 'Questions asked so far: 2. Competencies already probed: technical.',
  question: 'How do you guarantee idempotency for a payment retry?',
  answer: 'I store a client-supplied key and return the original result on a repeat.',
  expectedPoints: ['Client-supplied idempotency key', 'Stored with the charge', 'Safe replay of the original response'],
  competencies: ['technical', 'problemSolving'],
  resumeText: 'Asha Menon — 6 years building payment systems at Acme. Node, Postgres, Kafka.',
  resumeSummary: 'Led a monolith-to-services migration at Acme.',
  transcript: 'AI: Tell me about idempotency.\nCANDIDATE: I use an idempotency key.',
  perAnswer: [{ score: 72, reasoning: 'Solid but shallow on failure modes.' }],
  weightage: { technical: 0.25, communication: 0.14 },
  knowledge: null,
};

/**
 * POST /admin/prompts/preview — render with sample values before it reaches a
 * candidate. Pass `system` and/or `template` to preview unsaved edits.
 */
export const preview = asyncHandler(async (req, res) => {
  const { key, vars, system, template } = req.body;
  if (!PROMPT_KEYS.includes(key)) {
    throw ApiError.badRequest(`Unknown prompt key "${key}"`, { details: { allowed: PROMPT_KEYS } });
  }
  // A draft may edit either field alone; gating on `template` meant a system-only
  // edit previewed the unedited live prompt.
  const hasDraft = system !== undefined || template !== undefined;
  const result = await previewPrompt(
    key,
    { ...PREVIEW_INPUT, ...(vars || {}) },
    hasDraft ? { system, template } : undefined,
  );
  return ok(res, result);
});

/** POST /admin/prompts/:id/reset — restore the built-in body, keeping the old one as a version. */
export const resetToDefault = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  const def = DEFAULT_PROMPTS[doc.key];
  if (!def) throw ApiError.badRequest(`No built-in default exists for "${doc.key}"`);

  pushVersion(doc, { userId: req.user._id, note: 'Superseded by reset to built-in default' });
  doc.system = def.system;
  doc.template = def.template;
  doc.variables = def.variables;
  doc.updatedBy = req.user._id;
  await doc.save();

  invalidatePromptCache(doc.key);
  await audit({ req, action: 'ai.prompt.reset', entityType: 'PromptTemplate', entityId: doc._id, meta: { key: doc.key } });
  return ok(res, doc, 'Prompt template reset to the built-in default');
});

/** GET /admin/prompts/:id/versions — newest first. */
export const versionHistory = asyncHandler(async (req, res) => {
  const doc = await PromptTemplate.findById(req.params.id).select('key name version versions').lean();
  if (!doc) throw ApiError.notFound('Prompt template not found');
  return ok(res, {
    key: doc.key,
    name: doc.name,
    current: doc.version,
    versions: [...(doc.versions || [])].reverse(),
  });
});

/** POST /admin/prompts/:id/versions/:version/restore */
export const restoreVersion = asyncHandler(async (req, res) => {
  const doc = await byId(req.params.id);
  const wanted = Number(req.params.version);
  const entry = (doc.versions || []).find((v) => v.version === wanted);
  if (!entry) throw ApiError.notFound(`Version ${req.params.version} not found for this template`);

  // The body being replaced becomes a version of its own, so a restore is undoable.
  pushVersion(doc, { userId: req.user._id, note: `Superseded by restore of version ${wanted}` });
  doc.system = entry.system;
  doc.template = entry.template;
  doc.updatedBy = req.user._id;
  await doc.save();

  invalidatePromptCache(doc.key);
  await audit({ req, action: 'ai.prompt.restore', entityType: 'PromptTemplate', entityId: doc._id, meta: { key: doc.key, restored: wanted } });
  return ok(res, doc, `Restored version ${wanted}`);
});

/** GET /admin/prompts/export — every template as portable JSON. */
export const exportAll = asyncHandler(async (req, res) => {
  const docs = await PromptTemplate.find()
    .select('key name description category system template variables isActive isBuiltIn version')
    .sort({ key: 1, name: 1 })
    .lean();
  const templates = docs.map(({ _id, ...rest }) => rest);
  await audit({ req, action: 'ai.prompt.export', meta: { count: templates.length } });
  return ok(res, { exportedAt: new Date().toISOString(), count: templates.length, templates });
});

/**
 * POST /admin/prompts/import — validate the whole payload, then upsert.
 *
 * Identity is (key, name): re-importing an export updates in place rather than
 * duplicating. Nothing is written unless every entry passes, so a bad file cannot
 * leave prompts half-applied.
 */
export const importAll = asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : req.body?.templates;
  if (!Array.isArray(incoming) || !incoming.length) {
    throw ApiError.badRequest('Expected a non-empty "templates" array');
  }

  const errors = [];
  const activeByKey = new Map();
  incoming.forEach((t, i) => {
    const at = `templates[${i}]`;
    if (!PROMPT_KEYS.includes(t?.key)) errors.push(`${at}.key: unknown prompt key "${t?.key}"`);
    if (!String(t?.name || '').trim()) errors.push(`${at}.name is required`);
    if (!String(t?.template || '').trim()) errors.push(`${at}.template is required`);
    if (typeof t?.system === 'string' && t.system.includes('•')) {
      errors.push(`${at}.system looks masked (••••) rather than real text`);
    }
    if (t?.isActive) {
      // Two live templates for one key cannot both be applied; the unique index
      // would reject the second, so say which entries conflict up front.
      if (activeByKey.has(t.key)) errors.push(`${at}: "${t.key}" is already activated by templates[${activeByKey.get(t.key)}]`);
      else activeByKey.set(t.key, i);
    }

    // Hand-checks above cover the obvious cases; the schema catches the rest
    // (e.g. a `variables` entry missing its required `name`). Without this the
    // write loop threw partway through, leaving earlier entries applied — which
    // is exactly what this pre-flight promises cannot happen.
    if (PROMPT_KEYS.includes(t?.key)) {
      const err = new PromptTemplate({
        key: t.key,
        name: t.name,
        description: t.description,
        system: t.system ?? '',
        template: t.template,
        variables: t.variables,
      }).validateSync();
      if (err) {
        for (const e of Object.values(err.errors || {})) errors.push(`${at}.${e.path}: ${e.message}`);
      }
    }
  });
  if (errors.length) throw ApiError.badRequest('Import rejected', { details: errors });

  let createdCount = 0;
  let updatedCount = 0;
  for (const t of incoming) {
    const def = DEFAULT_PROMPTS[t.key];
    const existing = await PromptTemplate.findOne({ key: t.key, name: t.name });
    if (existing) {
      if (existing.system !== t.system || existing.template !== t.template) {
        pushVersion(existing, { userId: req.user._id, note: 'Superseded by import' });
      }
      existing.description = t.description;
      existing.system = t.system ?? '';
      existing.template = t.template;
      if (t.variables?.length) existing.variables = t.variables;
      existing.updatedBy = req.user._id;
      await existing.save();
      if (t.isActive) await setActiveTemplate(existing);
      updatedCount += 1;
    } else {
      const doc = await PromptTemplate.create({
        key: t.key,
        name: t.name,
        description: t.description,
        category: def.category,
        system: t.system ?? '',
        template: t.template,
        variables: t.variables?.length ? t.variables : def.variables,
        isBuiltIn: false,
        updatedBy: req.user._id,
      });
      if (t.isActive) await setActiveTemplate(doc);
      createdCount += 1;
    }
  }

  invalidatePromptCache();
  await audit({ req, action: 'ai.prompt.import', meta: { created: createdCount, updated: updatedCount } });
  return ok(res, { created: createdCount, updated: updatedCount }, 'Prompt templates imported');
});

export default {
  list, getOne, create, update, remove, setActive, toggle,
  preview, resetToDefault, versionHistory, restoreVersion, exportAll, importAll,
};
