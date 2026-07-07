import crypto from 'node:crypto';
import { Company } from '../../models/Company.js';
import { User } from '../../models/User.js';
import { Plan } from '../../models/Plan.js';
import { Subscription } from '../../models/Subscription.js';
import { Payment } from '../../models/Payment.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { slugify } from '../../utils/slug.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit, logActivity } from '../../services/audit.service.js';
import { companyAnalytics } from '../../services/analytics.service.js';
import { safeSendTemplated } from '../../services/email.service.js';
import { config } from '../../config/index.js';
import { ROLES, PLANS } from '../../constants/enums.js';

/** GET /admin/companies — paginated, searchable, filter by status/plan. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['name', 'slug', 'contactEmail'] });
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.plan) opts.filter.plan = req.query.plan;
  const { items, meta } = await paginateQuery(Company, opts.filter, opts, { path: 'owner', select: 'name email' });
  return ok(res, items, 'OK', meta);
});

/** GET /admin/companies/:id — company + live analytics. */
export const getOne = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).populate('owner', 'name email').lean();
  if (!company) throw ApiError.notFound('Company not found');
  const stats = await companyAnalytics(req.params.id);
  return ok(res, { company, stats });
});

/** POST /admin/companies — create a company and optionally its first admin. */
export const create = asyncHandler(async (req, res) => {
  const { name, website, industry, size, plan = PLANS.FREE, adminEmail, adminName } = req.body;

  const planDoc = await Plan.findOne({ key: plan });
  const company = await Company.create({
    name,
    slug: slugify(name),
    website,
    industry,
    size,
    plan,
    limits: planDoc?.limits,
  });

  // Subscription record (manual provisioning by super-admin).
  const sub = await Subscription.create({ company: company._id, plan, status: 'active', provider: 'manual' });
  company.subscription = sub._id;

  let tempPassword;
  if (adminEmail) {
    if (await User.exists({ email: adminEmail.toLowerCase() })) {
      throw ApiError.conflict('Admin email already in use');
    }
    tempPassword = crypto.randomBytes(6).toString('base64url');
    const admin = await User.create({
      name: adminName || name,
      email: adminEmail.toLowerCase(),
      password: tempPassword,
      role: ROLES.COMPANY_ADMIN,
      company: company._id,
    });
    company.owner = admin._id;
    // Branded workspace-ready email carrying the temporary password.
    await safeSendTemplated('system_notification', {
      to: adminEmail,
      vars: {
        name: adminName || name,
        subject: 'Your workspace is ready 🎉',
        message: `A workspace “${name}” has been created for you. Sign in with your email and this temporary password: ${tempPassword}. Please change it after your first login.`,
        link: `${config.clientUrl}/login`,
      },
      company: company._id,
    });
  }
  await company.save();

  await audit({ req, action: 'company.create', entityType: 'Company', entityId: company._id });
  await logActivity({ company: company._id, actor: req.user._id, action: 'company.created', summary: `Company "${name}" created` });

  return created(res, { company, tempPassword }, 'Company created');
});

/** PATCH /admin/companies/:id */
export const update = asyncHandler(async (req, res) => {
  const before = await Company.findById(req.params.id).lean();
  if (!before) throw ApiError.notFound('Company not found');

  const company = await Company.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  await audit({
    req,
    action: 'company.update',
    entityType: 'Company',
    entityId: company._id,
    changes: { before, after: company.toObject() },
  });
  return ok(res, company, 'Company updated');
});

/** POST /admin/companies/:id/suspend */
export const suspend = asyncHandler(async (req, res) => {
  const company = await setStatus(req.params.id, 'suspended');
  // Disable all of the company's users so they can't log in while suspended.
  await User.updateMany({ company: company._id }, { $set: { isActive: false } });
  await audit({ req, action: 'company.suspend', entityType: 'Company', entityId: company._id });
  await logActivity({ company: company._id, actor: req.user._id, action: 'company.suspended', summary: `Company suspended` });
  return ok(res, company, 'Company suspended');
});

/** POST /admin/companies/:id/activate */
export const activate = asyncHandler(async (req, res) => {
  const company = await setStatus(req.params.id, 'active');
  await User.updateMany({ company: company._id }, { $set: { isActive: true } });
  await audit({ req, action: 'company.activate', entityType: 'Company', entityId: company._id });
  return ok(res, company, 'Company activated');
});

/** GET /admin/companies/:id/billing — subscription + payment history. */
export const billing = asyncHandler(async (req, res) => {
  const [subscription, payments] = await Promise.all([
    Subscription.findOne({ company: req.params.id }).sort('-createdAt').lean(),
    Payment.find({ company: req.params.id }).sort('-createdAt').limit(50).lean(),
  ]);
  return ok(res, { subscription, payments });
});

async function setStatus(id, status) {
  const company = await Company.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!company) throw ApiError.notFound('Company not found');
  return company;
}
