import { api, apiGet } from './api';

/**
 * Knowledge base API. KB routes are mounted under both /knowledge-bases (company
 * roles) and /admin/knowledge-bases (super-admin) — the base is chosen by role.
 */
const base = (role?: string) => (role === 'super_admin' ? '/admin/knowledge-bases' : '/knowledge-bases');

export const knowledgeApi = {
  list: (role?: string) => apiGet<any[]>(base(role)),
  get: (role: string | undefined, id: string) => apiGet<any>(`${base(role)}/${id}`),
  create: (role: string | undefined, fd: FormData) => api.post(base(role), fd).then((r) => r.data.data),
  addSources: (role: string | undefined, id: string, fd: FormData, mode: 'append' | 'replace' = 'append') =>
    api.post(`${base(role)}/${id}/sources?mode=${mode}`, fd).then((r) => r.data.data),
  update: (role: string | undefined, id: string, body: object) => api.patch(`${base(role)}/${id}`, body).then((r) => r.data.data),
  toggle: (role: string | undefined, id: string) => api.post(`${base(role)}/${id}/toggle`).then((r) => r.data.data),
  remove: (role: string | undefined, id: string) => api.delete(`${base(role)}/${id}`).then((r) => r.data),
};

export default knowledgeApi;
