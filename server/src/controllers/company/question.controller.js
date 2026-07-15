import { Question } from '../../models/Question.js';
import { Job } from '../../models/Job.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { logActivity } from '../../services/audit.service.js';
import { config } from '../../config/index.js';
import * as generator from '../../services/ai/question.generator.js';
import { contextFor } from '../../services/knowledgeBase.service.js';
import { scopeFilter } from '../../services/question.selector.js';

/**
 * A company's own question bank.
 *
 * Every question route used to live under /admin and was super_admin-only, so a
 * company managing its own bank got a 403 — the entire feature was unreachable
 * for the people meant to use it. Writes are always pinned to req.companyId;
 * reads may additionally include the shared public global bank.
 */

/** Writes only ever touch this company's own questions. */
const owned = (req, extra = {}) => ({ company: req.companyId, ...extra });

/** GET /company/questions — own bank, plus the public global bank on request. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['text', 'skills', 'topic'] });
  Object.assign(
    opts.filter,
    req.query.includeGlobal === 'true' ? scopeFilter(req.companyId) : { company: req.companyId },
  );
  for (const key of ['type', 'category', 'difficulty', 'language', 'experienceLevel', 'status', 'source', 'topic', 'jobRole']) {
    if (req.query[key]) opts.filter[key] = req.query[key];
  }
  if (req.query.skills) {
    opts.filter.skills = { $in: String(req.query.skills).split(',').map((s) => s.trim()).filter(Boolean) };
  }
  if (req.query.isActive != null) opts.filter.isActive = req.query.isActive === 'true';
  opts.filter.archivedAt = req.query.archived === 'true' ? { $ne: null } : null;

  const { items, meta } = await paginateQuery(Question, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /company/questions/stats */
export const stats = asyncHandler(async (req, res) => {
  const [grouped] = await Question.aggregate([
    { $match: { company: req.companyId, archivedAt: null } },
    {
      $facet: {
        byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        byDifficulty: [{ $group: { _id: '$difficulty', count: { $sum: 1 } } }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  return ok(res, {
    total: grouped.total[0]?.n || 0,
    byType: grouped.byType,
    byCategory: grouped.byCategory,
    byDifficulty: grouped.byDifficulty,
    byStatus: grouped.byStatus,
  });
});

/** POST /company/questions */
export const create = asyncHandler(async (req, res) => {
  const q = await Question.create({
    ...req.body,
    company: req.companyId,
    // A company's questions are private to it unless it opts in.
    isPublic: false,
    createdBy: req.user._id,
  });
  await logActivity({ company: req.companyId, user: req.user._id, action: 'question.create', entityType: 'Question', entityId: q._id, summary: q.text.slice(0, 120) });
  return created(res, q, 'Question added');
});

/** POST /company/questions/bulk */
export const bulkCreate = asyncHandler(async (req, res) => {
  const docs = req.body.questions.map((q) => ({ ...q, company: req.companyId, isPublic: false, createdBy: req.user._id }));
  const result = await Question.insertMany(docs, { ordered: false });
  await logActivity({ company: req.companyId, user: req.user._id, action: 'question.bulk_create', entityType: 'Question', summary: `${result.length} questions imported` });
  return created(res, { inserted: result.length }, `${result.length} questions added`);
});

/** PATCH /company/questions/:id */
export const update = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    owned(req, { _id: req.params.id }),
    { $set: { ...req.body, updatedBy: req.user._id } },
    { new: true, runValidators: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  return ok(res, q, 'Question updated');
});

/**
 * POST /company/questions/:id/duplicate
 * Also the way to adopt a global question: the copy is written into this
 * company's bank, leaving the shared original untouched.
 */
export const duplicate = asyncHandler(async (req, res) => {
  const src = await Question.findOne({
    _id: req.params.id,
    $or: [{ company: req.companyId }, { company: null, isPublic: true }],
  }).lean();
  if (!src) throw ApiError.notFound('Question not found');

  const { _id, createdAt, updatedAt, usageCount, lastUsedAt, reviewedBy, reviewedAt, archivedAt, archivedBy, company, ...rest } = src;
  const copy = await Question.create({
    ...rest,
    company: req.companyId,
    isPublic: false,
    status: 'draft',
    source: src.company ? src.source : 'import', // adopted from the global bank
    createdBy: req.user._id,
  });
  return created(res, copy, 'Question duplicated');
});

/** POST /company/questions/:id/archive */
export const archive = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    owned(req, { _id: req.params.id }),
    { $set: { archivedAt: new Date(), archivedBy: req.user._id, isActive: false } },
    { new: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  return ok(res, q, 'Question archived');
});

/** POST /company/questions/:id/restore */
export const restore = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    owned(req, { _id: req.params.id }),
    { $set: { archivedAt: null, archivedBy: null, isActive: true } },
    { new: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  return ok(res, q, 'Question restored');
});

/** POST /company/questions/:id/review — approve/reject before it can be served. */
export const review = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    owned(req, { _id: req.params.id }),
    { $set: { status: req.body.status, reviewedBy: req.user._id, reviewedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  await logActivity({ company: req.companyId, user: req.user._id, action: `question.${req.body.status}`, entityType: 'Question', entityId: q._id });
  return ok(res, q, `Question ${req.body.status}`);
});

/** POST /company/questions/bulk-review */
export const bulkReview = asyncHandler(async (req, res) => {
  const result = await Question.updateMany(
    { _id: { $in: req.body.ids }, company: req.companyId },
    { $set: { status: req.body.status, reviewedBy: req.user._id, reviewedAt: new Date() } },
  );
  return ok(res, { updated: result.modifiedCount }, `${result.modifiedCount} questions ${req.body.status}`);
});

/** DELETE /company/questions/:id */
export const remove = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndDelete(owned(req, { _id: req.params.id }));
  if (!q) throw ApiError.notFound('Question not found');
  await logActivity({ company: req.companyId, user: req.user._id, action: 'question.delete', entityType: 'Question', entityId: req.params.id });
  return ok(res, null, 'Question deleted');
});

