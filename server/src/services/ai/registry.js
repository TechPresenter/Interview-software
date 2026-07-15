import { AiProvider } from '../../models/AiProvider.js';
import { AiUsage } from '../../models/AiUsage.js';
import { chat as providerChat, providerMeta } from './providers.js';
import { invalidateAiStatusCache, providerRoutingQuery } from './ai.status.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

/**
 * Provider registry: resolves which configured AiProvider(s) serve a module and
 * runs a chat with automatic failover. Usage + health are recorded per call.
 *
 * A provider is a candidate for a module if it is the default OR explicitly lists
 * the module in its `modules` array. Candidates are tried in priority order
 * (lower `priority` first, default first); the first success wins.
 *
 * `module` is the caller's `feature` name, so every routable feature must be an
 * AI_MODULES member (models/AiProvider.js) or only the default can serve it.
 */

// Rough, generic token pricing ($/1M) when a provider-specific rate is unknown.
function estimateCost({ inputTokens = 0, outputTokens = 0 }) {
  return Number(((inputTokens / 1e6) * 1 + (outputTokens / 1e6) * 3).toFixed(6));
}

async function recordUsage({ provider, feature, model, usage = {}, latencyMs, success, company }) {
  try {
    await AiUsage.create({
      company,
      provider: provider?._id,
      providerType: provider?.type,
      feature,
      model: model || 'unknown',
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
      costUsd: estimateCost(usage),
      latencyMs,
      success,
    });
  } catch (err) {
    logger.error({ err: err?.message }, 'AiUsage record failed');
  }
}

// Cheap guard so the AI hot path doesn't query Mongo on every call when no
// providers are configured. Cached for 15s.
let countAt = 0;
let countVal = 0;
async function activeProviderCount() {
  if (Date.now() - countAt < 15000) return countVal;
  countVal = await AiProvider.countDocuments({ isActive: true });
  countAt = Date.now();
  return countVal;
}
/** Invalidate the active-provider cache (call after create/update/delete). */
export function invalidateProviderCache() {
  countAt = 0;
  invalidateAiStatusCache();
}

function toConfig(doc) {
  return {
    type: doc.type,
    apiKey: doc.getApiKey(),
    baseUrl: doc.baseUrl,
    apiVersion: doc.apiVersion,
    organization: doc.organization,
    projectId: doc.projectId,
    model: doc.model,
    timeoutMs: doc.timeoutMs,
  };
}

/**
 * OPENAI_API_KEY in the environment, presented as a provider.
 *
 * Registering a provider in the admin panel is the intended path, but putting a
 * key in .env is the obvious thing to try, and an env-only key previously
 * reached nothing at all. It is a LAST-RESORT candidate: a provider the operator
 * explicitly configured in the panel always wins.
 *
 * Duck-types the AiProvider doc surface the failover loop touches — note it has
 * no `_id`, which is what marks it synthetic (there is no row to write health to).
 */
function envOpenAiProvider() {
  if (!config.ai.openai?.enabled) return null;
  return {
    label: 'OpenAI (environment)',
    type: 'openai',
    model: config.ai.openai.model,
    baseUrl: config.ai.openai.baseUrl,
    isDefault: true,
    getApiKey: () => config.ai.openai.apiKey,
  };
}

/**
 * Active providers that can serve `module`, ordered for failover.
 * Routing comes from ai.status.providerRoutingQuery so this and isAiConfigured()
 * cannot disagree — when they did, the guard admitted requests routing refused.
 */
export async function resolveProviders(module, { company } = {}) {
  const docs = await AiProvider.find(providerRoutingQuery(module, { company }))
    .select('+apiKey')
    .sort('priority -isDefault -updatedAt');
  const envProvider = envOpenAiProvider();
  return envProvider ? [...docs, envProvider] : docs;
}

/**
 * Run a chat completion through the configured providers for a module, with
 * failover. Returns `null` when no provider is configured/usable so the caller
 * can fall back (e.g. to the built-in Claude SDK).
 *
 * @returns {Promise<null | { text:string, usage:{inputTokens,outputTokens}, provider:{id,label,type} }>}
 */
export async function runChat({ module = 'chat', company, system, messages, maxTokens, temperature, feature }) {
  // The count guard exists to keep Mongo off the hot path when nothing is
  // configured — but an env-configured OpenAI key is not in that count, so it
  // must not short-circuit here.
  if ((await activeProviderCount()) === 0 && !config.ai.openai?.enabled) return null;
  const providers = await resolveProviders(module, { company });
  if (!providers.length) return null;

  for (const doc of providers) {
    if (!doc.getApiKey()) {
      // Undecryptable keys look identical to missing ones downstream, so a rotated
      // AI_ENCRYPTION_KEY/JWT_ACCESS_SECRET presents as "AI is not configured"
      // with no breadcrumb. Say so rather than skipping in silence.
      logger.warn({ provider: doc.label }, 'AI provider has no usable API key (missing, or the encryption key changed); skipping');
      continue;
    }
    const start = Date.now();
    const model = doc.model || providerMeta(doc.type).defaultModel;
    try {
      const out = await providerChat(toConfig(doc), { system, messages, maxTokens, temperature });
      const latencyMs = Date.now() - start;
      // The env provider has no row to record health against.
      if (doc._id) {
        await AiProvider.findByIdAndUpdate(doc._id, {
          $set: { health: 'healthy', lastSuccessAt: new Date(), lastLatencyMs: latencyMs },
        });
      }
      await recordUsage({ provider: doc, feature: feature || module, model, usage: out.usage, latencyMs, success: true, company });
      return { text: out.text, usage: out.usage, provider: { id: doc._id ? String(doc._id) : 'env', label: doc.label, type: doc.type } };
    } catch (err) {
      const latencyMs = Date.now() - start;
      logger.warn({ provider: doc.label, err: err?.message }, 'AI provider failed; trying next');
      if (doc._id) {
        await AiProvider.findByIdAndUpdate(doc._id, {
          $set: { health: 'down', lastErrorAt: new Date(), lastError: String(err?.message || 'error').slice(0, 300), lastLatencyMs: latencyMs },
        });
      }
      await recordUsage({ provider: doc, feature: feature || module, model, usage: {}, latencyMs, success: false, company });
      // failover → next provider
    }
  }
  return null;
}

export default { runChat, resolveProviders, invalidateProviderCache };
