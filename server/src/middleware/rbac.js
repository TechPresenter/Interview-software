import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/enums.js';

/**
 * Role gate. Usage: router.get('/x', authenticate, rbac(ROLES.COMPANY_ADMIN), handler)
 * super_admin always passes.
 * @param {...string} allowedRoles
 */
export function rbac(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === ROLES.SUPER_ADMIN) return next();
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

export default rbac;
