import { Job } from '../../models/Job.js';
import { Candidate } from '../../models/Candidate.js';
import { Interview } from '../../models/Interview.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { slugify } from '../../utils/slug.js';
import { assertWithinLimit } from '../../services/limits.service.js';
import { logActivity } from '../../services/audit.service.js';

/** Tenant-scoped filter helper. */
const scope = (req, extra = {}) => ({ company: req.companyId, ...extra });

/** GET /company/jobs */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['title', 'department', 'location'] });
  const filter = scope(req, opts.filter);
  if (req.query.status) filter.status = req.query.status;
  const { items, meta } = await paginateQuery(Job, filter, opts);

  // Attach candidate counts per job for the list view.
  const ids = items.map((j) => j._id);
  const counts = await Candidate.aggregate([
    { $match: { job: { $in: ids } } },
    { $group: { _id: '$job', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  const withCounts = items.map((j) => ({ ...j, candidateCount: countMap[String(j._id)] || 0 }));

  return ok(res, withCounts, 'OK', meta);
});

/** GET /company/jobs/:id */
export const getOne = asyncHandler(async (req, res) => {
  const job = await Job.findOne(scope(req, { _id: req.params.id })).lean();
  if (!job) throw ApiError.notFound('Job not found');
  const [candidateCount, interviewCount] = await Promise.all([
    Candidate.countDocuments({ job: job._id }),
    Interview.countDocuments({ job: job._id }),
  ]);
  return ok(res, { job, candidateCount, interviewCount });
});

/** POST /company/jobs */
export const create = asyncHandler(async (req, res) => {
  const status = req.body.status || 'draft';
  // Only count against the active-job limit when publishing (not drafts).
  if (status === 'open') await assertWithinLimit(req.companyId, 'activeJobs');

  const job = await Job.create({
    ...req.body,
    status,
    company: req.companyId,
    slug: slugify(req.body.title),
    createdBy: req.user._id,
  });
  await logActivity({
    company: req.companyId,
    actor: req.user._id,
    action: 'job.created',
    entityType: 'Job',
    entityId: job._id,
    summary: `Job "${job.title}" created`,
  });
  return created(res, job, 'Job created');
});

/** PATCH /company/jobs/:id */
export const update = asyncHandler(async (req, res) => {
  const existing = await Job.findOne(scope(req, { _id: req.params.id }));
  if (!existing) throw ApiError.notFound('Job not found');
  // Enforce limit when transitioning draft/paused → open.
  if (req.body.status === 'open' && existing.status !== 'open') {
    await assertWithinLimit(req.companyId, 'activeJobs');
  }
  Object.assign(existing, req.body);
  await existing.save();
  return ok(res, existing, 'Job updated');
});

/** DELETE /company/jobs/:id */
export const remove = asyncHandler(async (req, res) => {
  const job = await Job.findOneAndDelete(scope(req, { _id: req.params.id }));
  if (!job) throw ApiError.notFound('Job not found');
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'job.deleted', summary: `Job "${job.title}" deleted` });
  return ok(res, null, 'Job deleted');
});

/** POST /company/jobs/:id/clone */
export const clone = asyncHandler(async (req, res) => {
  const src = await Job.findOne(scope(req, { _id: req.params.id })).lean();
  if (!src) throw ApiError.notFound('Job not found');
  delete src._id;
  delete src.createdAt;
  delete src.updatedAt;
  const job = await Job.create({
    ...src,
    title: `${src.title} (Copy)`,
    slug: slugify(`${src.title}-copy`),
    status: 'draft',
    createdBy: req.user._id,
  });
  return created(res, job, 'Job cloned');
});
