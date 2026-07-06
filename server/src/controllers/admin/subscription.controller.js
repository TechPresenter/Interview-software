import { Plan } from '../../models/Plan.js';
import { Coupon } from '../../models/Coupon.js';
import { Payment } from '../../models/Payment.js';
import { Subscription } from '../../models/Subscription.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/* ── Plans ─────────────────────────────────────────────── */

/** GET /admin/plans */
export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.find().sort('sortOrder').lean();
  return ok(res, plans);
});

/** PUT /admin/plans — upsert by `key`. */
export const upsertPlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOneAndUpdate(
    { key: req.body.key },
    { $set: req.body },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await audit({ req, action: 'plan.upsert', entityType: 'Plan', entityId: plan._id });
  return ok(res, plan, 'Plan saved');
});

/**
 * POST /admin/plans/seed — sync the four tiers to the current defaults.
 * Upserts by `key`, so re-running applies the latest pricing/features to
 * existing plans (not just an empty DB).
 */
export const seedPlans = asyncHandler(async (req, res) => {
  const defaults = Plan.defaults();
  await Plan.bulkWrite(
    defaults.map((p) => ({ updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true } })),
  );
  await audit({ req, action: 'plan.seed', meta: { count: defaults.length } });
  return ok(res, await Plan.find().sort('sortOrder').lean(), 'Plans synced to defaults');
});

/* ── Coupons ───────────────────────────────────────────── */

/** GET /admin/coupons */
export const listCoupons = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['code', 'description'] });
  const { items, meta } = await paginateQuery(Coupon, opts.filter, opts);
  return ok(res, items, 'OK', meta);
});

/** POST /admin/coupons */
export const createCoupon = asyncHandler(async (req, res) => {
  const code = req.body.code.toUpperCase();
  if (await Coupon.exists({ code })) throw ApiError.conflict('Coupon code already exists');
  if (req.body.type === 'percent' && req.body.value > 100) {
    throw ApiError.badRequest('Percent discount cannot exceed 100');
  }
  const coupon = await Coupon.create({ ...req.body, code, createdBy: req.user._id });
  await audit({ req, action: 'coupon.create', entityType: 'Coupon', entityId: coupon._id });
  return created(res, coupon, 'Coupon created');
});

/** PATCH /admin/coupons/:id */
export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return ok(res, coupon, 'Coupon updated');
});

/** DELETE /admin/coupons/:id */
export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  await audit({ req, action: 'coupon.delete', entityType: 'Coupon', entityId: req.params.id });
  return ok(res, null, 'Coupon deleted');
});

/* ── Invoices / payments ───────────────────────────────── */

/** GET /admin/invoices — all payments across companies (paginated). */
export const listInvoices = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['invoiceNumber', 'providerPaymentId'] });
  if (req.query.status) opts.filter.status = req.query.status;
  const { items, meta } = await paginateQuery(Payment, opts.filter, opts, { path: 'company', select: 'name slug' });
  return ok(res, items, 'OK', meta);
});

/** GET /admin/subscriptions — all subscriptions (paginated). */
export const listSubscriptions = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, {});
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.plan) opts.filter.plan = req.query.plan;
  const { items, meta } = await paginateQuery(Subscription, opts.filter, opts, { path: 'company', select: 'name slug' });
  return ok(res, items, 'OK', meta);
});
