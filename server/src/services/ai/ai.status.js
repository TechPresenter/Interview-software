import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { AiProvider } from '../../models/AiProvider.js';
import { providerMeta, testConnection } from './providers.js';

/**
 * Single source of truth for "can AI serve a request, and if not, why".
 *
 * config.ai.enabled only answers "is ANTHROPIC_API_KEY set in the env" — it is
 * derived at module load and cannot see the AiProvider collection. A box running
 * entirely on an admin-configured OpenAI provider therefore reported itself as
 * unconfigured, and every guard built on that flag rejected the request before
 * the registry was ever consulted. Ask isAiConfigured() instead.
 */

/** Features question.generator.js passes; both are AI_MODULES members, so a
 *  provider can be routed to them explicitly rather than only via isDefault. */
const GENERATION_FEATURES = ['question_generation', 'answer_key'];

// Mirrors registry.js's activeProviderCount: the guards sit on the request hot
// path, so the lookup is cached briefly rather than hitting Mongo per call.
const CACHE_MS = 15000;
let countAt = 0;
let countVal = 0;

async function activeProviderCount() {
  if (Date.now() - countAt < CACHE_MS) return countVal;
  countVal = await AiProvider.countDocuments({ isActive: true });
  countAt = Date.now();
  return countVal;
}

/**
 * Invalidate the cached provider count. Must be called whenever a provider is
 * created, updated or deleted, or a stale count keeps AI "off" for up to 15s
 * after an admin configures it. registry.invalidateProviderCache() chains here,
 * so the existing mutation sites cover both caches.
 */
export function invalidateAiStatusCache() {
  countAt = 0;
}

/**
 * The Mongo query for "providers that can serve `module`".
 *
 * THE single definition of routing, shared with registry.resolveProviders. It
 * lives here because registry already imports this module (the reverse would be
 * an import cycle). A provider serves a module when it is the default or
 * explicitly lists it; with no module, only defaults qualify.
 *
 * @param {string} [module] e.g. 'question_generation'
 * @param {{company?: string}} [opts]
 */
export function providerRoutingQuery(module, { company } = {}) {
  const scope = [{ company: null }];
  if (company) scope.push({ company });
  const routed = module ? [{ isDefault: true }, { modules: module }] : [{ isDefault: true }];
  return { isActive: true, $and: [{ $or: scope }, { $or: routed }] };
}

/**
 * Whether AI can serve a request: the built-in Anthropic env key, an
 * env-configured OpenAI key, or a saved provider that ROUTES to `module`.
 *
 * Pass the module wherever you can. Asking only "does any provider exist" lets
 * the guard pass a request that routing then refuses — a provider ticked for
 * 'content' alone would satisfy a bare check and then serve nothing, turning a
 * clean "AI is not configured" into a 500 from deeper in the stack.
 *
 * Guarding on config.ai.enabled alone — which only means "ANTHROPIC_API_KEY is
 * set" — is what rejected requests on boxes running perfectly good OpenAI keys.
 *
 * @param {string} [module] the feature about to be served
 * @param {{company?: string}} [opts]
 * @returns {Promise<boolean>}
 */
export async function isAiConfigured(module, { company } = {}) {
  if (config.ai.enabled || config.ai.openai?.enabled) return true;
  try {
    if (!module) return (await activeProviderCount()) > 0;
    return (await AiProvider.countDocuments(providerRoutingQuery(module, { company }))) > 0;
  } catch (err) {
    // Mongo unreachable: report what the env alone can prove rather than failing
    // the caller's request with a status-lookup error.
    logger.warn({ err: err?.message }, 'AI provider lookup failed; falling back to env-only status');
    return false;
  }
}

/** Last 4 characters of a secret. Never return, log or render the key itself. */
const last4 = (secret) => (secret ? String(secret).slice(-4) : null);

/** Provider types that cannot work without an explicit endpoint. */
const NEEDS_BASE_URL = new Set(['azure_openai', 'custom']);

