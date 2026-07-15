import { apiGet, apiPost, api } from './api';
import type { Question, QuestionStats, GenerateQuestionsInput, GenerateResult } from '@/types/question';

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

/** Fetch a binary export and trigger a browser download. */
async function download(url: string, params: object, fallbackName: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || fallbackName;
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
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
  questions: (params?: object) => getPaged<Question>('/admin/questions', params),
  questionStats: () => apiGet<QuestionStats>('/admin/questions/stats'),
  createQuestion: (body: object) => apiPost<Question>('/admin/questions', body),
  updateQuestion: (id: string, body: object) => api.patch(`/admin/questions/${id}`, body).then((r) => r.data.data as Question),
  deleteQuestion: (id: string) => api.delete(`/admin/questions/${id}`).then((r) => r.data),
  duplicateQuestion: (id: string) => apiPost<Question>(`/admin/questions/${id}/duplicate`, {}),
  archiveQuestion: (id: string) => apiPost<Question>(`/admin/questions/${id}/archive`, {}),
  restoreQuestion: (id: string) => apiPost<Question>(`/admin/questions/${id}/restore`, {}),
  reviewQuestion: (id: string, status: 'approved' | 'rejected', note?: string) =>
    apiPost<Question>(`/admin/questions/${id}/review`, { status, note }),
  bulkReviewQuestions: (ids: string[], status: 'approved' | 'rejected') =>
    apiPost<{ updated: number }>('/admin/questions/bulk-review', { ids, status }),
  bulkCreateQuestions: (questions: object[]) => apiPost<{ inserted: number }>('/admin/questions/bulk', { questions }),
  generateQuestions: (body: GenerateQuestionsInput) => apiPost<GenerateResult>('/admin/questions/generate', body),
  generateAnswerKey: (id: string) => apiPost<Question>(`/admin/questions/${id}/answer-key`, {}),

  // AI
  aiSettings: () => apiGet<any>('/admin/ai/settings'),
  updateAiSettings: (body: object) => api.put('/admin/ai/settings', body).then((r) => r.data.data),
  aiWeightage: () => apiGet<any>('/admin/ai/weightage'),
  updateAiWeightage: (body: object) => api.put('/admin/ai/weightage', body).then((r) => r.data.data),
  aiPrompts: () => apiGet<any[]>('/admin/ai/prompts'),
  aiAnalytics: (days = 30) => apiGet<any>('/admin/ai/analytics', { days }),
  testAi: () => apiPost<any>('/admin/ai/test'),

  // AI providers (multi-provider management) — returns { providers, catalog, modules }
  aiProviders: () => apiGet<any>('/admin/ai-providers'),
  createAiProvider: (body: object) => apiPost<any>('/admin/ai-providers', body),
  updateAiProvider: (id: string, body: object) => api.patch(`/admin/ai-providers/${id}`, body).then((r) => r.data.data),
  setDefaultAiProvider: (id: string) => apiPost<any>(`/admin/ai-providers/${id}/default`),
  deleteAiProvider: (id: string) => api.delete(`/admin/ai-providers/${id}`).then((r) => r.data),
  testAiProvider: (body: object) => apiPost<any>('/admin/ai-providers/test', body),
  testAiProviderById: (id: string) => apiPost<any>(`/admin/ai-providers/${id}/test`),
  aiProviderAnalytics: (days = 30) => apiGet<any>('/admin/ai-providers/analytics', { days }),
  exportAiProviders: () => apiGet<any>('/admin/ai-providers/export'),
  importAiProviders: (providers: any[]) => apiPost<any>('/admin/ai-providers/import', { providers }),
  aiProviderBalance: (id: string) => apiGet<any>(`/admin/ai-providers/${id}/balance`),

  // CMS (resource ∈ pages|blog|faqs|testimonials|announcements|templates)
  cmsList: (resource: string, params?: object) => getPaged<any>(`/admin/cms/${resource}`, params),
  cmsCreate: (resource: string, body: object) => apiPost<any>(`/admin/cms/${resource}`, body),
  cmsUpdate: (resource: string, id: string, body: object) =>
    api.patch(`/admin/cms/${resource}/${id}`, body).then((r) => r.data.data),
  cmsDelete: (resource: string, id: string) => api.delete(`/admin/cms/${resource}/${id}`).then((r) => r.data),
  cmsUploadImage: (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('upload', file);
    return api.post('/admin/cms/upload', fd).then((r) => ({ url: r.data.url }));
  },

  // White-label branding
  getBranding: () => apiGet<any>('/admin/branding'),
  updateBranding: (body: object) => api.put('/admin/branding', body).then((r) => r.data.data),
  uploadBrandingAsset: (field: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/admin/branding/asset', fd, { params: { field } }).then((r) => r.data.data);
  },

  // Email system
  emailTemplates: () => apiGet<any[]>('/admin/email/templates'),
  emailTemplate: (key: string) => apiGet<any>(`/admin/email/templates/${key}`),
  saveEmailTemplate: (key: string, body: object) => api.put(`/admin/email/templates/${key}`, body).then((r) => r.data.data),
  resetEmailTemplate: (key: string) => api.delete(`/admin/email/templates/${key}`).then((r) => r.data),
  emailPreview: (key: string, vars?: object) => apiPost<any>('/admin/email/preview', { key, vars }),
  emailTest: (key: string, to: string, vars?: object) => apiPost<any>('/admin/email/test', { key, to, vars }),
  emailLogs: (params?: object) => getPaged<any>('/admin/email/logs', params),
  resendEmail: (id: string) => apiPost<any>(`/admin/email/logs/${id}/resend`),
  emailStats: () => apiGet<any>('/admin/email/stats'),

  // System
  runBackup: () => apiPost<any>('/admin/backup'),
  testEmail: (to?: string) => apiPost<any>('/admin/system/test-email', { to }),
  testVoice: (opts?: { lang?: 'en' | 'hi'; gender?: 'female' | 'male'; text?: string }) =>
    apiPost<any>('/admin/system/test-voice', opts || {}),
  settingsGroup: (group: string) => apiGet<any[]>(`/admin/system/${group}`),
  updateSettingsGroup: (group: string, entries: object[]) =>
    api.put(`/admin/system/${group}`, { entries }).then((r) => r.data.data),
  auditLogs: (params?: object) => getPaged<any>('/admin/audit-logs', params),
  clearAuditLogs: (before?: string) =>
    api.delete('/admin/audit-logs', { params: before ? { before } : {} }).then((r) => r.data),

  // Demo bookings (Enquiries → Demo Bookings)
  demoBookings: (params?: object) => getPaged<any>('/admin/demo-bookings', params),
  demoBookingStats: () => apiGet<any>('/admin/demo-bookings/stats'),
  demoBooking: (id: string) => apiGet<any>(`/admin/demo-bookings/${id}`),
  demoAssignees: () => apiGet<any[]>('/admin/demo-bookings/assignees'),
  updateDemoBooking: (id: string, body: object) => api.patch(`/admin/demo-bookings/${id}`, body).then((r) => r.data.data),
  deleteDemoBooking: (id: string) => api.delete(`/admin/demo-bookings/${id}`).then((r) => r.data),
  exportDemoBookings: (params?: { status?: string }) => download('/admin/demo-bookings/export', params || {}, 'demo-bookings.csv'),

  // Spam protection (CAPTCHA)
  captchaConfig: () => apiGet<any>('/admin/captcha'),
  updateCaptcha: (body: object) => api.put('/admin/captcha', body).then((r) => r.data.data),

  // Tracking & marketing integrations
  integrations: () => apiGet<any>('/admin/integrations'),
  saveIntegration: (key: string, body: object) => api.put(`/admin/integrations/${key}`, body).then((r) => r.data.data),
  testIntegration: (key: string) => apiPost<any>(`/admin/integrations/${key}/test`),

  // Website leads (contact enquiries + newsletter subscribers)
  leads: (params?: object) => getPaged<any>('/admin/leads', params),
  leadStats: () => apiGet<any>('/admin/leads/stats'),
  updateLead: (id: string, body: object) => api.patch(`/admin/leads/${id}`, body).then((r) => r.data.data),
  deleteLead: (id: string) => api.delete(`/admin/leads/${id}`).then((r) => r.data),
  exportLeads: (params?: { type?: string; status?: string; format?: 'csv' | 'xlsx' }) =>
    download('/admin/leads/export', params || {}, `leads.${params?.format || 'csv'}`),

  /* ── Analytics dashboard ── */
  analyticsSummary: (from?: string, to?: string) => apiGet<any>('/admin/analytics/summary', { from, to }),
  analyticsTraffic: (from?: string, to?: string) => apiGet<any>('/admin/analytics/traffic', { from, to }),
  analyticsEngagement: (from?: string, to?: string) => apiGet<any>('/admin/analytics/engagement', { from, to }),
  analyticsGeo: (from?: string, to?: string, country?: string, region?: string) =>
    apiGet<any>('/admin/analytics/geo', { from, to, country, region }),
  analyticsFeatures: (from?: string, to?: string) => apiGet<any>('/admin/analytics/features', { from, to }),
  analyticsJourneys: (from?: string, to?: string) => apiGet<any>('/admin/analytics/journeys', { from, to }),
  analyticsRealtime: () => apiGet<any>('/admin/analytics/realtime'),
  exportAnalytics: (params: { from?: string; to?: string; format: 'csv' | 'xlsx' | 'pdf' }) =>
    download('/admin/analytics/export', params, `analytics.${params.format}`),
};

export default adminApi;
