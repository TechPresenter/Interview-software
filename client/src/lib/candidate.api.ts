import { apiGet, apiPost, api } from './api';

/** Candidate self-service portal client (authenticated as the candidate). */
export const candidateApi = {
  interviews: () => apiGet<any>('/me/interviews'),
  profile: () => apiGet<any>('/me/profile'),
  updateProfile: (body: object) => api.put('/me/profile', body).then((r) => r.data.data),
  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append('resume', file);
    return api.post('/me/resume', fd).then((r) => r.data.data);
  },
  notifications: () => apiGet<any>('/me/notifications'),
  markRead: (id: string) => api.patch(`/me/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiPost('/me/notifications/read-all'),
};

export default candidateApi;
