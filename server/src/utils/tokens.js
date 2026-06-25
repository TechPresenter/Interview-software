import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { config } from '../config/index.js';
import { redis } from '../config/redis.js';

/**
 * Token strategy
 * --------------
 * - Access token: short-lived JWT carrying { sub, role, company, tv }.
 * - Refresh token: long-lived JWT carrying a unique jti. The jti is stored in
 *   Redis (key refresh:{userId}:{jti}) so individual refresh tokens can be
 *   revoked (logout, rotation, "log out everywhere" via tokenVersion bump).
 */

const refreshKey = (userId, jti) => `refresh:${userId}:${jti}`;

/** @param {import('../models/User.js').User} user */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, company: user.company ? String(user.company) : null, tv: user.tokenVersion },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpires },
  );
}

/** Signs a refresh token and registers its jti in Redis. */
export async function issueRefreshToken(user) {
  const jti = nanoid(24);
  const token = jwt.sign({ sub: String(user._id), jti, tv: user.tokenVersion }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires,
  });
  // TTL roughly matches token lifetime (7d default).
  await redis.set(refreshKey(user._id, jti), '1', 'EX', 60 * 60 * 24 * 7);
  return token;
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/** Verifies a refresh token AND confirms its jti is still active in Redis. */
export async function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret);
  const exists = await redis.exists(refreshKey(payload.sub, payload.jti));
  if (!exists) {
    const err = new Error('Refresh token revoked');
    err.name = 'TokenExpiredError';
    throw err;
  }
  return payload;
}

/** Revokes a single refresh token (logout). */
export async function revokeRefreshToken(userId, jti) {
  await redis.del(refreshKey(userId, jti));
}

/** Revokes every refresh token for a user (log out everywhere). */
export async function revokeAllRefreshTokens(userId) {
  const keys = await redis.keys(refreshKey(userId, '*'));
  if (keys.length) await redis.del(...keys);
}

/** Issues a fresh access+refresh pair (used at login and on rotation). */
export async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user);
  return { accessToken, refreshToken };
}
