import { QuestionSet } from '../../models/QuestionSet.js';
import { Question } from '../../models/Question.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { selectQuestionSet } from '../../services/question.selector.js';
import { logActivity } from '../../services/audit.service.js';

/** Curated, reusable question sets scoped to a company. */

const owned = (req, extra = {}) => ({ company: req.companyId, ...extra });

/** GET /company/question-sets */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['name', 'tags'] });
  Object.assign(opts.filter, {
    $or: [{ company: req.companyId }, { company: null, isPublic: true }],
    archivedAt: null,
  });
  if (req.query.round) opts.filter.round = req.query.round;
  if (req.query.jobRole) opts.filter.jobRole = req.query.jobRole;
  const { items, meta } = await paginateQuery(QuestionSet, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /company/question-sets/:id */
export const getOne = asyncHandler(async (req, res) => {
  const set = await QuestionSet.findOne({
    _id: req.params.id,
    $or: [{ company: req.companyId }, { company: null, isPublic: true }],
  })
    .populate('questions')
    .lean();
  if (!set) throw ApiError.notFound('Question set not found');
  return ok(res, set);
});

/** Reject question ids the company cannot actually use. */
async function assertUsable(ids, companyId) {
  if (!ids?.length) return [];
  const found = await Question.find({
    _id: { $in: ids },
    $or: [{ company: companyId }, { company: null, isPublic: true }],
  })
    .select('_id')
    .lean();
  if (found.length !== ids.length) {
    throw ApiError.badRequest('One or more questions are not in your bank or the shared bank');
  }
  return ids;
}

/** POST /company/question-sets */
export const create = asyncHandler(async (req, res) => {
  await assertUsable(req.body.questions, req.companyId);
  const set = await QuestionSet.create({ ...req.body, company: req.companyId, createdBy: req.user._id });
  await logActivity({ company: req.companyId, user: req.user._id, action: 'questionSet.create', entityType: 'QuestionSet', entityId: set._id, summary: set.name });
  return created(res, set, 'Question set created');
});

/** PATCH /company/question-sets/:id */
export const update = asyncHandler(async (req, res) => {
  if (req.body.questions) await assertUsable(req.body.questions, req.companyId);
  const set = await QuestionSet.findOneAndUpdate(
    owned(req, { _id: req.params.id }),
    { $set: { ...req.body, updatedBy: req.user._id } },
    { new: true, runValidators: true },
  );
  if (!set) throw ApiError.notFound('Question set not found');
  return ok(res, set, 'Question set updated');
});

/**
 * POST /company/question-sets/auto — build a set from the bank.
 * Uses the same relevance-ranked selector the live interview uses, so a
 * generated set contains exactly the questions the engine would have chosen.
 */
export const auto = asyncHandler(async (req, res) => {
  const { count = 8, name, ...criteria } = req.body;
  const picked = await selectQuestionSet({ ...criteria, companyId: req.companyId }, count);
  if (!picked.length) {
    throw ApiError.badRequest('No relevant questions found in your bank for those criteria — try generating some first.', { code: 'EMPTY_BANK' });
  }
  const set = await QuestionSet.create({
    company: req.companyId,
    name: name || `Auto set — ${criteria.jobRole || 'general'}`,
    questions: picked.map((q) => q._id),
    jobRole: criteria.jobRole,
    round: criteria.round,
    difficulty: criteria.difficulty,
    experienceLevel: criteria.experienceLevel,
    language: criteria.language,
    createdBy: req.user._id,
  });
  return created(res, set, `Set built with ${picked.length} questions`);
});

/** POST /company/question-sets/:id/duplicate */
export const duplicate = asyncHandler(async (req, res) => {
  const src = await QuestionSet.findOne({
    _id: req.params.id,
    $or: [{ company: req.companyId }, { company: null, isPublic: true }],
  }).lean();
  if (!src) throw ApiError.notFound('Question set not found');
  const { _id, createdAt, updatedAt, usageCount, company, ...rest } = src;
  const copy = await QuestionSet.create({
    ...rest,
    company: req.companyId,
    isPublic: false,
    name: `${src.name} (copy)`,
    createdBy: req.user._id,
  });
  return created(res, copy, 'Question set duplicated');
});

/** DELETE /company/question-sets/:id — soft delete. */
export const remove = asyncHandler(async (req, res) => {
  const set = await QuestionSet.findOneAndUpdate(
    owned(req, { _id: req.params.id }),
    { $set: { archivedAt: new Date(), isActive: false } },
    { new: true },
  );
  if (!set) throw ApiError.notFound('Question set not found');
  return ok(res, null, 'Question set archived');
});
