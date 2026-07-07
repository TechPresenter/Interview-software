import { apiGet, apiPost, api } from './api';
import type { Paged } from './admin.api';

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

export const companyApi = {
  overview: () => apiGet<any>('/company/overview'),

  // Jobs
  jobs: (params?: object) => getPaged<any>('/jobs', params),
  job: (id: string) => apiGet<any>(`/jobs/${id}`),
  createJob: (body: object) => apiPost<any>('/jobs', body),
  updateJob: (id: string, body: object) => api.patch(`/jobs/${id}`, body).then((r) => r.data.data),
  deleteJob: (id: string) => api.delete(`/jobs/${id}`).then((r) => r.data),
  cloneJob: (id: string) => apiPost<any>(`/jobs/${id}/clone`),

  // Candidates
  candidates: (params?: object) => getPaged<any>('/candidates', params),
  candidate: (id: string) => apiGet<any>(`/candidates/${id}`),
  createCandidate: (body: object) => apiPost<any>('/candidates', body),
  updateCandidate: (id: string, body: object) => api.patch(`/candidates/${id}`, body).then((r) => r.data.data),
  deleteCandidate: (id: string) => api.delete(`/candidates/${id}`).then((r) => r.data),
  importCandidates: (file: File, job?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/candidates/import', fd, { params: { job } }).then((r) => r.data.data);
  },
  uploadResume: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('resume', file);
    return api.post(`/candidates/${id}/resume`, fd).then((r) => r.data.data);
  },
  moveStage: (id: string, stage: string) => api.patch(`/candidates/${id}/stage`, { stage }).then((r) => r.data.data),

  // Interviews
  interviews: (params?: object) => getPaged<any>('/interviews', params),
  interview: (id: string) => apiGet<any>(`/interviews/${id}`),
  recordings: (params?: object) => getPaged<any>('/recordings', params),
  schedule: (body: object) => apiPost<any>('/interviews', body),
  autoSchedule: (body: object) => apiPost<any>('/interviews/auto', body),
  invite: (id: string) => apiPost<any>(`/interviews/${id}/invite`),
  cancelInterview: (id: string) => apiPost<any>(`/interviews/${id}/cancel`),
  // Live monitoring + force controls
  monitor: (id: string) => apiGet<any>(`/interviews/${id}/monitor`),
  pauseInterview: (id: string) => apiPost<any>(`/interviews/${id}/pause`),
  resumeInterview: (id: string) => apiPost<any>(`/interviews/${id}/resume`),
  terminateInterview: (id: string) => apiPost<any>(`/interviews/${id}/terminate`),

  // Pipeline
  pipeline: (job?: string) => apiGet<any>('/pipeline', { job }),

  // Billing
  billing: () => apiGet<any>('/billing'),
  billingInvoices: () => apiGet<any[]>('/billing/invoices'),
  downloadInvoice: (id: string) => download(`/billing/invoices/${id}/pdf`, {}, `invoice-${id}.pdf`),

  // Custom AI interviewer
  aiInterviewer: () => apiGet<any>('/company/ai-interviewer'),
  updateInterviewer: (body: object) => api.put('/company/ai-interviewer', body).then((r) => r.data.data),
  uploadInterviewerAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/company/ai-interviewer/avatar', fd).then((r) => r.data.data);
  },
  checkout: (body: object) => apiPost<any>('/billing/checkout', body),
  verifyRazorpay: (body: object) => apiPost<any>('/billing/razorpay/verify', body),
  cancelBilling: () => apiPost<any>('/billing/cancel'),

  // Reports
  reports: (params?: object) => getPaged<any>('/reports', params),
  report: (id: string) => apiGet<any>(`/reports/${id}`),
  ranking: (job?: string) => apiGet<any[]>('/reports/ranking', { job }),
  reportAnalytics: () => apiGet<any>('/reports/analytics'),
  exportReport: (id: string) => download(`/reports/${id}/export`, { format: 'pdf' }, 'report.pdf'),
  exportRanking: (job?: string) => download('/reports/ranking/export', { job }, 'ranking.xlsx'),

  // RBAC — staff & roles
  myPermissions: () => apiGet<any>('/company/me/permissions'),
  staff: () => apiGet<any[]>('/company/staff'),
  addStaff: (body: object) => apiPost<any>('/company/staff', body),
  updateStaff: (id: string, body: object) => api.patch(`/company/staff/${id}`, body).then((r) => r.data.data),
  removeStaff: (id: string) => api.delete(`/company/staff/${id}`).then((r) => r.data),
  loginHistory: () => apiGet<any[]>('/company/staff/login-history'),
  roles: () => apiGet<any[]>('/company/roles'),
  rolesCatalog: () => apiGet<any>('/company/roles/catalog'),
  createRole: (body: object) => apiPost<any>('/company/roles', body),
  updateRole: (id: string, body: object) => api.patch(`/company/roles/${id}`, body).then((r) => r.data.data),
  deleteRole: (id: string) => api.delete(`/company/roles/${id}`).then((r) => r.data),

  // Company email / SMTP
  emailConfig: () => apiGet<any>('/company/email-config'),
  updateEmailConfig: (body: object) => api.put('/company/email-config', body).then((r) => r.data.data),
  testEmailConfig: (to?: string) => apiPost<any>('/company/email-config/test', { to }),
  emailLogs: (params?: object) => getPaged<any>('/company/email-logs', params),
  retryEmail: (id: string) => apiPost<any>(`/company/email-logs/${id}/retry`),

  // Integration API keys
  apiKeys: () => apiGet<any[]>('/company/api-keys'),
  createApiKey: (body: object) => apiPost<any>('/company/api-keys', body),
  revokeApiKey: (id: string) => api.delete(`/company/api-keys/${id}`).then((r) => r.data),
};

export default companyApi;
