import { SystemSetting } from '../../models/SystemSetting.js';
import { redis } from '../../config/redis.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';
import { CATEGORIES, INTEGRATIONS, INTEGRATION_MAP } from '../../config/integrations.catalog.js';

/**
 * Admin management of tracking / analytics / marketing integrations. Config is
 * stored in the SystemSetting key/value store under the `integrations` group,
 * one document per integration (key `integration.<key>`, value `{ enabled, …fields }`).
 * Secret fields are masked on read and preserved on write when unchanged.
 */

const MASK = '••••••••';
const settingKey = (key) => `integration.${key}`;
const secretKeys = (def) => (def.fields || []).filter((f) => f.secret).map((f) => f.key);
const maskValue = (v) => (typeof v === 'string' && v ? (v.length <= 4 ? MASK : `${MASK}${v.slice(-4)}`) : v);
const isFilled = (def, val) => (def.fields || []).every((f) => val[f.key] != null && String(val[f.key]).trim() !== '');

/** Map of stored config objects keyed by integration key. */
async function loadStored() {
  const docs = await SystemSetting.find({ group: 'integrations' }).lean();
  const map = {};
  for (const d of docs) map[d.key.replace(/^integration\./, '')] = d.value || {};
  return map;
}

/** GET /admin/integrations — catalog merged with saved values (secrets masked). */
export const list = asyncHandler(async (_req, res) => {
  const stored = await loadStored();
  const integrations = INTEGRATIONS.map((def) => {
    const val = stored[def.key] || {};
    const secrets = secretKeys(def);
    const values = {};
    for (const f of def.fields || []) {
      const raw = val[f.key];
      values[f.key] = secrets.includes(f.key) ? maskValue(raw) : raw ?? '';
    }
    return {
      key: def.key,
      name: def.name,
      category: def.category,
      description: def.description,
      docs: def.docs || '',
      fields: def.fields || [],
      hasClientSnippet: Boolean(def.inject || def.injectFooter || def.injectJs),
      isWebhook: def.test === 'webhook',
      enabled: Boolean(val.enabled),
      configured: isFilled(def, val),
      values,
    };
  });
  return ok(res, { categories: CATEGORIES, integrations });
});

/** PUT /admin/integrations/:key — enable/disable + save fields. */
export const save = asyncHandler(async (req, res) => {
  const def = INTEGRATION_MAP[req.params.key];
  if (!def) throw ApiError.notFound('Unknown integration');

  const key = settingKey(def.key);
  const existing = (await SystemSetting.findOne({ key }).lean())?.value || {};
  const incoming = req.body || {};
  const secrets = secretKeys(def);

  const value = { ...existing, enabled: Boolean(incoming.enabled) };
  for (const f of def.fields || []) {
    if (!(f.key in incoming)) continue;
    const v = incoming[f.key];
    // Never overwrite a stored secret with its mask placeholder.
    if (secrets.includes(f.key) && typeof v === 'string' && v.includes('•')) continue;
    value[f.key] = typeof v === 'string' ? v.trim() : v;
  }

  await SystemSetting.updateOne(
    { key },
    { $set: { group: 'integrations', value, isSecret: secrets.length > 0, description: def.name, updatedBy: req.user._id } },
    { upsert: true },
  );
  await Promise.all([redis.del(`setting:${key}`), redis.del('tracking:public')]);
  await audit({ req, action: 'integration.update', entityType: 'Integration', entityId: def.key, meta: { enabled: value.enabled } });

  return ok(res, { key: def.key, enabled: value.enabled, configured: isFilled(def, value) }, value.enabled ? 'Integration enabled' : 'Saved');
});

/** POST /admin/integrations/:key/test — verify the connection. */
export const test = asyncHandler(async (req, res) => {
  const def = INTEGRATION_MAP[req.params.key];
  if (!def) throw ApiError.notFound('Unknown integration');
  const stored = (await SystemSetting.findOne({ key: settingKey(def.key) }).lean())?.value || {};

  // Webhooks can be verified for real by delivering a test payload.
  if (def.test === 'webhook') {
    const url = stored.webhookUrl;
    if (!url) throw ApiError.badRequest('Add the webhook URL first');
    const body =
      def.key === 'slack' ? { text: '✅ HireSense test — your Slack webhook is connected.' }
        : def.key === 'discord' ? { content: '✅ HireSense test — your Discord webhook is connected.' }
          : { event: 'test', source: 'HireSense', at: new Date().toISOString() };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      clearTimeout(timer);
      const success = r.status >= 200 && r.status < 300;
      await audit({ req, action: 'integration.test', status: success ? 'success' : 'failure', entityType: 'Integration', entityId: def.key });
      return ok(res, { ok: success, status: r.status }, success ? 'Test payload delivered' : `Endpoint returned HTTP ${r.status}`);
    } catch (e) {
      return ok(res, { ok: false, error: e.message }, 'Could not reach the endpoint');
    }
  }

  // Client-side pixels/scripts can't be verified from the server — check config completeness.
  const missing = (def.fields || []).filter((f) => stored[f.key] == null || String(stored[f.key]).trim() === '').map((f) => f.label);
  const success = missing.length === 0;
  await audit({ req, action: 'integration.test', status: success ? 'success' : 'failure', entityType: 'Integration', entityId: def.key });
  return ok(
    res,
    { ok: success, missing, clientSide: Boolean(def.inject) },
    success ? (def.inject ? 'Configured — snippet will load on the site' : 'Configuration complete') : `Missing: ${missing.join(', ')}`,
  );
});