/** POST /company/questions/generate — AI-generate into this company's bank. */
export const generate = asyncHandler(async (req, res) => {
  if (!config.ai.enabled) throw ApiError.badRequest('AI is not configured');
  const body = { ...req.body };

  if (body.jobId) {
    // Tenant-scoped: a company may only generate from its OWN jobs.
    const job = await Job.findOne({ _id: body.jobId, company: req.companyId }).lean();
    if (!job) throw ApiError.notFound('Job not found');
    body.jobTitle ??= job.title;
    body.jobDescription ??= job.description;
    body.department ??= job.department;
    body.industry ??= job.industry;
    body.skills ??= (job.skills || []).map((s) => s.name);
    if (job.knowledgeBase && !body.knowledge) {
      const ctx = await contextFor(job.knowledgeBase, { query: job.title, maxChars: 6000 });
      body.knowledge = ctx?.text || null;
    }
  }

  const { questions, dropped, reasons } = await generator.generateQuestions(body, { companyId: req.companyId });
  if (!questions.length) {
    throw ApiError.badRequest(
      'No usable questions were produced — every candidate question was filtered as irrelevant or duplicate. Try widening the skills or lowering the count.',
      { code: 'NO_QUESTIONS', meta: { dropped, reasons } },
    );
  }
  if (!body.save) return ok(res, { questions, dropped, reasons }, 'Preview generated — nothing saved yet');

  const docs = await Question.insertMany(
    questions.map((q) => ({
      ...q,
      company: req.companyId,
      isPublic: false,
      status: 'pending_review', // never auto-served; a human approves first
      source: 'ai',
      createdBy: req.user._id,
    })),
    { ordered: false },
  );
  await logActivity({ company: req.companyId, user: req.user._id, action: 'question.ai_generate', entityType: 'Question', summary: `${docs.length} AI questions generated (pending review)` });
  return created(res, { questions: docs, inserted: docs.length, dropped, reasons }, `${docs.length} questions generated — pending review`);
});

/** POST /company/questions/:id/answer-key */
export const answerKey = asyncHandler(async (req, res) => {
  if (!config.ai.enabled) throw ApiError.badRequest('AI is not configured');
  const q = await Question.findOne(owned(req, { _id: req.params.id }));
  if (!q) throw ApiError.notFound('Question not found');

  const key = await generator.generateAnswerKey({
    question: q.text,
    jobTitle: q.jobRole,
    skills: q.skills,
    difficulty: q.difficulty,
    competencies: q.competencies,
    language: q.language,
    companyId: req.companyId,
  });
  if (!key) throw ApiError.internal('Could not generate an answer key');

  q.answerKey = key;
  if (!q.expectedPoints?.length && key.keyPoints.length) q.expectedPoints = key.keyPoints;
  q.updatedBy = req.user._id;
  await q.save();
  return ok(res, q, 'Answer key generated');
});
