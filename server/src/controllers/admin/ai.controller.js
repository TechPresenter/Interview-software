import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  getGroup,
  setMany,
  getSetting,
  getAiWeightage,
  DEFAULT_AI_WEIGHTAGE,
} from '../../services/settings.service.js';
import { prompts as defaultPrompts } from '../../services/ai/prompts/index.js';
import { complete } from '../../services/ai/claude.client.js';
import { audit } from '../../services/audit.service.js';
import { config } from '../../config/index.js';
import { AiUsage } from '../../models/AiUsage.js';

/** GET /admin/ai/settings — model + generation config (env defaults overlaid). */
export const getSettings = asyncHandler(async (_req, res) => {
  const stored = await getGroup('ai');
  const map = Object.fromEntries(stored.map((s) => [s.key, s.value]));
  return ok(res, {
    model: map['ai.model'] ?? config.ai.model,
    modelFast: map['ai.modelFast'] ?? config.ai.modelFast,
    maxTokens: map['ai.maxTokens'] ?? config.ai.maxTokens,
    temperature: map['ai.temperature'] ?? 0.4,
    enabled: config.ai.enabled,
  });
});

/** PUT /admin/ai/settings */
export const updateSettings = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body).map(([k, value]) => ({ key: `ai.${k}`, value, description: `AI ${k}` }));
  await setMany('ai', entries, req.user._id);
  await audit({ req, action: 'ai.settings.update' });
  return getSettings(req, res);
});

/** POST /admin/ai/test — ping Claude with a tiny prompt and report latency. */
export const testConnection = asyncHandler(async (req, res) => {
  if (!config.ai.enabled) throw ApiError.badRequest('No Anthropic API key configured');
  const start = Date.now();
  try {
    const { text } = await complete({
      messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      maxTokens: 8,
      temperature: 0,
      feature: 'other',
    });
    await audit({ req, action: 'ai.test_connection', status: 'success' });
    return ok(res, { ok: true, model: config.ai.model, latencyMs: Date.now() - start, sample: text.trim().slice(0, 40) }, 'Connection OK');
  } catch (err) {
    await audit({ req, action: 'ai.test_connection', status: 'failure' });
    return ok(res, { ok: false, error: err.message }, 'Connection failed');
  }
});

/** GET /admin/ai/weightage */
export const getWeightage = asyncHandler(async (_req, res) => {
  const weightage = await getAiWeightage();
  return ok(res, { weightage, default: DEFAULT_AI_WEIGHTAGE });
});

/** PUT /admin/ai/weightage — must sum to ~1.0. */
export const updateWeightage = asyncHandler(async (req, res) => {
  const sum = Object.values(req.body).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.01) {
    throw ApiError.badRequest(`Weightage must sum to 1.0 (got ${sum.toFixed(2)})`);
  }
  await setMany('ai', [{ key: 'ai.weightage', value: req.body, description: 'Competency weightage' }], req.user._id);
  await audit({ req, action: 'ai.weightage.update' });
  return ok(res, { weightage: req.body }, 'Weightage updated');
});

/** GET /admin/ai/prompts — stored overrides merged with defaults. */
export const getPrompts = asyncHandler(async (_req, res) => {
  const keys = Object.keys(defaultPrompts);
  const result = [];
  for (const key of keys) {
    const override = await getSetting(`ai.prompt.${key}`, null);
    result.push({
      key,
      isOverridden: Boolean(override),
      system: override?.system ?? '(default)',
      template: override?.template ?? '(uses built-in template — see services/ai/prompts)',
    });
  }
  return ok(res, result);
});

/** PUT /admin/ai/prompts — override a single prompt template. */
export const updatePrompt = asyncHandler(async (req, res) => {
  const { key, system, template } = req.body;
  await setMany(
    'ai',
    [{ key: `ai.prompt.${key}`, value: { system, template }, description: `Prompt: ${key}` }],
    req.user._id,
  );
  await audit({ req, action: 'ai.prompt.update', meta: { key } });
  return ok(res, { key }, 'Prompt template saved');
});

/** GET /admin/ai/usage/top-companies?days= — biggest AI consumers. */
export const topConsumers = asyncHandler(async (req, res) => {
  const days = Math.min(365, Number(req.query.days) || 30);
  const since = new Date(Date.now() - days * 864e5);
  const rows = await AiUsage.aggregate([
    { $match: { createdAt: { $gte: since }, company: { $ne: null } } },
    { $group: { _id: '$company', tokens: { $sum: '$totalTokens' }, cost: { $sum: '$costUsd' } } },
    { $sort: { tokens: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'company' } },
    { $project: { tokens: 1, cost: 1, company: { $arrayElemAt: ['$company.name', 0] } } },
  ]);
  return ok(res, rows);
});
