import { z } from 'zod';
import {
  PLAN_VALUES,
  QUESTION_CATEGORIES,
  DIFFICULTY,
  COMPETENCIES,
} from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/* ── Companies ─────────────────────────────────────────── */
export const createCompanySchema = z.object({
  name: z.string().min(2).max(160),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  plan: z.enum(PLAN_VALUES).optional(),
  // Optional: provision an initial admin user for the company.
  adminEmail: z.string().email().optional(),
  adminName: z.string().min(2).optional(),
});

export const updateCompanySchema = createCompanySchema.partial().extend({
  contactEmail: z.string().email().optional(),
  billingEmail: z.string().email().optional(),
  branding: z
    .object({ primaryColor: z.string().optional(), accentColor: z.string().optional() })
    .optional(),
});

/* ── Plans ─────────────────────────────────────────────── */
export const upsertPlanSchema = z.object({
  key: z.enum(PLAN_VALUES),
  name: z.string().min(2),
  description: z.string().optional(),
  pricing: z
    .object({
      monthly: z.number().int().nonnegative().optional(),
      yearly: z.number().int().nonnegative().optional(),
      currency: z.string().optional(),
    })
    .optional(),
  limits: z
    .object({
      seats: z.number().int().positive().optional(),
      activeJobs: z.number().int().positive().optional(),
      interviewsPerMonth: z.number().int().positive().optional(),
      aiTokensPerMonth: z.number().int().positive().optional(),
    })
    .optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

/* ── Coupons ───────────────────────────────────────────── */
export const createCouponSchema = z.object({
  code: z.string().min(3).max(40),
  description: z.string().optional(),
  type: z.enum(['percent', 'amount']),
  value: z.number().positive(),
  currency: z.string().optional(),
  appliesToPlans: z.array(z.enum(PLAN_VALUES)).optional(),
  maxRedemptions: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

/* ── Questions ─────────────────────────────────────────── */
export const upsertQuestionSchema = z.object({
  category: z.enum(QUESTION_CATEGORIES),
  difficulty: z.enum(DIFFICULTY).optional(),
  text: z.string().min(5),
  skills: z.array(z.string()).optional(),
  expectedPoints: z.array(z.string()).optional(),
  competencies: z.array(z.enum(COMPETENCIES)).optional(),
  coding: z
    .object({
      language: z.string().optional(),
      starterCode: z.string().optional(),
      testCases: z
        .array(z.object({ input: z.string(), expectedOutput: z.string(), hidden: z.boolean().optional() }))
        .optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export const bulkQuestionsSchema = z.object({ questions: z.array(upsertQuestionSchema).min(1).max(200) });

/* ── AI management ─────────────────────────────────────── */
export const aiSettingsSchema = z.object({
  model: z.string().optional(),
  modelFast: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const aiWeightageSchema = z.object(
  Object.fromEntries(COMPETENCIES.map((c) => [c, z.number().min(0).max(1)])),
);

export const aiPromptSchema = z.object({
  key: z.enum(['greeting', 'nextQuestion', 'followUp', 'scoreAnswer', 'finalReport', 'analyzeResume']),
  system: z.string().optional(),
  template: z.string().min(1),
});

/* ── Candidates (admin) ────────────────────────────────── */
export const updateCandidateAdminSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  stage: z.enum(['applied', 'screening', 'interview', 'shortlisted', 'hired', 'rejected']).optional(),
  skills: z.array(z.string()).optional(),
});

/* ── AI providers ──────────────────────────────────────── */
export const createAiProviderSchema = z.object({
  label: z.string().min(2),
  type: z.enum(['claude', 'gemini', 'openai', 'azure_openai', 'groq', 'openrouter', 'custom']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  rateLimitPerMin: z.number().int().positive().optional(),
  notes: z.string().optional(),
});
export const updateAiProviderSchema = createAiProviderSchema.partial();

/* ── System settings ───────────────────────────────────── */
export const settingsGroupSchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.any(),
        isSecret: z.boolean().optional(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

export { objectId };
