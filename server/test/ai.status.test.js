import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The bug these pin: "AI is not configured" was raised whenever ANTHROPIC_API_KEY
 * was absent, however many working providers an admin had saved. isAiConfigured()
 * must answer from the DB too, and a failed call must say which of the six
 * plausible causes it actually was.
 */

// vi.mock is hoisted above module-level consts, so the stubs must be too.
// config is mocked rather than driven through env: dotenv loads the developer's
// real .env, which has an ANTHROPIC_API_KEY, and that would make the env-less
// scenarios below pass without proving anything.
const { cfg, countDocuments, find } = vi.hoisted(() => ({
  cfg: { env: 'test', isProd: false, ai: { enabled: false, apiKey: undefined, model: 'claude-opus-4-8' } },
  countDocuments: vi.fn(),
  find: vi.fn(),
}));
vi.mock('../src/config/index.js', () => ({ config: cfg, default: cfg }));
vi.mock('../src/models/AiProvider.js', () => ({ AiProvider: { countDocuments, find } }));

const { isAiConfigured, invalidateAiStatusCache, classifyProviderError, aiStatus } = await import(
  '../src/services/ai/ai.status.js'
);

/** A saved provider row as the registry sees it (apiKey selected, decryptable). */
const providerDoc = (over = {}) => ({
  _id: 'p1',
  label: 'OpenAI (Prod)',
  type: 'openai',
  apiKey: 'enc:v1:blob',
  getApiKey: () => 'sk-live-abcd1234WXYZ',
  baseUrl: undefined,
  model: undefined,
  modules: [],
  isActive: true,
  isDefault: true,
  health: 'healthy',
  ...over,
});

const queryOf = (docs) => ({ select() { return this; }, sort() { return docs; } });

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAiStatusCache(); // module-level cache outlives each test
  cfg.ai.enabled = false;
  cfg.ai.apiKey = undefined;
});

describe('isAiConfigured', () => {
  it('is true with only a DB provider and no env key — the reported outage', async () => {
    countDocuments.mockResolvedValue(1);
    expect(await isAiConfigured()).toBe(true);
  });

  it('is false when neither an env key nor a provider exists', async () => {
    countDocuments.mockResolvedValue(0);
    expect(await isAiConfigured()).toBe(false);
  });

  it('is true on the env key alone, without touching Mongo', async () => {
    cfg.ai.enabled = true;
    expect(await isAiConfigured()).toBe(true);
    expect(countDocuments).not.toHaveBeenCalled();
  });

  it('reports unconfigured rather than throwing when the provider lookup fails', async () => {
    countDocuments.mockRejectedValue(new Error('connection timed out'));
    expect(await isAiConfigured()).toBe(false);
  });

  it('caches the count, and re-queries once invalidated', async () => {
    countDocuments.mockResolvedValue(1);
    await isAiConfigured();
    await isAiConfigured();
    expect(countDocuments).toHaveBeenCalledTimes(1);

    invalidateAiStatusCache();
    countDocuments.mockResolvedValue(0);
    expect(await isAiConfigured()).toBe(false);
    expect(countDocuments).toHaveBeenCalledTimes(2);
  });
});

