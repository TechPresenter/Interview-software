import { z } from 'zod';

export const answerSchema = z.object({
  answer: z.string().max(20000).default(''),
  durationSeconds: z.number().int().nonnegative().optional(),
  audioUrl: z.string().optional(),
  /**
   * Which question this answers. The room echoes back the token it was served;
   * the server uses it to tell a genuine answer from the retry of a submit that
   * timed out client-side but succeeded here.
   *
   * It has to be declared: zod strips unknown keys, so an undeclared `turn`
   * would be dropped before the controller ever saw it and the guard would look
   * like it was working while never firing once.
   *
   * Optional on purpose — a room loaded before this shipped sends none, and must
   * keep working.
   */
  turn: z.number().int().nonnegative().optional(),
});

/** Skip carries the same turn token, for the same reason. */
export const skipSchema = z.object({
  turn: z.number().int().nonnegative().optional(),
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