function providerIssues(p, keySaved) {
  const issues = [];
  if (keySaved && !p.hasKey) {
    issues.push({
      level: 'error',
      code: 'key_undecryptable',
      provider: p.id,
      message: `"${p.name}" has a stored API key that cannot be decrypted. AI_ENCRYPTION_KEY — or JWT_ACCESS_SECRET, which it falls back to — has changed since the key was saved. Re-enter the key.`,
    });
  } else if (!keySaved && p.isActive) {
    issues.push({ level: 'error', code: 'no_key', provider: p.id, message: `"${p.name}" is active but has no API key saved.` });
  }
  if (p.isActive && !p.baseUrl && NEEDS_BASE_URL.has(p.type)) {
    issues.push({ level: 'error', code: 'no_base_url', provider: p.id, message: `"${p.name}" needs a base URL: ${p.type === 'azure_openai' ? 'the Azure resource endpoint' : 'the OpenAI-compatible endpoint'} is not set.` });
  }
  if (p.isActive && !p.model) {
    issues.push({ level: 'error', code: 'no_model', provider: p.id, message: `"${p.name}" has no model set and its type has no default${p.type === 'azure_openai' ? ' (Azure needs the deployment name)' : ''}.` });
  }
  if (p.isActive && p.health === 'down' && p.lastError) {
    issues.push({ level: 'warn', code: 'provider_down', provider: p.id, message: `"${p.name}" last failed with: ${p.lastError}` });
  }
  return issues;
}

/**
 * Full diagnostic snapshot for the admin UI: which providers exist, which key is
 * present, what would actually serve a request, and everything currently wrong.
 * Answers, in order: is an API key present, is the base URL set, which provider
 * is selected, which model name is in use, what the env says, what the DB says.
 *
 * Keys are reported by presence and last4 only.
 *
 * @returns {Promise<{configured:boolean, source:'env'|'provider'|'none', providers:object[],
 *   envKeyPresent:boolean, envKeyLast4:string|null, defaultModel:string|null, issues:object[]}>}
 */
export async function aiStatus() {
  const docs = await AiProvider.find().select('+apiKey').sort('-isDefault priority -createdAt');

  const issues = [];
  const providers = docs.map((d) => {
    const keySaved = Boolean(d.apiKey);
    const key = d.getApiKey();
    const meta = providerMeta(d.type);
    const p = {
      id: String(d._id),
      name: d.label,
      type: d.type,
      model: d.model || meta.defaultModel || null,
      baseUrl: d.baseUrl || meta.baseUrl || null,
      isDefault: Boolean(d.isDefault),
      isActive: Boolean(d.isActive),
      modules: d.modules || [],
      hasKey: Boolean(key),
      keyLast4: last4(key),
      health: d.health || 'unknown',
      lastError: d.lastError || null,
      lastLatencyMs: d.lastLatencyMs ?? null,
      lastSuccessAt: d.lastSuccessAt || null,
    };
    issues.push(...providerIssues(p, keySaved));
    return p;
  });

  const envKeyPresent = Boolean(config.ai.apiKey);
  const envOpenAiPresent = Boolean(config.ai.openai?.enabled);

  // OPENAI_API_KEY in the env is a real, last-resort provider (registry.js
  // appends it), so it must appear here or the panel would claim AI is
  // unconfigured on a box that is happily serving from it.
  if (envOpenAiPresent) {
    providers.push({
      id: 'env',
      name: 'OpenAI (environment)',
      type: 'openai',
      model: config.ai.openai.model || providerMeta('openai').defaultModel,
      baseUrl: config.ai.openai.baseUrl || providerMeta('openai').baseUrl,
      isDefault: true,
      isActive: true,
      isEnv: true, // not a DB row: not editable in the panel
      modules: [],
      hasKey: true,
      keyLast4: last4(config.ai.openai.apiKey),
      health: 'unknown',
      lastError: null,
      lastLatencyMs: null,
      lastSuccessAt: null,
    });
  }

  const active = providers.filter((p) => p.isActive);
  const configured = await isAiConfigured();
  // The registry is tried before the built-in SDK, so a saved provider — not the
  // env Anthropic key — is what actually serves once one exists.
  const source = active.length ? 'provider' : envKeyPresent ? 'env' : 'none';
  const defaultProvider = active.find((p) => p.isDefault) || null;
  const defaultModel = defaultProvider ? defaultProvider.model : envKeyPresent ? config.ai.model : null;

  if (!configured) {
    issues.push({
      level: 'error',
      code: 'not_configured',
      message: 'No AI provider is configured. Add a provider under AI Providers, or set ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment.',
    });
  }
  if (active.length && !defaultProvider) {
    issues.push({
      level: 'warn',
      code: 'no_default',
      message: 'No active provider is marked default. Modules that no provider explicitly serves fall back to the built-in ANTHROPIC_API_KEY, and fail when it is absent.',
    });
    const stranded = GENERATION_FEATURES.filter((f) => !active.some((p) => p.modules.includes(f)));
    if (stranded.length && !envKeyPresent) {
      issues.push({
        level: 'error',
        code: 'unroutable_feature',
        message: `No provider serves ${stranded.join(' or ')}. Mark a provider as default, or tick those modules on one.`,
      });
    }
  }
  if (!active.length && providers.length) {
    issues.push({ level: 'warn', code: 'all_inactive', message: `${providers.length} provider(s) are saved but none is active.` });
  }

  return {
    configured,
    source,
    providers,
    envKeyPresent,
    envKeyLast4: last4(config.ai.apiKey),
    // Answers the operator's "I set OPENAI_API_KEY, why is it off?" directly.
    envOpenAiPresent,
    envOpenAiLast4: last4(config.ai.openai?.apiKey),
    defaultModel,
    issues,
  };
}

