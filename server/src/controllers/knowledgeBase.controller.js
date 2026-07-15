import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { Question } from '../models/Question.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../services/audit.service.js';
import { ingestSources, applySources, selectContext } from '../services/knowledgeBase.service.js';
import * as generator from '../services/ai/question.generator.js';
import { isAiConfigured } from '../services/ai/ai.status.js';

/**
 * Knowledge Base CRUD. Tenant-aware: company users see/manage only their own KBs;
 * super-admins see all (optionally filtered by ?company). Mounted under both the
 * company router and the admin router.
 */

/** Accept urls as a JSON array, or a comma/newline-separated string. */
function parseUrls(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j;
  } catch {
    /* not JSON */
  }
  return String(v)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Filter for list queries. */
function scopeFilter(req) {
  if (req.user.role === 'super_admin') return req.query.company ? { company: req.query.company } : {};
  return { company: req.user.company };
}
/** Ownership guard for single-item operations. */
function ownership(req) {
  if (req.user.role === 'super_admin') return {};
  return { company: req.user.company };
}
/** Strip the heavy content/chunks fields before returning. */
function present(kb) {
  const o = kb.toObject ? kb.toObject() : kb;
  delete o.content;
  delete o.chunks;
  return o;
}

/** GET /knowledge-bases — optional taxonomy filters. */
export const list = asyncHandler(async (req, res) => {
  const filter = scopeFilter(req);
  if (req.query.job) filter.job = req.query.job;
  if (req.query.status) filter.status = req.query.status;
  for (const f of ['category', 'department', 'experienceLevel', 'difficulty', 'language']) {
    if (req.query[f]) filter[f] = req.query[f];
  }
  if (req.query.skill) filter.skills = req.query.skill;
  if (req.query.q) filter.name = { $regex: String(req.query.q), $options: 'i' };
  const items = await KnowledgeBase.find(filter).sort('-updatedAt').lean();
  return ok(res, items);
});

/** GET /knowledge-bases/:id — includes a content preview. */
export const getOne = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, ...ownership(req) }).select('+content +chunks');
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  const o = kb.toObject();
  o.contentPreview = (o.content || '').slice(0, 4000);
  o.chunkCount = (o.chunks || []).length;
  delete o.content;
  delete o.chunks;
  return ok(res, o);
});

/** POST /knowledge-bases — multipart: files[] + name/description/scope/job/urls/text. */
export const create = asyncHandler(async (req, res) => {
  if (!req.body.name) throw ApiError.badRequest('A name is required');
  const company = req.user.role === 'super_admin' ? req.body.company || null : req.user.company;
  const kb = new KnowledgeBase({
    name: req.body.name,
    description: req.body.description,
    company,
    scope: req.body.scope || (req.body.job ? 'job' : 'company'),
    job: req.body.job || null,
    jobRole: req.body.jobRole || undefined,
    department: req.body.department || undefined,
    skills: parseUrls(req.body.skills),
    experienceLevel: req.body.experienceLevel || '',
    difficulty: req.body.difficulty || '',
    language: req.body.language || 'both',
    category: req.body.category || '',
    createdBy: req.user._id,
  });
  const segments = await ingestSources({ files: req.files || [], urls: parseUrls(req.body.urls), text: req.body.text || '' });
  await applySources(kb, segments, { append: false });
  await audit({ req, action: 'kb.create', entityType: 'KnowledgeBase', entityId: kb._id, meta: { sources: segments.length } });
  return created(res, present(kb), 'Knowledge base created');
});

/** PATCH /knowledge-bases/:id — metadata only. */
export const update = asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'scope', 'job', 'status', 'jobRole', 'department', 'experienceLevel', 'difficulty', 'language', 'category'];
  const patch = {};
  for (const f of fields) if (req.body[f] !== undefined) patch[f] = req.body[f];
  if (req.body.skills !== undefined) patch.skills = parseUrls(req.body.skills);
  const kb = await KnowledgeBase.findOneAndUpdate({ _id: req.params.id, ...ownership(req) }, { $set: patch }, { new: true });
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  await audit({ req, action: 'kb.update', entityType: 'KnowledgeBase', entityId: kb._id });
  return ok(res, present(kb), 'Knowledge base updated');
});

