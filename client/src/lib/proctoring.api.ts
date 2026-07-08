import { api } from './api';

/** Public origin for evidence image URLs (strips the /api/v1 suffix). */
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

/**
 * Proctoring audit API (§12). Role-aware: super_admin hits /admin/proctoring
 * (platform-wide), company roles hit /proctoring (tenant-scoped). Same shapes.
 */
const base = (admin: boolean) => (admin ? '/admin/proctoring' : '/proctoring');

export const proctoringApi = {
  list: (admin: boolean, params?: object) =>
    api.get(base(admin), { params }).then((r) => ({ items: r.data.data as any[], meta: r.data.meta })),
  stats: (admin: boolean) => api.get(`${base(admin)}/stats`).then((r) => r.data.data),
  detail: (admin: boolean, id: string) => api.get(`${base(admin)}/${id}`).then((r) => r.data.data),
  exportCsv: async (admin: boolean, params?: object) => {
    const res = await api.get(`${base(admin)}/export`, { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proctoring-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

/** Resolve an evidence/screenshot URL (relative → absolute). */
export const evidenceUrl = (u?: string) => (!u ? '' : u.startsWith('http') ? u : `${API_ORIGIN}${u}`);

export default proctoringApi;
