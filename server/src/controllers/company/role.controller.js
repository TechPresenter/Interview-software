import mongoose from 'mongoose';
import { Role } from '../../models/Role.js';
import { User } from '../../models/User.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { logActivity } from '../../services/audit.service.js';
import { PERMISSION_MODULES, PERMISSION_ACTIONS, MODULE_KEYS, ROLE_TEMPLATES, emptyPermissions } from '../../constants/permissions.js';

/** Keep only known modules/actions so stored permissions stay well-formed. */
function normalizePermissions(input = {}) {
  const out = emptyPermissions();
  for (const key of MODULE_KEYS) {
    const src = input[key] || {};
    out[key] = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, Boolean(src[a])]));
  }
  return out;
}

/** GET /company/roles/catalog — modules, actions, and starter templates for the UI. */
export const catalog = asyncHandler(async (_req, res) => {
  return ok(res, { modules: PERMISSION_MODULES, actions: PERMISSION_ACTIONS, templates: ROLE_TEMPLATES });
});

/** GET /company/roles */
export const list = asyncHandler(async (req, res) => {
  const roles = await Role.find({ company: req.companyId }).sort('name').lean();
  const counts = await User.aggregate([
    { $match: { company: new mongoose.Types.ObjectId(String(req.companyId)), customRole: { $ne: null } } },
    { $group: { _id: '$customRole', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  return ok(res, roles.map((r) => ({ ...r, members: countMap[String(r._id)] || 0 })));
});

/** POST /company/roles */
export const create = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name?.trim()) throw ApiError.badRequest('Role name is required');
  if (await Role.exists({ company: req.companyId, name: name.trim() })) throw ApiError.conflict('A role with that name already exists');
  const role = await Role.create({
    company: req.companyId,
    name: name.trim(),
    description,
    permissions: normalizePermissions(permissions),
    createdBy: req.user._id,
  });
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'role.created', entityType: 'Role', entityId: role._id, summary: `Created role "${role.name}"` });
  return created(res, role, 'Role created');
});

/** PATCH /company/roles/:id */
export const update = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, company: req.companyId });
  if (!role) throw ApiError.notFound('Role not found');
  const { name, description, permissions } = req.body;
  if (name?.trim()) role.name = name.trim();
  if (description !== undefined) role.description = description;
  if (permissions) role.permissions = normalizePermissions(permissions);
  await role.save();
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'role.updated', entityType: 'Role', entityId: role._id, summary: `Updated role "${role.name}"` });
  return ok(res, role, 'Role updated');
});

/** DELETE /company/roles/:id */
export const remove = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, company: req.companyId });
  if (!role) throw ApiError.notFound('Role not found');
  if (await User.exists({ company: req.companyId, customRole: role._id })) {
    throw ApiError.badRequest('This role is assigned to staff — reassign them before deleting it.');
  }
  await role.deleteOne();
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'role.removed', entityType: 'Role', entityId: role._id, summary: `Deleted role "${role.name}"` });
  return ok(res, null, 'Role deleted');
});