/** POST /knowledge-bases/:id/sources?mode=append|replace — add/replace material. */
export const addSources = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, ...ownership(req) }).select('+content +chunks');
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  const segments = await ingestSources({ files: req.files || [], urls: parseUrls(req.body.urls), text: req.body.text || '' });
  if (!segments.length) throw ApiError.badRequest('No files, URLs, or text provided');
  await applySources(kb, segments, { append: req.query.mode !== 'replace' });
  await audit({ req, action: 'kb.sources', entityType: 'KnowledgeBase', entityId: kb._id, meta: { mode: req.query.mode || 'append', added: segments.length } });
  return ok(res, present(kb), req.query.mode === 'replace' ? 'Knowledge base replaced' : 'Sources added');
});

/** POST /knowledge-bases/:id/toggle — enable/disable. */
export const toggle = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, ...ownership(req) });
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  kb.status = kb.status === 'active' ? 'disabled' : 'active';
  await kb.save();
  await audit({ req, action: 'kb.toggle', entityType: 'KnowledgeBase', entityId: kb._id, meta: { status: kb.status } });
  return ok(res, present(kb), `Knowledge base ${kb.status}`);
});

/* ── Question generation ───────────────────────────────── */

/** How much of the KB reaches the model: prompts.generateQuestions slices
 *  `knowledge` to 6000 chars, so selecting more only to have it truncated would
 *  silently discard the tail — and the tail is what the ranking chose to keep. */
const KNOWLEDGE_CHARS = 6000;

/** One source rendered for the operator, with the reason it yielded nothing. */
function describeSource(s) {
  const label = s.label || 'Untitled source';
  if (s.error) return `"${label}" — ${s.error}`;
  return `"${label}" — no readable text (a scanned or image-only file has no text layer to extract)`;
}

/**
 * Why this KB cannot ground generation, or null when it can.
 *
 * Naming the offending source is the whole point: a scanned PDF extracts to an
 * empty string without ever throwing, so "generation is broken" and "your upload
 * is a picture of text" are indistinguishable from the client unless the source
 * that produced nothing is said out loud.
 */
function unusableReason(kb) {
  if ((kb.content || '').trim()) return null;
  const sources = kb.sources || [];
  if (!sources.length) {
    return { message: 'This knowledge base has no sources yet. Add a file, a URL, or pasted text before generating questions.', sources: [] };
  }
  // Content is empty, so nothing contributed text; prefer the sources that say why.
  const bad = sources.filter((s) => s.error || !s.chars);
  const named = (bad.length ? bad : sources).map(describeSource);
  return {
    message: `No text could be read from this knowledge base, so there is nothing to generate questions from: ${named.join('; ')}. Re-upload a text-based version (or paste the text in) and try again.`,
    sources: (bad.length ? bad : sources).map((s) => ({ label: s.label, kind: s.kind, chars: s.chars || 0, error: s.error || null })),
  };
}

/** KB_LANGUAGES says 'both'; Question.language spells the same thing 'bilingual'. */
const LANGUAGE_ALIAS = { both: 'bilingual' };

/**
 * POST /knowledge-bases/:id/generate-questions
 *
 * Mirrors POST /questions/generate — same body, same { questions, dropped, reasons }
 * envelope, same pending_review landing — so the client keeps one mental model.
 * The only difference is the relevance anchor: the KB's own material stands in for
 * a job spec, which is why this route needs no jobTitle/skills to be useful.
 */
