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

export const QUESTION_CATEGORIES = [
  'technical',
  'hr',
  'aptitude',
  'behavioral',
  'coding',
  'custom',
];

export const DIFFICULTY = ['easy', 'medium', 'hard', 'expert'];

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
export const PAYMENT_PROVIDERS = ['stripe', 'razorpay'];

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
  'communication',
  'confidence',
  'behavioral',
  'leadership',
  'problemSolving',
  'culturalFit',
];