describe('classifyProviderError', () => {
  const vendorErr = (status, body) => ({ status, body, message: body?.error?.message });

  it('maps 401 to an invalid key and keeps the vendor wording', () => {
    const r = classifyProviderError(vendorErr(401, { error: { message: 'Incorrect API key provided: sk-abc***' } }));
    expect(r.kind).toBe('invalid_api_key');
    expect(r.message).toBe('Incorrect API key provided: sk-abc***');
  });

  it('maps 403 to an invalid key', () => {
    expect(classifyProviderError(vendorErr(403, { error: { message: 'Forbidden' } })).kind).toBe('invalid_api_key');
  });

  it('maps a 404 naming the model to model_not_available', () => {
    const r = classifyProviderError(vendorErr(404, { error: { message: 'The model `gpt-9o` does not exist' } }));
    expect(r.kind).toBe('model_not_available');
    expect(r.message).toMatch(/gpt-9o/);
  });

  it('maps a plain 429 to rate_limited', () => {
    expect(classifyProviderError(vendorErr(429, { error: { message: 'Rate limit reached for requests' } })).kind).toBe('rate_limited');
  });

  it('maps a 429 mentioning quota to quota_exceeded', () => {
    const r = classifyProviderError(vendorErr(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details.' } }));
    expect(r.kind).toBe('quota_exceeded');
  });

  it('maps a refused connection to network_error', () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    const r = classifyProviderError(err);
    expect(r.kind).toBe('network_error');
    expect(r.message).toMatch(/ECONNREFUSED/);
  });

  it('maps an aborted request to network_error', () => {
    const err = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    expect(classifyProviderError(err).kind).toBe('network_error');
  });

  it('surfaces a 400 verbatim — the sampling-param outage must be readable', () => {
    const r = classifyProviderError(vendorErr(400, { error: { message: '`temperature` is deprecated for this model' } }));
    expect(r.kind).toBe('bad_request');
    expect(r.message).toBe('`temperature` is deprecated for this model');
  });

  it('takes the status from the second argument when the error has none', () => {
    expect(classifyProviderError({ message: 'nope' }, 401).kind).toBe('invalid_api_key');
  });

  it('reads a bare-string vendor body', () => {
    expect(classifyProviderError({ status: 400, body: 'Bad Request: unsupported parameter' }).message).toBe('Bad Request: unsupported parameter');
  });

  it('falls back to unknown, still carrying the vendor message', () => {
    const r = classifyProviderError(vendorErr(503, { error: { message: 'Service overloaded' } }));
    expect(r.kind).toBe('unknown');
    expect(r.message).toBe('Service overloaded');
  });
});

describe('aiStatus', () => {
  it('reports a DB-configured provider as the source and never returns the key', async () => {
    countDocuments.mockResolvedValue(1);
    find.mockReturnValue(queryOf([providerDoc()]));

    const s = await aiStatus();

    expect(s.configured).toBe(true);
    expect(s.source).toBe('provider');
    expect(s.envKeyPresent).toBe(false);
    expect(s.providers[0]).toMatchObject({ name: 'OpenAI (Prod)', type: 'openai', hasKey: true, keyLast4: 'WXYZ' });
    // The effective model/base URL, not the blank stored override.
    expect(s.providers[0].model).toBe('gpt-4o');
    expect(s.providers[0].baseUrl).toBe('https://api.openai.com/v1');
    expect(JSON.stringify(s)).not.toContain('sk-live-abcd1234WXYZ');
  });

  it('flags a key that no longer decrypts as the cause, not as a missing key', async () => {
    countDocuments.mockResolvedValue(1);
    find.mockReturnValue(queryOf([providerDoc({ getApiKey: () => null })]));

    const s = await aiStatus();

    expect(s.providers[0].hasKey).toBe(false);
    expect(s.issues.map((i) => i.code)).toContain('key_undecryptable');
    expect(s.issues.find((i) => i.code === 'key_undecryptable').message).toMatch(/AI_ENCRYPTION_KEY/);
  });

  it('warns that generation is unroutable when nothing is default or ticked for it', async () => {
    countDocuments.mockResolvedValue(1);
    find.mockReturnValue(queryOf([providerDoc({ isDefault: false, modules: ['scoring'] })]));

    const s = await aiStatus();

    expect(s.issues.map((i) => i.code)).toContain('no_default');
    expect(s.issues.find((i) => i.code === 'unroutable_feature').message).toMatch(/question_generation/);
  });

  it('treats a non-default provider ticked for the generation modules as serving them', async () => {
    countDocuments.mockResolvedValue(1);
    find.mockReturnValue(queryOf([providerDoc({ isDefault: false, modules: ['question_generation', 'answer_key'] })]));

    const s = await aiStatus();

    expect(s.issues.map((i) => i.code)).not.toContain('unroutable_feature');
  });

  it('says so when nothing at all is configured', async () => {
    countDocuments.mockResolvedValue(0);
    find.mockReturnValue(queryOf([]));

    const s = await aiStatus();

    expect(s.configured).toBe(false);
    expect(s.source).toBe('none');
    expect(s.defaultModel).toBeNull();
    expect(s.issues.map((i) => i.code)).toContain('not_configured');
  });

  it('falls back to the env key, reporting its last4 and model', async () => {
    cfg.ai.enabled = true;
    cfg.ai.apiKey = 'sk-ant-secret-7890';
    find.mockReturnValue(queryOf([]));

    const s = await aiStatus();

    expect(s.source).toBe('env');
    expect(s.envKeyPresent).toBe(true);
    expect(s.envKeyLast4).toBe('7890');
    expect(s.defaultModel).toBe('claude-opus-4-8');
    expect(JSON.stringify(s)).not.toContain('sk-ant-secret-7890');
  });
});
