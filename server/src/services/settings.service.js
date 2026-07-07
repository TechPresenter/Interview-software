import { SystemSetting } from '../models/SystemSetting.js';
import { redis } from '../config/redis.js';

/**
 * Typed accessors over the SystemSetting key/value store, with a short Redis
 * cache. Secret values are masked when read for display but kept intact in the DB.
 */

const CACHE_TTL = 60; // seconds
const cacheKey = (key) => `setting:${key}`;
const MASK = '••••••••';

/** Keys whose values must never be returned in plaintext to the client. */
const SECRET_HINT = /(secret|password|pass|key|token)/i;

/** Get a single setting value (cached). Returns `fallback` if unset. */
export async function getSetting(key, fallback = null) {
  const cached = await redis.get(cacheKey(key));
  if (cached != null) return JSON.parse(cached);
  const doc = await SystemSetting.findOne({ key }).lean();
  const value = doc ? doc.value : fallback;
  await redis.set(cacheKey(key), JSON.stringify(value), 'EX', CACHE_TTL);
  return value;
}

/** Get all settings in a group, masking secret-looking values for display. */
export async function getGroup(group, { unmask = false } = {}) {
  const docs = await SystemSetting.find({ group }).lean();
  return docs.map((d) => ({
    key: d.key,
    group: d.group,
    description: d.description,
    isSecret: d.isSecret,
    value: !unmask && (d.isSecret || (typeof d.value === 'string' && SECRET_HINT.test(d.key)))
      ? maskValue(d.value)
      : d.value,
    updatedAt: d.updatedAt,
  }));
}

/** Upsert a batch of settings within a group. */
export async function setMany(group, entries, userId) {
  // Never overwrite a stored secret with its masked placeholder (••••1234): if a
  // secret field still contains the mask char, the admin didn't change it.
  const clean = (entries || []).filter((e) => {
    const secret = Boolean(e.isSecret) || SECRET_HINT.test(e.key);
    if (secret && typeof e.value === 'string' && e.value.includes('•')) return false;
    return true;
  });
  const ops = clean.map(({ key, value, isSecret, description }) => ({
    updateOne: {
      filter: { key },
      update: {
        $set: {
          group,
          value,
          isSecret: Boolean(isSecret) || SECRET_HINT.test(key),
          description,
          updatedBy: userId,
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await SystemSetting.bulkWrite(ops);
  // Invalidate cache for touched keys.
  await Promise.all(clean.map((e) => redis.del(cacheKey(e.key))));
  return getGroup(group);
}

function maskValue(value) {
  if (typeof value !== 'string' || !value) return value ? MASK : value;
  return value.length <= 4 ? MASK : `${MASK}${value.slice(-4)}`;
}

/** Default AI competency weightage (mirrors scoring.engine defaults). */
export const DEFAULT_AI_WEIGHTAGE = {
  technical: 0.3,
  problemSolving: 0.2,
  communication: 0.15,
  behavioral: 0.1,
  confidence: 0.1,
  leadership: 0.075,
  culturalFit: 0.075,
};

export async function getAiWeightage() {
  return getSetting('ai.weightage', DEFAULT_AI_WEIGHTAGE);
}
