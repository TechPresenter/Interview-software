import crypto from 'node:crypto';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { Company } from '../../models/Company.js';
import { AuditLog } from '../../models/AuditLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertWithinLimit } from '../../services/limits.service.js';
import { config } from '../../config/index.js';
import { logActivity } from '../../services/audit.service.js';
import { safeSendTemplated } from '../../services/email.service.js';
import { effectivePermissions } from '../../services/permission.service.js';
import { COMPANY_ROLES } from '../../constants/enums.js';

const STAFF_ROLES = COMPANY_ROLES; // company_admin, recruiter, hr_manager

/** GET /company/me/permissions — the current user's effective permission map. */
export const myPermissions = asyncHandler(async (req, res) => {
  return ok(res, { role: req.user.role, permissions: await effectivePermissions(req.user) });
});

/** GET /company/staff — list company staff (excludes candidates). */
export const list = asyncHandler(async (req, res) => {
  const staff = await User.find({ company: req.companyId, role: { $in: STAFF_ROLES } })
    .select('name email role customRole isActive lastLoginAt createdAt')
    .populate('customRole', 'name')
    .sort('-createdAt')
    .lean();
  const company = await Company.findById(req.companyId).select('owner').lean();
  return ok(res, staff.map((s) => ({ ...s, isOwner: String(s._id) === String(company?.owner) })));
});

/** POST /company/staff — invite a staff member (creates a user + temp password). */
export const create = asyncHandler(async (req, res) => {
  const { name, email, role, customRole } = req.body;
  if (!STAFF_ROLES.includes(role)) throw ApiError.badRequest('Invalid staff role');
  await assertWithinLimit(req.companyId, 'seats');
  const lower = String(email).toLowerCase();
  if (await User.exists({ email: lower })) throw ApiError.conflict('That email is already in use');
  if (customRole && !(await Role.exists({ _id: customRole, company: req.companyId }))) {
    throw ApiError.badRequest('Unknown custom role');
  }

  const tempPassword = crypto.randomBytes(6).toString('base64url');
  const user = await User.create({
    name,
    email: lower,
    password: tempPassword,
    role,
    company: req.companyId,
    customRole: customRole || undefined,
  });

  const company = await Company.findById(req.companyId).select('name').lean();
  await safeSendTemplated('system_notification', {
    to: lower,
    vars: {
      name,
      subject: `You’ve been added to ${company?.name || 'your workspace'} 🎉`,
      message: `You now have access to the ${company?.name || 'workspace'} on AIPL Hire. Sign in with your email and this temporary password: ${tempPassword} — please change it after your first login.`,
      link: `${config.clientUrl}/login`,
    },
    company: req.companyId,
    relatedUser: user._id,
  });

  await logActivity({ company: req.companyId, actor: req.user._id, action: 'staff.invited', entityType: 'User', entityId: user._id, summary: `Invited ${name} (${role})` });
  return created(res, { user: { _id: user._id, name, email: lower, role }, tempPassword }, 'Staff member added');
});

/** PATCH /company/staff/:id — update role / custom role / active state. */
export const update = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, company: req.companyId, role: { $in: STAFF_ROLES } });
  if (!target) throw ApiError.notFound('Staff member not found');
  if (String(target._id) === String(req.user._id)) throw ApiError.badRequest('You can’t modify your own role or status');

  const { name, role, customRole, isActive } = req.body;
  if (name) target.name = name;
  if (role) {
    if (!STAFF_ROLES.includes(role)) throw ApiError.badRequest('Invalid staff role');
    target.role = role;
  }
  if (customRole !== undefined) {
    if (customRole && !(await Role.exists({ _id: customRole, company: req.companyId }))) throw ApiError.badRequest('Unknown custom role');
    target.customRole = customRole || undefined;
  }
  if (typeof isActive === 'boolean') {
    target.isActive = isActive;
    if (!isActive) target.tokenVersion += 1; // force logout when deactivated
  }
  await target.save();

  await logActivity({ company: req.companyId, actor: req.user._id, action: 'staff.updated', entityType: 'User', entityId: target._id, summary: `Updated ${target.name}` });
  return ok(res, { _id: target._id, name: target.name, role: target.role, isActive: target.isActive }, 'Staff member updated');
});

/** DELETE /company/staff/:id — remove a staff member (not self or the owner). */
export const remove = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You can’t remove yourself');
  const company = await Company.findById(req.companyId).select('owner').lean();
  if (String(req.params.id) === String(company?.owner)) throw ApiError.badRequest('The workspace owner can’t be removed');

  const target = await User.findOneAndDelete({ _id: req.params.id, company: req.companyId, role: { $in: STAFF_ROLES } });
  if (!target) throw ApiError.notFound('Staff member not found');
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'staff.removed', entityType: 'User', entityId: target._id, summary: `Removed ${target.name}` });
  return ok(res, null, 'Staff member removed');
});

/** GET /company/staff/login-history — recent sign-in / auth events for the team. */
export const loginHistory = asyncHandler(async (req, res) => {
  const ids = await User.find({ company: req.companyId }).distinct('_id');
  const logs = await AuditLog.find({ actor: { $in: ids }, action: { $regex: '^auth\\.' } })
    .populate('actor', 'name email')
    .sort('-createdAt')
    .limit(60)
    .lean();
  return ok(res, logs.map((l) => ({ _id: l._id, actor: l.actor, action: l.action, status: l.status, ip: l.ip, at: l.createdAt })));
});
