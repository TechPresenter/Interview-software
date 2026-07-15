import { AiProvider, PROVIDER_TYPES } from '../../models/AiProvider.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';
import { aiStatus, testProvider } from '../../services/ai/ai.status.js';

/**
 * AI connection diagnostics. Distinct from ai.controller's testConnection, which
 * only ever speaks to the built-in Anthropic key: these endpoints report on every
 * configured provider and say what is wrong rather than just that something is.
 *
 * API keys are never logged, audited or returned — presence and last4 only.
 */

/** Health written for a test outcome. A rate limit means the key works, so the
 *  provider is degraded rather than down. */
function healthUpdate(result) {
  if (result.ok) return { $set: { health: 'healthy', lastSuccessAt: new Date(), lastLatencyMs: result.latencyMs, lastError: null } };
  if (result.status === 'rate_limited') {
    return { $set: { health: 'degraded', lastErrorAt: new Date(), lastError: String(result.message).slice(0, 300), lastLatencyMs: result.latencyMs } };
  }
  return { $set: { health: 'down', lastErrorAt: new Date(), lastError: String(result.message).slice(0, 300), lastLatencyMs: result.latencyMs } };
}

/** GET /admin/ai/status — is AI configured, by what, and what is wrong with it. */
export const status = asyncHandler(async (_req, res) => {
  return ok(res, await aiStatus());
});

/**
 * POST /admin/ai/status/test — test a saved provider by `id`, or an ad-hoc
 * { type, apiKey, baseUrl, model } config from the form before it is saved.
 * Testing a saved provider updates its health.
 */
export const test = asyncHandler(async (req, res) => {
  const { id, type, apiKey, baseUrl, apiVersion, organization, projectId, model, timeoutMs } = req.body || {};

  let cfg = { type, apiKey, baseUrl, apiVersion, organization, projectId, model, timeoutMs: timeoutMs || 20000 };
  let doc = null;
  if (id) {
    doc = await AiProvider.findById(id).select('+apiKey');
    if (!doc) throw ApiError.notFound('Provider not found');
    cfg = {
      type: type || doc.type,
      // An explicit key in the body is a not-yet-saved edit; otherwise use the stored one.
      apiKey: apiKey || doc.getApiKey(),
      baseUrl: baseUrl || doc.baseUrl,
      apiVersion: apiVersion || doc.apiVersion,
      organization: organization || doc.organization,
      projectId: projectId || doc.projectId,
      model: model || doc.model,
      timeoutMs: timeoutMs || doc.timeoutMs || 20000,
    };
  }
  if (!PROVIDER_TYPES.includes(cfg.type)) throw ApiError.badRequest('Unknown provider type');

  const result = await testProvider(cfg);
  if (doc) await AiProvider.findByIdAndUpdate(doc._id, healthUpdate(result));
  await audit({
    req,
    action: 'ai.status.test',
    status: result.ok ? 'success' : 'failure',
    entityType: doc ? 'AiProvider' : undefined,
    entityId: doc?._id,
    meta: { type: cfg.type, result: result.status },
  });
  return ok(res, result, result.message);
});

/** POST /admin/ai/status/test-all — test every active provider and refresh health. */
export const testAll = asyncHandler(async (req, res) => {
  const docs = await AiProvider.find({ isActive: true }).select('+apiKey').sort('-isDefault priority');
  const results = await Promise.all(
    docs.map(async (doc) => {
      const result = await testProvider({
        type: doc.type,
        apiKey: doc.getApiKey(),
        baseUrl: doc.baseUrl,
        apiVersion: doc.apiVersion,
        organization: doc.organization,
        projectId: doc.projectId,
        model: doc.model,
        timeoutMs: doc.timeoutMs || 20000,
      });
      await AiProvider.findByIdAndUpdate(doc._id, healthUpdate(result));
      return { id: String(doc._id), name: doc.label, type: doc.type, isDefault: Boolean(doc.isDefault), ...result };
    }),
  );
  const healthy = results.filter((r) => r.ok).length;
  await audit({ req, action: 'ai.status.test_all', status: healthy ? 'success' : 'failure', meta: { tested: results.length, healthy } });
  return ok(res, { tested: results.length, healthy, results }, `${healthy}/${results.length} providers reachable`);
});
