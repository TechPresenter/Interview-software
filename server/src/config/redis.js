import { Redis } from 'ioredis';
import { config } from './index.js';
import { logger } from './logger.js';

/**
 * Shared Redis client used for sessions/refresh tokens, OTP codes, caching,
 * rate limiting, and the Socket.IO adapter. `maxRetriesPerRequest: null` keeps
 * the client usable with the Socket.IO Redis adapter.
 */
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => logger.info('🧱 Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

/** Returns a duplicated connection (needed for Socket.IO pub/sub adapter). */
export const duplicateRedis = () => redis.duplicate();

export default redis;
