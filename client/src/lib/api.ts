import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Axios instance with:
 *  - access token injected from the auth store
 *  - automatic refresh on 401 (single-flight) using the httpOnly refresh cookie
 */
export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  try {
    const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
    const token = res.data?.data?.accessToken ?? null;
    setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshing = refreshing ?? refreshToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** Narrow helper for the standard { success, message, data } envelope. */
export async function apiGet<T>(url: string, params?: object) {
  const { data } = await api.get(url, { params });
  return data.data as T;
}
export async function apiPost<T>(url: string, body?: object) {
  const { data } = await api.post(url, body);
  return data.data as T;
}

export default api;
