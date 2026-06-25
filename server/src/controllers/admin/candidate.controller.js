import { Candidate } from '../../models/Candidate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/** Platform-wide candidate management (super-admin). */

/** GET /admin/candidates — across all companies. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['name', 'email', 'skills'] });
  if (req.query.company) opts.filter.company = req.query.company;
  if (req.query.stage) opts.filter.stage = req.query.stage;
  const { items, meta } = await paginateQuery(Candidate, opts.filter, opts, [
    { path: 'company', select: 'name' },
    { path: 'job', select: 'title' },
  ]);
  return ok(res, items, 'OK', meta);
});

/** PATCH /admin/candidates/:id */
export const update = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!candidate) throw ApiError.notFound('Candidate not found');
  await audit({ req, action: 'candidate.update', entityType: 'Candidate', entityId: candidate._id });
  return ok(res, candidate, 'Candidate updated');
});

/** DELETE /admin/candidates/:id */
export const remove = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findByIdAndDelete(req.params.id);
  if (!candidate) throw ApiError.notFound('Candidate not found');
  await audit({ req, action: 'candidate.delete', entityType: 'Candidate', entityId: req.params.id });
  return ok(res, null, 'Candidate deleted');
});
