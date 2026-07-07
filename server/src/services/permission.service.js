import { Role } from '../models/Role.js';
import { ROLES } from '../constants/enums.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { fullPermissions, emptyPermissions, DEFAULT_PERMISSIONS } from '../constants/permissions.js';

/**
 * Resolve a user's effective permission map:
 *   super_admin / company_admin → full access
 *   custom role assigned         → that role's permissions
 *   otherwise                    → coarse-role defaults
 */
export async function effectivePermissions(user) {
  if (!user) return emptyPermissions();
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.COMPANY_ADMIN) return fullPermissions();

  if (user.customRole) {
    const role = await Role.findById(user.customRole).lean();
    if (role?.permissions) return { ...emptyPermissions(), ...role.permissions };
  }
  return DEFAULT_PERMISSIONS[user.role] || emptyPermissions();
}

/** Does the user have `action` on `module`? */
export async function can(user, module, action) {
  const perms = await effectivePermissions(user);
  return Boolean(perms?.[module]?.[action]);
}

/**
 * Route gate. Usage: router.post('/x', requirePermission('jobs', 'create'), handler)
 * Applied on top of authenticate + rbac; super_admin/company_admin always pass.
 */
export function requirePermission(module, action) {
  return asyncHandler(async (req, _res, next) => {
    if (await can(req.user, module, action)) return next();
    throw ApiError.forbidden(`You don't have permission to ${action} ${module}.`);
  });
}