export const generateQuestions = asyncHandler(async (req, res) => {
  // NOT config.ai.enabled: that flag only means ANTHROPIC_API_KEY is set, and is
  // why boxes running a perfectly good OpenAI key reported "AI is not configured".
  if (!(await isAiConfigured('question_generation', { company: req.companyId }))) {
    throw ApiError.badRequest('AI is not configured');
  }

  const kb = await KnowledgeBase.findOne({ _id: req.params.id, company: req.companyId }).select('+content +chunks');
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  if (kb.status !== 'active') {
    throw ApiError.badRequest('This knowledge base is disabled — enable it before generating questions.');
  }
  const unusable = unusableReason(kb);
  if (unusable) throw ApiError.badRequest(unusable.message, { code: 'KB_NO_CONTENT', details: { sources: unusable.sources } });

  const body = { ...req.body };

  /**
   * Store exactly what the reviewer approved.
   *
   * The two-step preview asks a human to read the set and deselect what they do
   * not want. Re-generating on save would throw that away: the model is not
   * deterministic, so the questions inserted would not be the questions approved
   * — and the deselections would vanish silently. It also skips a second LLM call.
   *
   * Everything security-relevant is forced AFTER the spread: the payload is the
   * client's, so it must not be able to set its own company, status or source and
   * put an unreviewed question straight in front of a candidate.
   */
  if (body.save && body.questions?.length) {
    const docs = await Question.insertMany(
      body.questions.map((q) => ({
        ...q,
        company: req.companyId,
        knowledgeBase: kb._id,
        isPublic: false,
        status: 'pending_review',
        source: 'ai',
        createdBy: req.user._id,
      })),
      { ordered: false },
    );
    await audit({ req, action: 'kb.generate_questions', entityType: 'KnowledgeBase', entityId: kb._id, meta: { inserted: docs.length, approved: true } });
    return created(res, { questions: docs, inserted: docs.length, dropped: 0, reasons: {} }, `${docs.length} questions saved from "${kb.name}" — pending review`);
  }

  // The KB's taxonomy is the default for anything the request leaves out. `category`
  // is deliberately NOT mapped onto `industry`: KB_CATEGORIES ('technical', 'hr', …)
  // and INDUSTRIES ('software_development', …) are different vocabularies, and
  // feeding one to the other writes a value Question.category's enum rejects.
  const jobTitle = body.jobTitle || body.jobRole || kb.jobRole || undefined;
  const department = body.department || kb.department || undefined;
  const skills = body.skills?.length ? body.skills : kb.skills || [];
  const language = body.language || LANGUAGE_ALIAS[kb.language] || kb.language || undefined;

  // selectContext ranks chunks by keyword overlap, so the query must describe what
  // the questions are ABOUT. Role/department/round/skills are the only parts of the
  // request that can appear in the material; `types` ('mcq') and `count` describe the
  // output format and would match nothing while diluting the ranking. With no anchor
  // the query is empty and selection falls back to the leading chunks — the right
  // default for a KB that is already about a single topic.
  const query = [jobTitle, department, body.round, ...skills].filter(Boolean).join(' ');
  const ctx = selectContext(kb, { query, maxChars: KNOWLEDGE_CHARS });

  const { questions, dropped, reasons } = await generator.generateQuestions(
    {
      ...body,
      jobTitle,
      department,
      skills,
      language,
      experienceLevel: body.experienceLevel || kb.experienceLevel || undefined,
      difficulty: body.difficulty || kb.difficulty || undefined,
      knowledge: ctx.text,
    },
    { companyId: req.companyId },
  );

  if (!questions.length) {
    throw ApiError.badRequest(
      'No usable questions were produced — every candidate question was filtered as irrelevant or duplicate. Try widening the skills or lowering the count.',
      { code: 'NO_QUESTIONS', details: { dropped, reasons } },
    );
  }
  if (!body.save) return ok(res, { questions, dropped, reasons, knowledgeBase: { id: kb._id, name: kb.name } }, 'Preview generated — nothing saved yet');

  const docs = await Question.insertMany(
    questions.map((q) => ({
      ...q,
      company: req.companyId,
      knowledgeBase: kb._id, // provenance: which material these were drawn from
      isPublic: false,
      status: 'pending_review', // never auto-served; a human approves first
      source: 'ai',
      createdBy: req.user._id,
    })),
    { ordered: false },
  );
  await audit({ req, action: 'kb.generate_questions', entityType: 'KnowledgeBase', entityId: kb._id, meta: { inserted: docs.length, dropped } });
  return created(res, { questions: docs, inserted: docs.length, dropped, reasons }, `${docs.length} questions generated from "${kb.name}" — pending review`);
});

/** DELETE /knowledge-bases/:id */
export const remove = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOneAndDelete({ _id: req.params.id, ...ownership(req) });
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  await audit({ req, action: 'kb.delete', entityType: 'KnowledgeBase', entityId: req.params.id });
  return ok(res, null, 'Knowledge base deleted');
});
