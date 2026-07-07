import { api, apiGet, apiPost } from './api';

/** Personal account: identity, security (2FA/sessions), and notifications. */
export const accountApi = {
  me: () => apiGet<any>('/auth/me'),
  notifications: () => apiGet<any>('/notifications'),
  markAllRead: () => apiPost('/notifications/read-all'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  twoFactorSetup: () => apiPost<any>('/auth/2fa/setup'),
  twoFactorEnable: (token: string) => apiPost('/auth/2fa/enable', { token }),
  twoFactorDisable: () => apiPost('/auth/2fa/disable'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  updateProfile: (body: object) => api.patch('/auth/profile', body).then((r) => r.data.data),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/auth/avatar', fd).then((r) => r.data.data);
  },
  logoutAll: () => apiPost('/auth/logout-all'),
};

export default accountApi;
