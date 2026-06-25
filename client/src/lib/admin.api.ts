import { apiGet, apiPost, api } from './api';

/**
 * Typed thin wrappers over the /admin endpoints (Phase 2). Used with React Query
 * in the super-admin pages.
 */

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

/** GET that also returns the `meta` envelope (for paginated lists). */
async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const { data } = await api.get(url, { params });
  return { items: data.data as T[], meta: data.meta };
}

export const adminApi = {
  // Dashboard
  overview: () => apiGet<any>('/admin/overview'),
  timeseries: (days = 30) => apiGet<any>('/admin/overview/timeseries', { days }),
  health: () => apiGet<any>('/admin/health'),
  activity: (limit = 20) => apiGet<any[]>('/admin/activity', { limit }),
  recordings: (params?: object) => getPaged<any>('/admin/recordings', params),
  recordingDetail: (id: string) => apiGet<any>(`/admin/recordings/${id}`),

  // Companies
  companies: (params?: object) => getPaged<any>('/admin/companies', params),
  company: (id: string) => apiGet<any>(`/admin/companies/${id}`),
  createCompany: (body: object) => apiPost<any>('/admin/companies', body),
  updateCompany: (id: string, body: object) => api.patch(`/admin/companies/${id}`, body).then((r) => r.data.data),
  suspendCompany: (id: string) => apiPost<any>(`/admin/companies/${id}/suspend`),
  activateCompany: (id: string) => apiPost<any>(`/admin/companies/${id}/activate`),
  companyBilling: (id: string) => apiGet<any>(`/admin/companies/${id}/billing`),

  // Candidates (platform-wide)
  candidates: (params?: object) => getPaged<any>('/admin/candidates', params),
  updateCandidate: (id: string, body: object) => api.patch(`/admin/candidates/${id}`, body).then((r) => r.data.data),
  deleteCandidateAdmin: (id: string) => api.delete(`/admin/candidates/${id}`).then((r) => r.data),

  // Subscriptions
  plans: () => apiGet<any[]>('/admin/plans'),
  upsertPlan: (body: object) => api.put('/admin/plans', body).then((r) => r.data.data),
  seedPlans: () => apiPost<any[]>('/admin/plans/seed'),
  subscriptions: (params?: object) => getPaged<any>('/admin/subscriptions', params),
  coupons: (params?: object) => getPaged<any>('/admin/coupons', params),
  createCoupon: (body: object) => apiPost<any>('/admin/coupons', body),
  deleteCoupon: (id: string) => api.delete(`/admin/coupons/${id}`).then((r) => r.data),
  invoices: (params?: object) => getPaged<any>('/admin/invoices', params),

  // Questions
  questions: (params?: object) => getPaged<any>('/admin/questions', params),
  questionStats: () => apiGet<any>('/admin/questions/stats'),
  createQuestion: (body: object) => apiPost<any>('/admin/questions', body),
  updateQuestion: (id: string, body: object) => api.patch(`/admin/questions/${id}`, body).then((r) => r.data.data),
  deleteQuestion: (id: string) => api.delete(`/admin/questions/${id}`).then((r) => r.data),

  // AI
  aiSettings: () => apiGet<any>('/admin/ai/settings'),
  updateAiSettings: (body: object) => api.put('/admin/ai/settings', body).then((r) => r.data.data),
  aiWeightage: () => apiGet<any>('/admin/ai/weightage'),
  updateAiWeightage: (body: object) => api.put('/admin/ai/weightage', body).then((r) => r.data.data),
  aiPrompts: () => apiGet<any[]>('/admin/ai/prompts'),
  aiAnalytics: (days = 30) => apiGet<any>('/admin/ai/analytics', { days }),
  testAi: () => apiPost<any>('/admin/ai/test'),

  // AI providers (multi-provider management)
  aiProviders: () => apiGet<any[]>('/admin/ai-providers'),
  createAiProvider: (body: object) => apiPost<any>('/admin/ai-providers', body),
  setDefaultAiProvider: (id: string) => apiPost<any>(`/admin/ai-providers/${id}/default`),
  deleteAiProvider: (id: string) => api.delete(`/admin/ai-providers/${id}`).then((r) => r.data),

  // CMS (resource ∈ pages|blog|faqs|testimonials|announcements|templates)
  cmsList: (resource: string, params?: object) => getPaged<any>(`/admin/cms/${resource}`, params),
  cmsCreate: (resource: string, body: object) => apiPost<any>(`/admin/cms/${resource}`, body),
  cmsUpdate: (resource: string, id: string, body: object) =>
    api.patch(`/admin/cms/${resource}/${id}`, body).then((r) => r.data.data),
  cmsDelete: (resource: string, id: string) => api.delete(`/admin/cms/${resource}/${id}`).then((r) => r.data),

  // White-label branding
  getBranding: () => apiGet<any>('/admin/branding'),
  updateBranding: (body: object) => api.put('/admin/branding', body).then((r) => r.data.data),
  uploadBrandingAsset: (field: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/admin/branding/asset', fd, { params: { field } }).then((r) => r.data.data);
  },

  // System
  runBackup: () => apiPost<any>('/admin/backup'),
  settingsGroup: (group: string) => apiGet<any[]>(`/admin/system/${group}`),
  updateSettingsGroup: (group: string, entries: object[]) =>
    api.put(`/admin/system/${group}`, { entries }).then((r) => r.data.data),
  auditLogs: (params?: object) => getPaged<any>('/admin/audit-logs', params),
};

export default adminApi;
