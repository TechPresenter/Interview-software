/**
 * Question bank types + display metadata.
 *
 * The server keeps its enum values stable because they are load-bearing
 * (difficulty drives adaptDifficulty; status gates what the selector serves).
 * Friendly labels — "Beginner" for `easy` — live here, at the display layer,
 * so the wire format never has to change to satisfy a copy tweak.
 */

export type QuestionType =
  | 'technical' | 'hr' | 'behavioral' | 'situational' | 'scenario' | 'problem_solving'
  | 'coding' | 'mcq' | 'aptitude' | 'logical_reasoning' | 'communication' | 'domain'
  | 'leadership' | 'role_specific' | 'true_false' | 'short_answer' | 'long_answer' | 'custom';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type QuestionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
export type QuestionSource = 'manual' | 'ai' | 'import';
export type QuestionLanguage = 'en' | 'hi' | 'bilingual';
export type ExperienceLevel = 'fresher' | 'junior' | 'mid' | 'senior' | 'lead';

export interface AnswerKey {
  idealAnswer?: string;
  keyPoints?: string[];
  expectedSkills?: string[];
  strongIndicators?: string[];
  weakIndicators?: string[];
  followUps?: string[];
  rubric?: { band: string; min: number; max: number; descriptor?: string }[];
  interviewerNotes?: string;
  generatedAt?: string;
}

export interface Question {
  _id: string;
  company?: string | null;
  isPublic?: boolean;
  type: QuestionType;
  category?: string | null; // industry
  topic?: string;
  jobRole?: string;
  department?: string;
  experienceLevel?: ExperienceLevel | null;
  difficulty: Difficulty;
  language: QuestionLanguage;
  text: string;
  textHi?: string;
  rationale?: string;
  skills?: string[];
  competencies?: string[];
  expectedPoints?: string[];
  coding?: { language?: string; starterCode?: string; testCases?: { input: string; expectedOutput: string; hidden?: boolean }[] };
  mcq?: { options?: { text: string; isCorrect?: boolean }[]; multiSelect?: boolean };
  answerKey?: AnswerKey;
  status: QuestionStatus;
  source: QuestionSource;
  isActive?: boolean;
  archivedAt?: string | null;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionStats {
  total: number;
  withAnswerKey?: number;
  byType: { _id: string; count: number }[];
  byCategory: { _id: string | null; count: number }[];
  byDifficulty: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
  bySource?: { _id: string; count: number }[];
}

export interface GenerateQuestionsInput {
  jobId?: string;
  jobTitle?: string;
  jobDescription?: string;
  department?: string;
  industry?: string;
  skills?: string[];
  resumeText?: string;
  experienceLevel?: ExperienceLevel;
  yearsExperience?: number;
  education?: string;
  certifications?: string[];
  round?: string;
  difficulty?: Difficulty;
  count?: number;
  durationMinutes?: number;
  language?: QuestionLanguage;
  types?: QuestionType[];
  save?: boolean;
}

export interface GenerateResult {
  questions: Question[];
  inserted?: number;
  dropped: number;
  /** Why the server rejected the model's other questions. */
  reasons: { filler?: number; duplicate?: number; invalid?: number };
}

/* ── Display metadata ── */

export const QUESTION_TYPES: QuestionType[] = [
  'technical', 'hr', 'behavioral', 'situational', 'scenario', 'problem_solving',
  'coding', 'mcq', 'aptitude', 'logical_reasoning', 'communication', 'domain',
  'leadership', 'role_specific', 'true_false', 'short_answer', 'long_answer', 'custom',
];

export const INDUSTRIES = [
  'software_development', 'data_science', 'ai_ml', 'cyber_security', 'cloud_computing',
  'devops', 'digital_marketing', 'sales', 'hr', 'finance', 'accounting', 'healthcare',
  'education', 'manufacturing', 'banking', 'retail', 'customer_support', 'government',
  'hospitality', 'logistics', 'legal', 'custom',
];

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
export const LANGUAGES: QuestionLanguage[] = ['en', 'hi', 'bilingual'];
export const EXPERIENCE_LEVELS: ExperienceLevel[] = ['fresher', 'junior', 'mid', 'senior', 'lead'];
export const STATUSES: QuestionStatus[] = ['draft', 'pending_review', 'approved', 'rejected'];

/** The spec's Beginner/Intermediate/Advanced wording, mapped at display time. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Beginner',
  medium: 'Intermediate',
  hard: 'Advanced',
  expert: 'Expert',
};

export const LANGUAGE_LABELS: Record<QuestionLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  bilingual: 'Bilingual',
};

export const STATUS_TONES: Record<QuestionStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  approved: 'success',
  pending_review: 'warning',
  rejected: 'danger',
  draft: 'muted',
};

export const DIFFICULTY_TONES: Record<Difficulty, 'success' | 'info' | 'warning' | 'danger'> = {
  easy: 'success',
  medium: 'info',
  hard: 'warning',
  expert: 'danger',
};

/**
 * Words naive title-casing gets wrong. Without these you get "Ai Ml", "Mcq",
 * "Hr" and "Devops" in the UI.
 */
const LABEL_OVERRIDES: Record<string, string> = {
  ai_ml: 'AI / ML',
  hr: 'HR',
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  devops: 'DevOps',
  problemSolving: 'Problem Solving',
  culturalFit: 'Cultural Fit',
  logical_reasoning: 'Logical Reasoning',
  role_specific: 'Role Specific',
  pending_review: 'Pending review',
};

/** `software_development` -> `Software Development` */
export const humanize = (v?: string | null) => {
  if (!v) return '—';
  if (LABEL_OVERRIDES[v]) return LABEL_OVERRIDES[v];
  return v
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

/** `1 question`, `2 questions`. */
export const plural = (n: number, word: string, suffix = 's') => `${n} ${word}${n === 1 ? '' : suffix}`;
