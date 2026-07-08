import { z } from 'zod';
import { INTERVIEW_TYPES, JOB_STATUS, PIPELINE_STAGES } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/* ── Jobs ──────────────────────────────────────────────── */
const skill = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(10).optional(),
  required: z.boolean().optional(),
});

export const createJobSchema = z.object({
  title: z.string().min(2).max(160),
  department: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'temporary']).optional(),
  workMode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  description: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  skills: z.array(skill).optional(),
  experience: z.object({ min: z.number().min(0).optional(), max: z.number().min(0).optional() }).optional(),
  salary: z
    .object({ min: z.number().optional(), max: z.number().optional(), currency: z.string().optional() })
    .optional(),
  interviewConfig: z
    .object({
      types: z.array(z.enum(INTERVIEW_TYPES)).optional(),
      durationMinutes: z.number().int().positive().optional(),
      questionCount: z.number().int().positive().optional(),
      adaptiveDifficulty: z.boolean().optional(),
    })
    .optional(),
  knowledgeBase: objectId.optional().nullable(),
  status: z.enum(JOB_STATUS).optional(),
  openings: z.number().int().positive().optional(),
});

export const updateJobSchema = createJobSchema.partial();

/* ── Candidates ────────────────────────────────────────── */
export const createCandidateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().toLowerCase(),
  phone: z.string().optional(),
  location: z.string().optional(),
  job: objectId.optional(),
  skills: z.array(z.string()).optional(),
  source: z.string().optional(),
  education: z
    .array(
      z.object({
        degree: z.string().optional(),
        institution: z.string().optional(),
        field: z.string().optional(),
        startYear: z.number().optional(),
        endYear: z.number().optional(),
      }),
    )
    .optional(),
  experience: z
    .array(
      z.object({
        title: z.string().optional(),
        company: z.string().optional(),
        current: z.boolean().optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  portfolioLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export const stageSchema = z.object({ stage: z.enum(PIPELINE_STAGES) });

export const addNoteSchema = z.object({ body: z.string().min(1).max(2000) });

/* ── Interviews ────────────────────────────────────────── */
export const scheduleInterviewSchema = z.object({
  candidate: objectId,
  job: objectId.optional(),
  knowledgeBase: objectId.optional().nullable(),
  types: z.array(z.enum(INTERVIEW_TYPES)).optional(),
  scheduledAt: z.coerce.date().optional(),
  config: z
    .object({
      durationMinutes: z.number().int().positive().optional(),
      questionCount: z.number().int().positive().optional(),
      adaptiveDifficulty: z.boolean().optional(),
      proctoring: z.boolean().optional(),
      voiceEnabled: z.boolean().optional(),
    })
    .optional(),
  sendInvite: z.boolean().optional(),
});

export const autoInterviewSchema = z.object({
  job: objectId,
  stage: z.enum(PIPELINE_STAGES).optional(),
  types: z.array(z.enum(INTERVIEW_TYPES)).optional(),
  sendInvite: z.boolean().optional(),
});

/** Company workspace deletion — requires typing the exact company name. */
export const deleteAccountSchema = z.object({
  confirm: z.string().min(1, 'Type the company name to confirm'),
  staffAction: z.enum(['delete', 'deactivate']).optional(),
});

export { objectId };
