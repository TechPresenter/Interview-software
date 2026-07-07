import { Lead } from '../../models/Lead.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/** GET /admin/leads — list contact enquiries + newsletter subscribers. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, {
    searchFields: ['name', 'email', 'company', 'subject', 'message'],
    defaultSort: '-createdAt',
  });
  if (req.query.type) opts.filter.type = req.query.type;
  if (req.query.status) opts.filter.status = req.query.status;
  const { items, meta } = await paginateQuery(Lead, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /admin/leads/stats — counts for the dashboard cards. */
export const stats = asyncHandler(async (_req, res) => {
  const [total, contact, newsletter, unread] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ type: 'contact' }),
    Lead.countDocuments({ type: 'newsletter' }),
    Lead.countDocuments({ status: 'new' }),
  ]);
  return ok(res, { total, contact, newsletter, unread });
});

/** PATCH /admin/leads/:id — update status / notes. */
export const update = asyncHandler(async (req, res) => {
  const doc = await Lead.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!doc) throw ApiError.notFound('Lead not found');
  await audit({ req, action: 'lead.update', entityType: 'Lead', entityId: doc._id });
  return ok(res, doc, 'Updated');
});

/** DELETE /admin/leads/:id */
export const remove = asyncHandler(async (req, res) => {
  const doc = await Lead.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound('Lead not found');
  await audit({ req, action: 'lead.delete', entityType: 'Lead', entityId: req.params.id });
  return ok(res, null, 'Deleted');
});
