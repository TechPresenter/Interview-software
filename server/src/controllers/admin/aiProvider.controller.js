import { AiProvider, PROVIDER_TYPES, AI_MODULES } from '../../models/AiProvider.js';
import { AiUsage } from '../../models/AiUsage.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';
import { encryptSecret, isEncrypted } from '../../utils/crypto.js';
import { testConnection, providerMeta, PROVIDER_META } from '../../services/ai/providers.js';
import { invalidateProviderCache } from '../../services/ai/registry.js';

/** Strip the secret from a provider object; expose a hasKey flag instead. */
const mask = (p) => ({ ...p, apiKey: undefined, hasKey: Boolean(p.apiKey) });

/** GET /admin/ai-providers — list providers (+ static catalog of types/modules). */
export const list = asyncHandler(async (_req, res) => {
  const items = await AiProvider.find().select('+apiKey').sort('-isDefault priority -createdAt').lean();
  const catalog = PROVIDER_TYPES.map((t) => ({ type: t, label: PROVIDER_META[t].label, defaultModel: PROVIDER_META[t].defaultModel, baseUrl: PROVIDER_META[t].baseUrl }));
  return ok(res, { providers: items.map(mask), catalog, modules: AI_MODULES });
});

/** POST /admin/ai-providers */
export const create = asyncHandler(async (req, res) => {
  if (!PROVIDER_TYPES.includes(req.body.type)) throw ApiError.badRequest('Unknown provider type');
  const body = { ...req.body, createdBy: req.user._id };
  if (body.apiKey) body.apiKey = encryptSecret(body.apiKey);
  const provider = await AiProvider.create(body);
  if (req.body.isDefault) await AiProvider.setDefault(provider._id);
  invalidateProviderCache();
  await audit({ req, action: 'ai_provider.create', entityType: 'AiProvider', entityId: provider._id });
  return created(res, mask(provider.toObject()), 'Provider added');
});

/** PATCH /admin/ai-providers/:id */
export const update = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  // Don't overwrite the key when the field is left blank in the UI.
  if (body.apiKey === '' || body.apiKey == null) delete body.apiKey;
  else body.apiKey = encryptSecret(body.apiKey);
  const provider = await AiProvider.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
  if (!provider) throw ApiError.notFound('Provider not found');
  if (body.isDefault) await AiProvider.setDefault(provider._id);
  invalidateProviderCache();
  await audit({ req, action: 'ai_provider.update', entityType: 'AiProvider', entityId: provider._id });
  return ok(res, mask(provider.toObject()), 'Provider updated');
});

/** POST /admin/ai-providers/:id/default */
export const setDefault = asyncHandler(async (req, res) => {
  const provider = await AiProvider.setDefault(req.params.id);
  if (!provider) throw ApiError.notFound('Provider not found');
  invalidateProviderCache();
  await audit({ req, action: 'ai_provider.set_default', entityType: 'AiProvider', entityId: provider._id });
  return ok(res, mask(provider.toObject()), 'Default provider set');
});

/** DELETE /admin/ai-providers/:id */
export const remove = asyncHandler(async (req, res) => {
  const provider = await AiProvider.findByIdAndDelete(req.params.id);
  if (!provider) throw ApiError.notFound('Provider not found');
  invalidateProviderCache();
  await audit({ req, action: 'ai_provider.delete', entityType: 'AiProvider', entityId: req.params.id });
  return ok(res, null, 'Provider removed');
});

/**
 * POST /admin/ai-providers/test — test an arbitrary config from the form before
 * saving. If `id` is supplied and no key is in the body, the stored key is used.
 */
export const test = asyncHandler(async (req, res) => {
  const b = { ...req.body };
  if (b.id && !b.apiKey) {
    const existing = await AiProvider.findById(b.id).select('+apiKey');
    if (!existing) throw ApiError.notFound('Provider not found');
    b.apiKey = existing.getApiKey();
    b.type = b.type || existing.type;
    b.model = b.model || existing.model;
    b.baseUrl = b.baseUrl || existing.baseUrl;
    b.apiVersion = b.apiVersion || existing.apiVersion;
    b.organization = b.organization || existing.organization;
    b.projectId = b.projectId || existing.projectId;
  }
  if (!PROVIDER_TYPES.includes(b.type)) throw ApiError.badRequest('Unknown provider type');
  const result = await testConnection({
    type: b.type,
    apiKey: b.apiKey,
    baseUrl: b.baseUrl,
    apiVersion: b.apiVersion,
    organization: b.organization,
    projectId: b.projectId,
    model: b.model,
    timeoutMs: b.timeoutMs || 20000,
  });
  await audit({ req, action: 'ai_provider.test', status: result.ok ? 'success' : 'failure', meta: { type: b.type } });
  return ok(res, result, result.ok ? 'Connection OK' : 'Connection failed');
});

/** POST /admin/ai-providers/:id/test — test a saved provider + update its health. */
export const testExisting = asyncHandler(async (req, res) => {
  const doc = await AiProvider.findById(req.params.id).select('+apiKey');
  if (!doc) throw ApiError.notFound('Provider not found');
  const result = await testConnection({
    type: doc.type,
    apiKey: doc.getApiKey(),
    baseUrl: doc.baseUrl,
    apiVersion: doc.apiVersion,
    organization: doc.organization,
    projectId: doc.projectId,
    model: doc.model,
    timeoutMs: doc.timeoutMs || 20000,
  });
  await AiProvider.findByIdAndUpdate(
    doc._id,
    result.ok
      ? { $set: { health: 'healthy', lastSuccessAt: new Date(), lastLatencyMs: result.latencyMs } }
      : { $set: { health: 'down', lastErrorAt: new Date(), lastError: result.error, lastLatencyMs: result.latencyMs } },
  );
  await audit({ req, action: 'ai_provider.test', status: result.ok ? 'success' : 'failure', entityType: 'AiProvider', entityId: doc._id });
  return ok(res, result, result.ok ? 'Connection OK' : 'Connection failed');
});

