import { apiGet, apiPost, api } from './api';

/**
 * AI prompt templates (super-admin).
 *
 * Every template the engines use is a database row; the built-ins in
 * services/ai/prompts/defaults.js are the fallback and the "reset" source.
 * Saves take effect on the next AI call — no restart.
 */

export interface PromptVariable {
  name: string;
  description?: string;
}

export interface PromptVersion {
  version: number;
  system?: string;
  template?: string;
  note?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface PromptTemplate {
  _id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  system?: string;
  template: string;
  variables?: PromptVariable[];
  isActive: boolean;
  isBuiltIn?: boolean;
  version: number;
  versions?: PromptVersion[];
  updatedAt?: string;
}

/** One entry per engine hook, whether or not a row exists for it. */
export interface PromptKeyInfo {
  key: string;
  name: string;
  category: string;
  description: string;
  variables: PromptVariable[];
  /** True when the built-in is what actually runs today. */
  usingDefault: boolean;
}

export interface PromptPreview {
  key: string;
  source: 'draft' | 'database' | 'default';
  system: string;
  messages: { role: string; content: string }[];
  /** Placeholders that rendered empty — the admin needs to see these. */
  unfilled: string[];
  variables: PromptVariable[];
}

export const promptsApi = {
  list: (params?: object) => apiGet<{ templates: PromptTemplate[]; keys: PromptKeyInfo[] }>('/admin/prompts', params),
  getOne: (id: string) => apiGet<PromptTemplate>(`/admin/prompts/${id}`),
  create: (body: object) => apiPost<PromptTemplate>('/admin/prompts', body),
  update: (id: string, body: object) => api.put(`/admin/prompts/${id}`, body).then((r) => r.data.data as PromptTemplate),
  remove: (id: string) => api.delete(`/admin/prompts/${id}`).then((r) => r.data),
  setActive: (id: string) => api.patch(`/admin/prompts/${id}/activate`).then((r) => r.data.data as PromptTemplate),
  toggle: (id: string) => api.patch(`/admin/prompts/${id}/toggle`).then((r) => r.data.data as PromptTemplate),
  reset: (id: string) => apiPost<PromptTemplate>(`/admin/prompts/${id}/reset`, {}),
  versions: (id: string) => apiGet<PromptVersion[]>(`/admin/prompts/${id}/versions`),
  restoreVersion: (id: string, version: number) =>
    apiPost<PromptTemplate>(`/admin/prompts/${id}/versions/${version}/restore`, {}),
  /** `draft` previews unsaved text; omit it to preview what is live. */
  preview: (body: { key: string; vars?: object; system?: string; template?: string }) =>
    apiPost<PromptPreview>('/admin/prompts/preview', body),
  exportAll: () => apiGet<unknown>('/admin/prompts/export'),
  importAll: (templates: unknown[]) => apiPost<{ created: number; updated: number }>('/admin/prompts/import', { templates }),
};

/* ── AI connection status ── */

export interface AiProviderStatus {
  id: string;
  name: string;
  type: string;
  model: string | null;
  baseUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
  isEnv?: boolean;
  modules: string[];
  hasKey: boolean;
  keyLast4: string | null;
  health: string;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
}

export interface AiStatus {
  configured: boolean;
  source: 'env' | 'provider' | 'none';
  providers: AiProviderStatus[];
  envKeyPresent: boolean;
  envKeyLast4: string | null;
  envOpenAiPresent: boolean;
  envOpenAiLast4: string | null;
  defaultModel: string | null;
  issues: { level: string; code: string; message: string }[];
}

export type ConnectionState =
  | 'connected' | 'invalid_api_key' | 'model_not_available'
  | 'rate_limited' | 'quota_exceeded' | 'disconnected';

export interface ConnectionTest {
  ok: boolean;
  status: ConnectionState;
  latencyMs?: number;
  model?: string;
  message?: string;
  sample?: string;
}

export const aiStatusApi = {
  status: () => apiGet<AiStatus>('/admin/ai/status'),
  /** Test a saved provider by id, or an ad-hoc config. */
  test: (body: { id?: string; type?: string; apiKey?: string; baseUrl?: string; model?: string }) =>
    apiPost<ConnectionTest>('/admin/ai/status/test', body),
  testAll: () => apiPost<{ results: (ConnectionTest & { id: string; name: string })[] }>('/admin/ai/status/test-all', {}),
};

export const STATE_LABELS: Record<ConnectionState, string> = {
  connected: 'Connected',
  invalid_api_key: 'Invalid API key',
  model_not_available: 'Model not available',
  rate_limited: 'Rate limited',
  quota_exceeded: 'Quota exceeded',
  disconnected: 'Disconnected',
};

export const STATE_TONES: Record<ConnectionState, 'success' | 'danger' | 'warning' | 'muted'> = {
  connected: 'success',
  invalid_api_key: 'danger',
  model_not_available: 'warning',
  rate_limited: 'warning',
  quota_exceeded: 'warning',
  disconnected: 'muted',
};
