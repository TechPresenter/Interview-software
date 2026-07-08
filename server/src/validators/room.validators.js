import { z } from 'zod';

export const answerSchema = z.object({
  answer: z.string().max(20000).default(''),
  durationSeconds: z.number().int().nonnegative().optional(),
  audioUrl: z.string().optional(),
});

/** A single proctoring event. `type` is open (validated by weight table server-side). */
const proctorEvent = z.object({
  type: z.string().min(1).max(64),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  detail: z.any().optional(),
  screenshotUrl: z.string().max(500).optional(),
  at: z.union([z.string(), z.number()]).optional(),
});

/** Accept a single event (legacy) or a batch: { events: [...] }. */
export const proctoringSchema = z.union([
  proctorEvent,
  z.object({ events: z.array(proctorEvent).max(100) }),
]);

/** Device + network fingerprint payload (§10). */
export const deviceSchema = z.object({
  device: z.record(z.any()).optional(),
  network: z.record(z.any()).optional(),
  attentionScore: z.number().min(0).max(100).optional(),
  eyeContactPct: z.number().min(0).max(100).optional(),
  // Phase 2 identity signals (liveness / face-match).
  identity: z
    .object({
      verified: z.boolean().optional(),
      livenessPassed: z.boolean().optional(),
      faceMatch: z.number().min(0).max(100).optional(),
      method: z.string().max(40).optional(),
    })
    .optional(),
});

/** Evidence screenshot payload (§13) — base64 image. */
export const evidenceSchema = z.object({
  imageBase64: z.string().min(10),
  type: z.string().max(32).optional(),
  reason: z.string().max(64).optional(),
});

export const precheckSchema = z.object({
  camera: z.boolean().optional(),
  microphone: z.boolean().optional(),
  internet: z.boolean().optional(),
  browser: z.string().optional(),
});

export const startSchema = z.object({ language: z.enum(['en', 'hi']).optional() });
export const languageSchema = z.object({ language: z.enum(['en', 'hi']) });
