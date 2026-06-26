import { AiProvider } from '../../models/AiProvider.js';
import { AiUsage } from '../../models/AiUsage.js';
import { chat as providerChat, providerMeta } from './providers.js';
import { logger } from '../../config/logger.js';

/**
 * Provider registry: resolves which configured AiProvider(s) serve a module and
 * runs a chat with automatic failover. Usage + health are recorded per call.
 *
 * A provider is a candidate for a module if it is the default OR explicitly lists
 * the module in its `modules` array. Candidates are tried in priority order
 * (lower `priority` first, default first); the first success wins.
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

/** Active providers that can serve `module`, ordered for failover. */
export async function resolveProviders(module, { company } = {}) {
  const or = [{ company: null }];
  if (company) or.push({ company });
  const docs = await AiProvider.find({ isActive: true, $or: or }).select('+apiKey').sort('priority -isDefault -updatedAt');
  return docs.filter((d) => d.isDefault || (module && (d.modules || []).includes(module)));
}

/**
 * Run a chat completion through the configured providers for a module, with
 * failover. Returns `null` when no provider is configured/usable so the caller
 * can fall back (e.g. to the built-in Claude SDK).
 *
 * @returns {Promise<null | { text:string, usage:{inputTokens,outputTokens}, provider:{id,label,type} }>}
 */
export async function runChat({ module = 'chat', company, system, messages, maxTokens, temperature, feature }) {
  if ((await activeProviderCount()) === 0) return null;
  const providers = await resolveProviders(module, { company });
  if (!providers.length) return null;

  for (const doc of providers) {
    if (!doc.getApiKey()) continue;
    const start = Date.now();
    const model = doc.model || providerMeta(doc.type).defaultModel;
    try {
      const out = await providerChat(toConfig(doc), { system, messages, maxTokens, temperature });
      const latencyMs = Date.now() - start;
      await AiProvider.findByIdAndUpdate(doc._id, {
        $set: { health: 'healthy', lastSuccessAt: new Date(), lastLatencyMs: latencyMs },
      });
      await recordUsage({ provider: doc, feature: feature || module, model, usage: out.usage, latencyMs, success: true, company });
      return { text: out.text, usage: out.usage, provider: { id: String(doc._id), label: doc.label, type: doc.type } };
    } catch (err) {
      const latencyMs = Date.now() - start;
      logger.warn({ provider: doc.label, err: err?.message }, 'AI provider failed; trying next');
      await AiProvider.findByIdAndUpdate(doc._id, {
        $set: { health: 'down', lastErrorAt: new Date(), lastError: String(err?.message || 'error').slice(0, 300), lastLatencyMs: latencyMs },
      });
      await recordUsage({ provider: doc, feature: feature || module, model, usage: {}, latencyMs, success: false, company });
      // failover → next provider
    }
  }
  return null;
}

export default { runChat, resolveProviders, invalidateProviderCache };
