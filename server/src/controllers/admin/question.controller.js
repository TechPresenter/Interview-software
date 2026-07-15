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

/** Filters shared by list + export. `type` = format, `category` = industry. */
function bankFilter(query) {
  const opts = parseListQuery(query, { searchFields: ['text', 'skills', 'topic'] });
  opts.filter.company = null; // global bank only
  for (const key of ['type', 'category', 'difficulty', 'language', 'experienceLevel', 'status', 'source', 'topic', 'jobRole']) {
    if (query[key]) opts.filter[key] = query[key];
  }
  if (query.skills) opts.filter.skills = { $in: String(query.skills).split(',').map((s) => s.trim()).filter(Boolean) };
  if (query.isActive != null) opts.filter.isActive = query.isActive === 'true';
  // Archived rows are hidden unless explicitly asked for.
  opts.filter.archivedAt = query.archived === 'true' ? { $ne: null } : null;
  return opts;
}

/** GET /admin/questions — filter by type/industry/difficulty/status, search text/skills/topic. */
export const list = asyncHandler(async (req, res) => {
  const opts = bankFilter(req.query);
  const { items, meta } = await paginateQuery(Question, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /admin/questions/stats — counts grouped by type, industry, difficulty and status. */
export const stats = asyncHandler(async (_req, res) => {
  const [grouped] = await Question.aggregate([
    { $match: { company: null, archivedAt: null } },
    {
      $facet: {
        byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        byDifficulty: [{ $group: { _id: '$difficulty', count: { $sum: 1 } } }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        bySource: [{ $group: { _id: '$source', count: { $sum: 1 } } }],
        total: [{ $count: 'n' }],
        withAnswerKey: [{ $match: { 'answerKey.idealAnswer': { $exists: true, $ne: '' } } }, { $count: 'n' }],
      },
    },
  ]);
  return ok(res, {
    total: grouped.total[0]?.n || 0,
    withAnswerKey: grouped.withAnswerKey[0]?.n || 0,
    byType: grouped.byType,
    byCategory: grouped.byCategory,
    byDifficulty: grouped.byDifficulty,
    byStatus: grouped.byStatus,
    bySource: grouped.bySource,
  });
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
  // The highest-volume write path was the only unaudited one.
  await audit({ req, action: 'question.bulk_create', entityType: 'Question', meta: { submitted: docs.length, inserted: result.length } });
  return created(res, { inserted: result.length }, `${result.length} questions added`);
});

/** PATCH /admin/questions/:id */
export const update = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    { _id: req.params.id, company: null },
    { $set: { ...req.body, updatedBy: req.user._id } },
    { new: true, runValidators: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  await audit({ req, action: 'question.update', entityType: 'Question', entityId: q._id });
  return ok(res, q, 'Question updated');
});

/** POST /admin/questions/:id/duplicate */
export const duplicate = asyncHandler(async (req, res) => {
  const src = await Question.findOne({ _id: req.params.id, company: null }).lean();
  if (!src) throw ApiError.notFound('Question not found');
  // Strip identity/lifecycle fields so the copy starts clean.
  const { _id, createdAt, updatedAt, usageCount, lastUsedAt, reviewedBy, reviewedAt, archivedAt, archivedBy, ...rest } = src;
  const copy = await Question.create({
    ...rest,
    text: `${src.text} (copy)`,
    status: 'draft',
    createdBy: req.user._id,
  });
  await audit({ req, action: 'question.duplicate', entityType: 'Question', entityId: copy._id, meta: { from: String(_id) } });
  return created(res, copy, 'Question duplicated');
});

/** POST /admin/questions/:id/archive — soft delete, keeps report history intact. */
export const archive = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    { _id: req.params.id, company: null },
    { $set: { archivedAt: new Date(), archivedBy: req.user._id, isActive: false } },
    { new: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  await audit({ req, action: 'question.archive', entityType: 'Question', entityId: q._id });
  return ok(res, q, 'Question archived');
});

/** POST /admin/questions/:id/restore */
export const restore = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    { _id: req.params.id, company: null },
    { $set: { archivedAt: null, archivedBy: null, isActive: true } },
    { new: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  await audit({ req, action: 'question.restore', entityType: 'Question', entityId: q._id });
  return ok(res, q, 'Question restored');
});

/** POST /admin/questions/:id/review — approve or reject an AI-generated question. */
export const review = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndUpdate(
    { _id: req.params.id, company: null },
    { $set: { status: req.body.status, reviewedBy: req.user._id, reviewedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!q) throw ApiError.notFound('Question not found');
  await audit({ req, action: `question.${req.body.status}`, entityType: 'Question', entityId: q._id, meta: { note: req.body.note } });
  return ok(res, q, `Question ${req.body.status}`);
});

/** POST /admin/questions/bulk-review — approve/reject a whole AI batch. */
export const bulkReview = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  const result = await Question.updateMany(
    { _id: { $in: ids }, company: null },
    { $set: { status, reviewedBy: req.user._id, reviewedAt: new Date() } },
  );
  await audit({ req, action: `question.bulk_${status}`, entityType: 'Question', meta: { count: result.modifiedCount } });
  return ok(res, { updated: result.modifiedCount }, `${result.modifiedCount} questions ${status}`);
});

/** DELETE /admin/questions/:id — hard delete. Prefer archive. */
export const remove = asyncHandler(async (req, res) => {
  const q = await Question.findOneAndDelete({ _id: req.params.id, company: null });
  if (!q) throw ApiError.notFound('Question not found');
  await audit({ req, action: 'question.delete', entityType: 'Question', entityId: req.params.id });
  return ok(res, null, 'Question deleted');
});
