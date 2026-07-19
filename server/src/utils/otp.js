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

/** Wrong guesses tolerated before a code is burned. 6 digits × 5 tries keeps
 *  the guess probability ~1 in 180k per code, whatever the caller's IP pool. */
const MAX_ATTEMPTS = 5;

/**
 * Compare-and-delete in one Redis round-trip (Lua), with a failed-attempt
 * counter that burns the code after MAX_ATTEMPTS wrong guesses.
 *
 * Atomicity matters: a GET-then-DEL lets two concurrent requests carrying the
 * same valid code both read the hash before either deletes it — both "verify"
 * and both proceed to create. The attempt cap matters more: per-IP rate limits
 * are per-IP, and a 6-digit code that survives its full TTL is brute-forceable
 * from a rotating pool. A counter attached to the code itself is not.
 *
 * KEYS[1]=code key, KEYS[2]=attempts key; ARGV[1]=hash, ARGV[2]=max attempts.
 * Returns 1 on match (code + counter consumed), 0 on mismatch/burned/missing.
 */
const VERIFY_LUA = `
local stored = redis.call('GET', KEYS[1])
if not stored then return 0 end
if stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  local ttl = redis.call('TTL', KEYS[1])
  if ttl > 0 then redis.call('EXPIRE', KEYS[2], ttl) end
end
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1], KEYS[2])
end
return 0
`;

/** Verifies a code and deletes it on success (single-use). */
export async function verifyCode(scope, id, code) {
  const k = key(scope, id);
  const result = await redis.eval(VERIFY_LUA, 2, k, `attempts:${scope}:${id}`, hash(code), MAX_ATTEMPTS);
  return result === 1;
}

/** Is a code currently outstanding for this scope/id? (existence only). */
export async function hasCode(scope, id) {
  return (await redis.exists(key(scope, id))) === 1;
}

/**
 * Short-lived staged payloads (e.g. a registration waiting on its email OTP).
 * Plain JSON in Redis under the same namespacing as the codes — the caller is
 * responsible for encrypting anything secret inside `data` before it gets here.
 */
export async function setPending(scope, id, data, ttlSeconds = 900) {
  await redis.set(`pending:${scope}:${id}`, JSON.stringify(data), 'EX', ttlSeconds);
}

/** Reads a staged payload WITHOUT consuming it (retry-safe); null if expired. */
export async function getPending(scope, id) {
  const raw = await redis.get(`pending:${scope}:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Deletes a staged payload once it has been acted on. */
export async function clearPending(scope, id) {
  await redis.del(`pending:${scope}:${id}`);
}

/**
 * A once-per-window gate for code re-sends: true when the caller may send now
 * (and the window is claimed atomically), false while a previous send's window
 * is still open. Separate from the auth rate limiter, which only counts
 * FAILURES — successful re-send requests would otherwise be free spam.
 */
export async function claimSendWindow(scope, id, seconds = 60) {
  const ok = await redis.set(`cooldown:${scope}:${id}`, '1', 'EX', seconds, 'NX');
  return ok === 'OK';
}
