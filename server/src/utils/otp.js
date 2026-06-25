import crypto from 'node:crypto';
import { redis } from '../config/redis.js';

/**
 * Short-lived numeric/hex codes (email verification, OTP login, password reset),
 * stored hashed in Redis under a namespaced key with a TTL.
 */

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const key = (scope, id) => `code:${scope}:${id}`;

/** Generates a 6-digit numeric code. */
export const generateNumericCode = () => String(crypto.randomInt(100000, 1000000));

/** Generates a URL-safe token (for email links). */
export const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Stores a code for `id` under `scope` for `ttlSeconds` and returns the plain
 * code (to be delivered to the user).
 */
export async function setCode(scope, id, code, ttlSeconds = 600) {
  await redis.set(key(scope, id), hash(code), 'EX', ttlSeconds);
}

/** Verifies a code and deletes it on success (single-use). */
export async function verifyCode(scope, id, code) {
  const stored = await redis.get(key(scope, id));
  if (!stored) return false;
  const match = stored === hash(code);
  if (match) await redis.del(key(scope, id));
  return match;
}
