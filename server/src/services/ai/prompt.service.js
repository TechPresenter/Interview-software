import mongoose from 'mongoose';
import { PromptTemplate } from '../../models/PromptTemplate.js';
import { interpolate } from '../template.service.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { DEFAULT_PROMPTS } from './prompts/defaults.js';

/**
 * Resolves the prompt an engine should send: the super-admin's active template
 * from the database when there is one, the tuned built-in otherwise.
 *
 * THE CALLER CONTRACT
 * -------------------
 * `renderPrompt(key, input)` takes the same named arguments the built-in builder
 * takes — `{ jobTitle, jobDescription, skills, ... }`, not a flat bag of strings.
 * defaults.js turns those into the {{placeholder}} bag, which is what keeps the
 * truncation caps and conditional blocks out of admin hands (see defaults.js).
 * Callers therefore never assemble prompt text themselves.
 *
 * NOTHING HERE MAY BREAK AN INTERVIEW. Every database and template failure falls
 * back to the built-in and logs; a prompt lookup is not worth a candidate's
 * interview. The one deliberate exception is an unknown `key`, which is a coding
 * error with no default to fall back to, so it throws.
 */

/**
 * Active templates are read on every question, so they are cached in memory.
 * The TTL is short and every write calls invalidatePromptCache(), which is what
 * makes an admin's edit take effect immediately with no server restart.
 *
 * Caveat worth knowing: this cache is per-process, unlike the Redis-backed
 * settings cache. The invalidation on write is immediate for the process that
 * served the write, and other instances converge within the TTL.
 */
const CACHE_TTL_MS = 15_000;
const cache = new Map();

/** Mirrors the {{var}} syntax of template.service.js `interpolate`; keep them in step. */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Drop cached templates for one key, or all of them. Call after every write. */
export function invalidatePromptCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

function requireDefault(key) {
  const def = DEFAULT_PROMPTS[key];
  if (!def) throw ApiError.internal(`Unknown prompt key "${key}"`);
  return def;
}

/** A body an admin has blanked cannot be sent to the model; treat it as absent. */
const isUsable = (doc) => Boolean(doc && String(doc.template || '').trim());

/**
 * The active template for a key, or null to mean "use the built-in".
 *
 * Never throws: a Mongo outage resolves to the built-in default. Failures are not
 * cached, so recovery is immediate rather than TTL-delayed.
 *
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export async function getActiveTemplate(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.doc;
  // Without a live connection mongoose buffers the query for bufferTimeoutMS (10s
  // by default) before rejecting. On the AI hot path that would stall every
  // question of every interview for ten seconds to reach a fallback we can pick
  // instantly, so check first rather than pay for the timeout.
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const doc = await PromptTemplate.findOne({ key, isActive: true }).lean();
    // Cache the miss too — an unseeded install would otherwise hit Mongo on every question.
    const resolved = isUsable(doc) ? doc : null;
    if (doc && !resolved) logger.warn({ key }, 'active prompt template has an empty body; using the built-in');
    cache.set(key, { at: Date.now(), doc: resolved });
    return resolved;
  } catch (err) {
    logger.error({ err, key }, 'prompt template lookup failed; using the built-in');
    return null;
  }
}

/**
 * Render a prompt into the { system, messages } shape the AI client consumes.
 *
 * @param {string} key one of PROMPT_KEYS
 * @param {object} input the engine's named arguments (see defaults.js per key)
 * @returns {Promise<{system: string, messages: Array<{role: string, content: string}>}>}
 */
export async function renderPrompt(key, input = {}) {
  const def = requireDefault(key);
  // Deliberately not guarded: a malformed `input` throws exactly as the built-in
  // template literal did before, which is the honest signal for a caller bug.
  const flat = def.vars(input || {});
  const active = await getActiveTemplate(key);
  if (active) {
    try {
      return build(active, flat);
    } catch (err) {
      logger.error({ err, key }, 'stored prompt template failed to render; using the built-in');
    }
  }
  return build(def, flat);
}

const build = (source, flat) => ({
  system: interpolate(source.system, flat),
  messages: [{ role: 'user', content: interpolate(source.template, flat) }],
});

/**
 * Render for the admin panel: the fully-interpolated prompt plus the placeholders
 * that resolved to nothing, so an edit can be checked before it reaches a
 * candidate. `draft` previews unsaved text; omit it to preview what is live.
 *
 * @param {string} key
 * @param {object} [input] sample values, in the same shape renderPrompt takes
 * @param {{system?: string, template?: string}} [draft] unsaved bodies to preview instead
 */
export async function previewPrompt(key, input = {}, draft = undefined) {
  const def = requireDefault(key);
  const flat = def.vars(input || {});
  const active = await getActiveTemplate(key);

  // What a save would actually replace: the live template if there is one, else
  // the built-in.
  const base = active || def;

  // A draft LAYERS over that base, field by field. Treating it as all-or-nothing
  // got both single-field cases wrong: editing only the system prompt previewed
  // the unedited built-in, and editing only the body previewed an empty system
  // prompt — in both cases showing the admin something that would never be sent.
  const hasDraft = draft && (draft.system !== undefined || draft.template !== undefined);
  const source = hasDraft
    ? { system: draft.system ?? base.system, template: draft.template ?? base.template }
    : base;
  const origin = hasDraft ? 'draft' : (active ? 'database' : 'default');

  return {
    key,
    source: origin,
    ...build(source, flat),
    unfilled: unfilledIn([source.system, source.template], flat),
    variables: def.variables,
  };
}

/**
 * Placeholders that rendered as nothing — either unsupplied, or named something
 * the prompt does not define (a typo). A conditional block that is legitimately
 * empty lands here too, which is the point: an admin previewing without a
 * knowledge base should see that {{knowledgeBlock}} contributed nothing.
 */
function unfilledIn(strings, flat) {
  const out = new Set();
  for (const str of strings) {
    for (const [, name] of String(str || '').matchAll(PLACEHOLDER)) {
      const val = name.split('.').reduce((o, k) => (o == null ? undefined : o[k]), flat);
      if (val == null || val === '') out.add(name);
    }
  }
  return [...out];
}

export default { renderPrompt, previewPrompt, getActiveTemplate, invalidatePromptCache };
