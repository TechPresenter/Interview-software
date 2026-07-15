import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Interview-room client. These endpoints are token-gated (no auth header), so we
 * use a bare axios instance keyed by the interview accessToken in the URL.
 */
/**
 * 90s, not 30s.
 *
 * A timeout has to be longer than the work, and answering is two sequential LLM
 * calls on the server — scoring, then generating the next question. Measured on
 * real traffic: p50 1.4s, p90 7.1s, worst observed pair 23.5s, with individual
 * calls already seen above 30s. So the old 30s budget was a coin flip against
 * the tail: usually fine, and "sometimes" not — which is exactly how it was
 * reported. Aborting there did not save the candidate anything either, because
 * the request kept running on the server regardless.
 *
 * Retries are safe now (each answer carries the turn token it belongs to), so
 * the remaining job of this timeout is only to stop a truly dead socket from
 * wedging the room forever.
 */
const http = axios.create({ baseURL: `${BASE}/interview-room`, timeout: 90000 });

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
  // `turn` identifies the question being answered, so a retry after a timeout is
  // recognised as a replay instead of being filed against the NEXT question.
  answer: (token: string, body: { answer: string; durationSeconds?: number; turn?: number }) =>
    http.post(`/${token}/answer`, body).then((r) => r.data.data),
  skip: (token: string, turn?: number) => http.post(`/${token}/skip`, { turn }).then((r) => r.data.data),
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