/** Transport/DNS failures surface as a code rather than an HTTP status. */
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
]);

/** The vendor's own words, whatever shape the body arrived in. */
function vendorMessage(err) {
  const body = err?.body;
  if (typeof body === 'string' && body.trim()) return body.trim();
  const msg = body?.error?.message || body?.message || (typeof body?.error === 'string' ? body.error : null);
  return msg || err?.message || '';
}

/**
 * Turn a provider failure into a category plus a message an operator can act on.
 * Callers get the vendor's own text: a 400 is nearly always the API stating
 * exactly what is wrong with the request ("`temperature` is deprecated for this
 * model"), and flattening that into a generic string is how the sampling-param
 * outage stayed hidden for weeks.
 *
 * @param {object} err error carrying `status`/`body` (see providers.js), or a plain shape
 * @param {number} [status] HTTP status when the caller has it separately
 * @returns {{kind:('invalid_api_key'|'model_not_available'|'rate_limited'|'quota_exceeded'|'network_error'|'bad_request'|'unknown'), status:number|null, message:string}}
 */
export function classifyProviderError(err, status) {
  const httpStatus = status ?? err?.status ?? null;
  const code = err?.code || err?.cause?.code || null;
  const vendor = vendorMessage(err);

  if (err?.name === 'AbortError') {
    return { kind: 'network_error', status: httpStatus, message: 'The provider did not respond before the timeout.' };
  }
  if (NETWORK_CODES.has(code) || /fetch failed/i.test(err?.message || '')) {
    return { kind: 'network_error', status: httpStatus, message: `Could not reach the provider${code ? ` (${code})` : ''}. Check the base URL and outbound network access.` };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return { kind: 'invalid_api_key', status: httpStatus, message: vendor || 'The provider rejected the API key.' };
  }
  if (httpStatus === 404 && /model/i.test(vendor)) {
    return { kind: 'model_not_available', status: httpStatus, message: vendor };
  }
  if (httpStatus === 429) {
    const outOfCredit = /quota|billing|insufficient|credit/i.test(vendor);
    return {
      kind: outOfCredit ? 'quota_exceeded' : 'rate_limited',
      status: httpStatus,
      message: vendor || 'The provider is rate limiting this key.',
    };
  }
  if (httpStatus === 400) {
    return { kind: 'bad_request', status: httpStatus, message: vendor || 'The provider rejected the request.' };
  }
  // Config errors thrown before a request leaves this process: matching on our
  // own message strings is safe, they are not vendor text.
  if (!httpStatus && /no api key/i.test(vendor)) {
    return { kind: 'invalid_api_key', status: null, message: vendor };
  }
  if (!httpStatus && /base url/i.test(vendor)) {
    return { kind: 'bad_request', status: null, message: vendor };
  }
  return { kind: 'unknown', status: httpStatus, message: vendor || 'The provider call failed.' };
}

/** A quota failure is reachable + authenticated, so the UI treats it as a limit. */
const TEST_STATUS = {
  invalid_api_key: 'invalid_api_key',
  model_not_available: 'model_not_available',
  rate_limited: 'rate_limited',
  quota_exceeded: 'rate_limited',
};

/**
 * Ping a provider config and report a category rather than a bare boolean.
 * @param {object} cfg { type, apiKey, baseUrl, apiVersion, organization, projectId, model, timeoutMs }
 * @returns {Promise<{ok:boolean, status:string, kind:string, latencyMs:number, model:string|null, message:string, sample?:string}>}
 */
export async function testProvider(cfg) {
  const result = await testConnection(cfg);
  const model = result.model || cfg?.model || providerMeta(cfg?.type).defaultModel || null;
  if (result.ok) {
    return { ok: true, status: 'connected', kind: 'connected', latencyMs: result.latencyMs, model, message: 'Connection OK', sample: result.sample };
  }
  const { kind, message } = classifyProviderError(
    { message: result.error, status: result.status, code: result.code, name: result.name },
    result.status,
  );
  return { ok: false, status: TEST_STATUS[kind] || 'disconnected', kind, latencyMs: result.latencyMs, model, message };
}

export default { isAiConfigured, aiStatus, invalidateAiStatusCache, classifyProviderError, testProvider };
