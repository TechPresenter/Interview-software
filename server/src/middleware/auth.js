import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';

/**
 * Authenticates a request via the Bearer access token. Loads the user, checks it
 * is active, and validates the token version (so a tokenVersion bump invalidates
 * older access tokens immediately on next request).
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or inactive');
  if (user.tokenVersion !== payload.tv) throw ApiError.unauthorized('Session expired, please log in again');

  req.user = user;
  next();
});

/** Soft auth: attaches req.user if a valid token is present, never throws. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive && user.tokenVersion === payload.tv) req.user = user;
  } catch {
    /* ignore invalid token in optional mode */
  }
  next();
});

export default authenticate;
