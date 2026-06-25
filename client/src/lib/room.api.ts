import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Interview-room client. These endpoints are token-gated (no auth header), so we
 * use a bare axios instance keyed by the interview accessToken in the URL.
 */
const http = axios.create({ baseURL: `${BASE}/interview-room` });

export interface RoomQuestion {
  text: string;
  competencies?: string[];
  isFollowUp?: boolean;
}
export interface RoomProgress {
  current: number;
  total: number;
}

export const roomApi = {
  get: (token: string) => http.get(`/${token}`).then((r) => r.data.data),
  start: (token: string, language?: 'en' | 'hi') => http.post(`/${token}/start`, { language }).then((r) => r.data.data),
  answer: (token: string, body: { answer: string; durationSeconds?: number }) =>
    http.post(`/${token}/answer`, body).then((r) => r.data.data),
  skip: (token: string) => http.post(`/${token}/skip`).then((r) => r.data.data),
  setLanguage: (token: string, language: 'en' | 'hi') => http.post(`/${token}/language`, { language }).then((r) => r.data.data),
  complete: (token: string) => http.post(`/${token}/complete`).then((r) => r.data.data),
  proctoring: (token: string, type: string, severity: 'low' | 'medium' | 'high' = 'low') =>
    http.post(`/${token}/proctoring`, { type, severity }).then((r) => r.data.data).catch(() => null),
  uploadRecording: (token: string, blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const fd = new FormData();
    fd.append('recording', blob, `interview.${ext}`);
    return http.post(`/${token}/recording`, fd).then((r) => r.data.data).catch(() => null);
  },
};

export default roomApi;
