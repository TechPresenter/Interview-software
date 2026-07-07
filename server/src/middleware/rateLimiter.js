import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import { config } from '../config/index.js';

const store = () =>
  new RedisStore({
    // ioredis call signature
    sendCommand: (...args) => redis.call(...args),
  });

/** Global limiter applied to the whole API surface. */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: store(),
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
  store: store(),
  skip: () => !config.isProd, // no form throttling in local development
  message: { success: false, message: 'Too many submissions, please try again in a little while.' },
});

/** Stricter limiter for auth endpoints (brute-force protection). Disabled in dev. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  store: store(),
  skip: () => !config.isProd, // no auth throttling in local development
  message: { success: false, message: 'Too many auth attempts, try again later.' },
});

export default globalLimiter;
