import { z } from 'zod';

export const answerSchema = z.object({
  answer: z.string().max(20000).default(''),
  durationSeconds: z.number().int().nonnegative().optional(),
  audioUrl: z.string().optional(),
});

export const proctoringSchema = z.object({
  type: z.enum([
    'tab_switch',
    'window_blur',
    'fullscreen_exit',
    'copy',
    'paste',
    'right_click',
    'face_missing',
    'multiple_faces',
    'no_audio',
  ]),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  detail: z.any().optional(),
});

export const precheckSchema = z.object({
  camera: z.boolean().optional(),
  microphone: z.boolean().optional(),
  internet: z.boolean().optional(),
  browser: z.string().optional(),
});

export const startSchema = z.object({ language: z.enum(['en', 'hi']).optional() });
export const languageSchema = z.object({ language: z.enum(['en', 'hi']) });