/** GET /admin/ai-providers/analytics?days= — per-provider usage, health, errors. */
export const analytics = asyncHandler(async (req, res) => {
  const days = Math.min(365, Number(req.query.days) || 30);
  const since = new Date(Date.now() - days * 864e5);

  const [byProviderRaw, daily, totalsRaw, errors, providers] = await Promise.all([
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since }, provider: { $ne: null } } },
      {
        $group: {
          _id: '$provider',
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$costUsd' },
          calls: { $sum: 1 },
          failures: { $sum: { $cond: ['$success', 0, 1] } },
          lastAt: { $max: '$createdAt' },
          avgLatency: { $avg: '$latencyMs' },
        },
      },
      { $sort: { tokens: -1 } },
    ]),
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, tokens: { $sum: '$totalTokens' }, cost: { $sum: '$costUsd' }, calls: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: null, tokens: { $sum: '$totalTokens' }, cost: { $sum: '$costUsd' }, calls: { $sum: 1 }, failures: { $sum: { $cond: ['$success', 0, 1] } } } },
    ]),
    AiUsage.find({ createdAt: { $gte: since }, success: false }).sort('-createdAt').limit(20).populate('provider', 'label type').lean(),
    AiProvider.find().lean(),
  ]);

  const pmap = Object.fromEntries(providers.map((p) => [String(p._id), p]));
  const byProvider = byProviderRaw.map((r) => {
    const p = pmap[String(r._id)] || {};
    return {
      id: String(r._id),
      provider: p.label || 'Unknown',
      type: p.type,
      health: p.health || 'unknown',
      tokens: r.tokens,
      cost: r.cost,
      calls: r.calls,
      failures: r.failures,
      avgLatencyMs: Math.round(r.avgLatency || 0),
      lastAt: r.lastAt,
    };
  });

  return ok(res, {
    days,
    totals: totalsRaw[0] || { tokens: 0, cost: 0, calls: 0, failures: 0 },
    byProvider,
    daily: daily.map((d) => ({ label: d._id, value: d.tokens, cost: d.cost, calls: d.calls })),
    errors: errors.map((e) => ({ at: e.createdAt, provider: e.provider?.label || e.providerType || '—', feature: e.feature, latencyMs: e.latencyMs })),
  });
});

/** GET /admin/ai-providers/export — backup all provider configs (keys stay encrypted). */
export const exportConfig = asyncHandler(async (req, res) => {
  const docs = await AiProvider.find().select('+apiKey').lean();
  const providers = docs.map((d) => ({
    label: d.label,
    type: d.type,
    apiKey: d.apiKey || null, // encrypted blob
    baseUrl: d.baseUrl,
    apiVersion: d.apiVersion,
    organization: d.organization,
    projectId: d.projectId,
    model: d.model,
    modules: d.modules,
    priority: d.priority,
    timeoutMs: d.timeoutMs,
    maxRetries: d.maxRetries,
    rateLimitPerMin: d.rateLimitPerMin,
    rateLimitPerDay: d.rateLimitPerDay,
    isActive: d.isActive,
    isDefault: d.isDefault,
    notes: d.notes,
  }));
  await audit({ req, action: 'ai_provider.export', meta: { count: providers.length } });
  return ok(res, { version: 1, exportedAt: new Date(), providers }, 'Backup ready');
});

/** POST /admin/ai-providers/import — restore from a backup (upsert by label+type). */
export const importConfig = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body?.providers) ? req.body.providers : [];
  if (!list.length) throw ApiError.badRequest('No providers in the backup');
  let createdCount = 0;
  let updatedCount = 0;
  for (const p of list) {
    if (!p?.type || !PROVIDER_TYPES.includes(p.type) || !p.label) continue;
    const doc = { ...p, createdBy: req.user._id };
    if (p.apiKey) doc.apiKey = isEncrypted(p.apiKey) ? p.apiKey : encryptSecret(p.apiKey);
    else delete doc.apiKey;
    const existing = await AiProvider.findOne({ label: p.label, type: p.type });
    if (existing) {
      await AiProvider.updateOne({ _id: existing._id }, { $set: doc });
      updatedCount += 1;
    } else {
      await AiProvider.create(doc);
      createdCount += 1;
    }
  }
  invalidateProviderCache();
  await audit({ req, action: 'ai_provider.import', meta: { createdCount, updatedCount } });
  return ok(res, { created: createdCount, updated: updatedCount }, `Restored ${createdCount + updatedCount} providers`);
});

/** GET /admin/ai-providers/:id/balance — best-effort credit lookup. */
export const balance = asyncHandler(async (req, res) => {
  const doc = await AiProvider.findById(req.params.id).lean();
  if (!doc) throw ApiError.notFound('Provider not found');
  // Public provider APIs generally do not expose account balance/credits.
  return ok(res, {
    supported: false,
    provider: providerMeta(doc.type).label,
    note: 'Live balance/credit lookup is not exposed by this provider’s public API. Track spend via Usage analytics, or open the provider’s billing console.',
  });
});
