import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import { config } from '../config/index.js';

// Each limiter MUST use a distinct Redis key prefix. Otherwise every limiter
// sharing the default `rl:` prefix increments the SAME per-IP counter — so the
// high-volume global limiter would pump the counter that the auth limiter reads,
// blocking logins after normal browsing ("Too many auth attempts" for everyone).
const store = (prefix) =>
  new RedisStore({
    prefix,
    // ioredis call signature
    sendCommand: (...args) => redis.call(...args),
  });

/** Global limiter applied to the whole API surface. */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: store('rl:global:'),
  skip: () => !config.isProd, // never throttle the whole API in local development
  message: { success: false, message: 'Too many requests, please slow down.' },
});

/**
 * Limiter for public forms (contact + newsletter). Generous in production and
 * fully disabled in development so testing the forms never trips a 429
 * ("Too many submissions"). Real duplicate/spam protection is enforced in the
 * controllers (idempotent upserts + short-window de-duplication).
 */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: store('rl:form:'),
  skip: () => !config.isProd, // no form throttling in local development
  message: { success: false, message: 'Too many submissions, please try again in a little while.' },
});

/**
 * Auth limiter (brute-force protection). Disabled in dev.
 *
 * Two things keep it from locking out legitimate users — the reported
 * "Too many auth attempts" bug behind a reverse proxy:
 *  1. `skipSuccessfulRequests` — only FAILED attempts count, so normal logins
 *     never consume the budget.
 *  2. Bucketed per IP **and** account email — so many users sharing one NAT /
 *     proxy IP don't all share (and exhaust) a single counter.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // failed attempts per (IP + email) per window
  standardHeaders: true,
  legacyHeaders: false,
  store: store('rl:auth:'),
  skip: () => !config.isProd, // no auth throttling in local development
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase().trim()}`,
  validate: { trustProxy: false }, // we intentionally derive the key ourselves
  message: { success: false, message: 'Too many failed attempts. Please wait a few minutes and try again.' },
});

export default globalLimiter;
