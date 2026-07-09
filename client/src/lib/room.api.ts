import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Interview-room client. These endpoints are token-gated (no auth header), so we
 * use a bare axios instance keyed by the interview accessToken in the URL.
 */
// 30s timeout so a hung request (flaky mobile network) can't freeze the room
// on "submitting" — the caller recovers and lets the candidate retry.
const http = axios.create({ baseURL: `${BASE}/interview-room`, timeout: 30000 });

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
  tts: (token: string, text: string, language: 'en' | 'hi', gender: 'female' | 'male' | 'auto' = 'female') =>
    http
      .post(`/${token}/tts`, { text, lang: language, gender })
      .then((r) => r.data.data as { audios: string[]; mime: string | null })
      .catch(() => null),
  complete: (token: string) => http.post(`/${token}/complete`).then((r) => r.data.data),
  proctoring: (token: string, type: string, severity: 'low' | 'medium' | 'high' = 'low') =>
    http.post(`/${token}/proctoring`, { type, severity }).then((r) => r.data.data).catch(() => null),
  /** Batch proctoring events (§ engine flushes here). */
  proctoringBatch: (token: string, events: Array<{ type: string; severity?: string; detail?: unknown; at?: number }>) =>
    http.post(`/${token}/proctoring`, { events }).then((r) => r.data.data).catch(() => null),
  /** Device + network fingerprint (§10). */
  device: (token: string, payload: { device?: unknown; network?: unknown; attentionScore?: number; eyeContactPct?: number; identity?: { livenessPassed?: boolean; faceMatch?: number; verified?: boolean; method?: string } }) =>
    http.post(`/${token}/device`, payload).then((r) => r.data.data).catch(() => null),
  /** Evidence screenshot / webcam snapshot (§13). */
  evidence: (token: string, imageBase64: string, reason?: string, type = 'screenshot') =>
    http.post(`/${token}/evidence`, { imageBase64, reason, type }).then((r) => r.data.data).catch(() => null),
  uploadRecording: (token: string, blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const fd = new FormData();
    fd.append('recording', blob, `interview.${ext}`);
    return http.post(`/${token}/recording`, fd).then((r) => r.data.data).catch(() => null);
  },
  /** Append one MediaRecorder chunk during the interview (incremental full recording). */
  uploadRecordingChunk: (token: string, blob: Blob, first: boolean) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const fd = new FormData();
    fd.append('chunk', blob, `chunk.${ext}`);
    return http.post(`/${token}/recording-chunk`, fd, { params: { first: first ? 1 : 0, ext }, timeout: 60000 }).then((r) => r.data.data).catch(() => null);
  },
};

export default roomApi;
