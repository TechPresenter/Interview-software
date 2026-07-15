// Central enums shared across models, validation, and RBAC.

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  RECRUITER: 'recruiter',
  HR_MANAGER: 'hr_manager',
  CANDIDATE: 'candidate',
});
export const ROLE_VALUES = Object.values(ROLES);

/** Roles that operate within a single company tenant. */
export const COMPANY_ROLES = [ROLES.COMPANY_ADMIN, ROLES.RECRUITER, ROLES.HR_MANAGER];

export const PLANS = Object.freeze({
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
});
export const PLAN_VALUES = Object.values(PLANS);

export const COMPANY_STATUS = ['active', 'suspended', 'pending'];

export const JOB_STATUS = ['draft', 'open', 'paused', 'closed'];

export const INTERVIEW_TYPES = ['hr', 'technical', 'behavioral', 'aptitude', 'coding'];

export const INTERVIEW_STATUS = [
  'scheduled',
  'in_progress',
  'paused',
  'completed',
  'expired',
  'cancelled',
  'terminated',
  'flagged',
];

/**
 * LEGACY. Despite the name these values are question *formats*, not domains.
 * Kept verbatim so existing docs stay valid; the migration copies them into
 * `Question.type` and `category` is repurposed for INDUSTRIES below.
 */
export const QUESTION_CATEGORIES = [
  'technical',
  'hr',
  'aptitude',
  'behavioral',
  'coding',
  'custom',
];

/** What KIND of question it is (format/style). Superset of the legacy values. */
export const QUESTION_TYPES = [
  'technical',
  'hr',
  'behavioral',
  'situational',
  'scenario',
  'problem_solving',
  'coding',
  'mcq',
  'aptitude',
  'logical_reasoning',
  'communication',
  'domain',
  'leadership',
  'role_specific',
  'true_false',
  'short_answer',
  'long_answer',
  'custom',
];

/** The industry/domain a question belongs to (`category` after migration). */
export const INDUSTRIES = [
  'software_development',
  'data_science',
  'ai_ml',
  'cyber_security',
  'cloud_computing',
  'devops',
  'digital_marketing',
  'sales',
  'hr',
  'finance',
  'accounting',
  'healthcare',
  'education',
  'manufacturing',
  'banking',
  'retail',
  'customer_support',
  'government',
  'hospitality',
  'logistics',
  'legal',
  'custom',
];

/** Moderation state — AI-generated questions land in `pending_review`. */
export const QUESTION_STATUS = ['draft', 'pending_review', 'approved', 'rejected'];

/** Where a question came from (lets admins track AI-generated content). */
export const QUESTION_SOURCES = ['manual', 'ai', 'import'];

/** Interview rounds (spec: HR, Technical, Managerial, Final). */
export const INTERVIEW_ROUNDS = ['screening', 'hr', 'technical', 'managerial', 'final'];

/**
 * NOTE: these are the DB values and are load-bearing (adaptDifficulty's
 * DIFFICULTY_ORDER, existing Report docs, export.service). The spec's
 * Beginner/Intermediate/Advanced/Expert are a DISPLAY concern — map at the UI
 * layer, never rename here.
 */
export const DIFFICULTY = ['easy', 'medium', 'hard', 'expert'];
export const DIFFICULTY_LABELS = { easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced', expert: 'Expert' };

export const EXPERIENCE_LEVELS = ['fresher', 'junior', 'mid', 'senior', 'lead'];

export const PIPELINE_STAGES = [
  'applied',
  'screening',
  'interview',
  'shortlisted',
  'hired',
  'rejected',
];

export const RECOMMENDATIONS = ['strong_hire', 'hire', 'consider', 'reject'];

export const PAYMENT_STATUS = ['created', 'pending', 'paid', 'failed', 'refunded'];
export const PAYMENT_PROVIDERS = ['stripe', 'razorpay', 'cashfree', 'manual'];

export const NOTIFICATION_TYPES = [
  'interview_scheduled',
  'interview_reminder',
  'interview_completed',
  'report_ready',
  'pipeline_update',
  'system',
  'billing',
];

export const COMPETENCIES = [
  'technical',
  'domain', // industry/role knowledge, distinct from general technical skill
  'communication',
  'confidence',
  'behavioral',
  'leadership',
  'problemSolving',
  'culturalFit',
];

/**
 * Default scoring weights. MUST sum to 1.0.
 *
 * Single source of truth: settings.service and scoring.engine both held their
 * own verbatim copy, so adding a competency to one silently skewed the other.
 * `aggregate()` renormalises over the competencies that have data, so a stored
 * admin override missing a newer key stays valid.
 */
/* ── Interview applications (public "Apply for Interview" module) ─────────── */

/** Where an application sits in the review funnel. */
export const APPLICATION_STATUS = ['pending', 'under_review', 'shortlisted', 'rejected', 'selected'];

/**
 * What we actually know about an application fee.
 *
 * Distinct from PAYMENT_STATUS above, which is the billing Payment model's
 * gateway-driven lifecycle (created → paid). This one is claim-driven, because
 * the Pay Now button is a redirect to a URL the admin configures — a one-way
 * trip with nothing coming back to tell us the money arrived. So the applicant's
 * word and a verified fact are deliberately different states: `claimed` means
 * they pasted a reference, `verified` means a human checked it against the
 * provider. Collapsing the two would let an application print a PDF saying
 * "Paid" on nothing but the applicant's say-so.
 */
export const APPLICATION_PAYMENT_STATUS = ['unpaid', 'claimed', 'verified', 'failed', 'waived'];

/** Fresher vs experienced — drives which professional fields are required. */
export const EXPERIENCE_TYPE = ['fresher', 'experienced'];

export const DEFAULT_AI_WEIGHTAGE = Object.freeze({
  technical: 0.25,
  domain: 0.15,
  problemSolving: 0.18,
  communication: 0.14,
  behavioral: 0.1,
  confidence: 0.08,
  leadership: 0.05,
  culturalFit: 0.05,
});
