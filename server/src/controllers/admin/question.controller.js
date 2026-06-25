import { Question } from '../../models/Question.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/**
 * Global question bank (company: null). Super-admin maintained; available to all
 * companies' interviews alongside their own private questions.
 */

/** GET /admin/questions — filter by category/difficulty, search text/skills. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['text', 'skills'] });
  opts.filter.company = null; // global bank only
  if (req.query.category) opts.filter.category = req.query.category;
  if (req.query.difficulty) opts.filter.difficulty = req.query.difficulty;
  if (req.query.isActive != null) opts.filter.isActive = req.query.isActive === 'true';
  const { items, meta } = await paginateQuery(Question, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /admin/questions/stats — counts grouped by category. */
export const stats = asyncHandler(async (_req, res) => {
  const byCategory = await Question.aggregate([
    { $match: { company: null } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const total = byCategory.reduce((s, c) => s + c.count, 0);
  return ok(res, { total, byCategory });
});

/** POST /admin/questions */
export const create = asyncHandler(async (req, res) => {
  const q = await Question.create({ ...req.body, company: null, createdBy: req.user._id });
  await audit({ req, action: 'question.create', entityType: 'Question', entityId: q._id });
  return created(res, q, 'Question added');
});

/** POST /admin/questions/bulk */
export const bulkCreate = asyncHandler(async (req, res) => {
  const docs = req.body.questions.map((q) => ({ ...q, company: null, createdBy: req.user._id }));
  const result = await Question.insertMany(docs, { ordered: false });
  return created(res, { inserted: result.length }, `${result.length} questions added`);
});

/** PATCH /admin/questions/:id */
export const update = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    { _id: req.params.id, company: null },
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  return ok(res, q, 'Question updated');
});

/** DELETE /admin/questions/:id */
export const remove = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndDelete({ _id: req.params.id, company: null });
  if (!q) throw ApiError.notFound('Question not found');
  await audit({ req, action: 'question.delete', entityType: 'Question', entityId: req.params.id });
  return ok(res, null, 'Question deleted');
});
