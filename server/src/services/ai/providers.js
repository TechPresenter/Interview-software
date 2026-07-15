/**
 * Multi-provider AI adapters.
 *
 * One unified `chat()` + `testConnection()` over many providers, implemented with
 * the global `fetch` (Node >= 18) so no per-vendor SDK dependency is needed.
 * Most vendors are OpenAI-compatible (`/chat/completions`); Gemini, Anthropic and
 * Azure OpenAI have their own request shapes.
 */

/** Static metadata per provider type. `kind` selects the request adapter. */
export const PROVIDER_META = {
  claude: { kind: 'anthropic', label: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-opus-4-8' },
  openai: { kind: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  gemini: { kind: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-1.5-pro' },
  grok: { kind: 'openai', label: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-2-latest' },
  deepseek: { kind: 'openai', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  mistral: { kind: 'openai', label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-large-latest' },
  groq: { kind: 'openai', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { kind: 'openai', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o' },
  azure_openai: { kind: 'azure', label: 'Azure OpenAI', baseUrl: '', defaultModel: '' },
  custom: { kind: 'openai', label: 'Custom (OpenAI-compatible)', baseUrl: '', defaultModel: '' },
};

export const PROVIDER_TYPES = Object.keys(PROVIDER_META);

export function providerMeta(type) {
  return PROVIDER_META[type] || PROVIDER_META.custom;
}

const trimSlash = (s) => (s || '').replace(/\/+$/, '');

function timeout(ms) {
  const ctrl = new AbortController();
  const handle = setTimeout(() => ctrl.abort(), ms || 30000);
  return { signal: ctrl.signal, clear: () => clearTimeout(handle) };
}

/* ── OpenAI-compatible (openai, grok, deepseek, mistral, groq, openrouter, custom) ── */
async function openaiChat(cfg, { system, messages, maxTokens, temperature }) {
  const meta = providerMeta(cfg.type);
  const base = trimSlash(cfg.baseUrl || meta.baseUrl);
  if (!base) throw new Error('Missing base URL for this provider');
  const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` };
  if (cfg.organization) headers['OpenAI-Organization'] = cfg.organization;
  if (cfg.projectId) headers['OpenAI-Project'] = cfg.projectId;
  const t = timeout(cfg.timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: t.signal,
      body: JSON.stringify({ model: cfg.model || meta.defaultModel, messages: msgs, max_tokens: maxTokens, temperature }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
    const u = data.usage || {};
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: { inputTokens: u.prompt_tokens || 0, outputTokens: u.completion_tokens || 0 },
    };
  } finally {
    t.clear();
  }
}

/* ── Azure OpenAI ── */
async function azureChat(cfg, { system, messages, maxTokens, temperature }) {
  const base = trimSlash(cfg.baseUrl);
  if (!base) throw new Error('Azure OpenAI requires a base URL (resource endpoint)');
  const version = cfg.apiVersion || '2024-02-15-preview';
  const url = `${base}/openai/deployments/${cfg.model}/chat/completions?api-version=${version}`;
  const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const t = timeout(cfg.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': cfg.apiKey },
      signal: t.signal,
      body: JSON.stringify({ messages: msgs, max_tokens: maxTokens, temperature }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const u = data.usage || {};
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: { inputTokens: u.prompt_tokens || 0, outputTokens: u.completion_tokens || 0 },
    };
  } finally {
    t.clear();
  }
}

/* ── Google Gemini ── */
async function geminiChat(cfg, { system, messages, maxTokens, temperature }) {
  const meta = providerMeta('gemini');
  const base = trimSlash(cfg.baseUrl || meta.baseUrl);
  const model = cfg.model || meta.defaultModel;
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const body = {
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const t = timeout(cfg.timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: t.signal, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const u = data.usageMetadata || {};
    return {
      text: (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).join(''),
      usage: { inputTokens: u.promptTokenCount || 0, outputTokens: u.candidatesTokenCount || 0 },
    };
  } finally {
    t.clear();
  }
}

/* ── Anthropic Claude (REST, no SDK) ── */

/**
 * Newer Claude models REMOVED the sampling parameters — sending temperature,
 * top_p or top_k returns 400 "`temperature` is deprecated for this model".
 * Duplicated from claude.client.js rather than imported: that module pulls in
 * registry.js, which imports this one (import cycle).
 */
const NO_SAMPLING_PARAMS = /^claude-(opus-4-(7|8)|sonnet-5|fable-5|mythos-5)/;
const acceptsSampling = (model) => !NO_SAMPLING_PARAMS.test(String(model || ''));

async function anthropicChat(cfg, { system, messages, maxTokens, temperature }) {
  const meta = providerMeta('claude');
  const base = trimSlash(cfg.baseUrl || meta.baseUrl);
  const model = cfg.model || meta.defaultModel;
  const t = timeout(cfg.timeoutMs);
  try {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': cfg.apiVersion || '2023-06-01' },
      signal: t.signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens || 1024,
        // Omitted entirely on models that removed sampling params (400 otherwise).
        ...(acceptsSampling(model) ? { temperature } : {}),
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const u = data.usage || {};
    return {
      text: (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
      usage: { inputTokens: u.input_tokens || 0, outputTokens: u.output_tokens || 0 },
    };
  } finally {
    t.clear();
  }
}

/**
 * Unified chat completion.
 * @param {object} cfg  { type, apiKey, baseUrl, apiVersion, organization, projectId, model, timeoutMs }
 * @param {object} payload { system, messages:[{role,content}], maxTokens, temperature }
 * @returns {Promise<{ text:string, usage:{inputTokens:number, outputTokens:number} }>}
 */
export async function chat(cfg, payload) {
  if (!cfg?.apiKey) throw new Error('No API key configured');
  const p = { maxTokens: 1024, temperature: 0.3, messages: [], ...payload };
  switch (providerMeta(cfg.type).kind) {
    case 'anthropic':
      return anthropicChat(cfg, p);
    case 'gemini':
      return geminiChat(cfg, p);
    case 'azure':
      return azureChat(cfg, p);
    default:
      return openaiChat(cfg, p);
  }
}

/** Ping a provider config with a tiny prompt; never throws. */
export async function testConnection(cfg) {
  const start = Date.now();
  try {
    if (!cfg?.apiKey) throw new Error('No API key configured');
    const { text } = await chat(cfg, {
      system: 'You are a connection test.',
      messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      maxTokens: 8,
      temperature: 0,
    });
    return { ok: true, latencyMs: Date.now() - start, model: cfg.model || providerMeta(cfg.type).defaultModel, sample: String(text).trim().slice(0, 40) };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err?.message || 'Connection failed' };
  }
}

export default { chat, testConnection, providerMeta, PROVIDER_META, PROVIDER_TYPES };
