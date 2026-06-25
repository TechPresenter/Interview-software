import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/enums.js';

/**
 * Resolves the company scope for the request. super_admin may pass an explicit
 * ?company=... (or x-company-id header) to act on any tenant; everyone else is
 * locked to their own company. Sets req.companyId for downstream queries.
 */
export function resolveTenant(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());

  if (req.user.role === ROLES.SUPER_ADMIN) {
    req.companyId = req.query.company || req.headers['x-company-id'] || null;
    return next();
  }

  if (!req.user.company) {
    return next(ApiError.forbidden('No company associated with this account'));
  }
  req.companyId = String(req.user.company);
  next();
}

/** Like resolveTenant but requires a concrete company (rejects null scope). */
export function requireTenant(req, res, next) {
  resolveTenant(req, res, (err) => {
    if (err) return next(err);
    if (!req.companyId) return next(ApiError.badRequest('A company context is required'));
    next();
  });
}

export default resolveTenant;
