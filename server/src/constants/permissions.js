// RBAC permission catalog shared by the Role model, middleware, and the UI.

export const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete'];

/** Modules a company staff role can be granted access to. */
export const PERMISSION_MODULES = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'questions', label: 'Question Bank' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'reports', label: 'Reports & Analytics' },
  { key: 'recordings', label: 'Recordings' },
  { key: 'knowledge', label: 'Knowledge Base' },
  { key: 'billing', label: 'Billing' },
  { key: 'staff', label: 'Staff & Roles' },
  { key: 'settings', label: 'Settings' },
];

export const MODULE_KEYS = PERMISSION_MODULES.map((m) => m.key);

const crud = (c, r, u, d) => ({ create: c, read: r, update: u, delete: d });

/** Every module fully granted — used for owners/admins. */
export function fullPermissions() {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, crud(true, true, true, true)]));
}

/** No access — the safe default when nothing is configured. */
export function emptyPermissions() {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, crud(false, false, false, false)]));
}

/** Sensible built-in defaults per coarse company role (used when no custom role is set). */
export const DEFAULT_PERMISSIONS = {
  recruiter: {
    ...emptyPermissions(),
    jobs: crud(true, true, true, false),
    candidates: crud(true, true, true, false),
    interviews: crud(true, true, true, false),
    questions: crud(true, true, true, false),
    pipeline: crud(false, true, true, false),
    reports: crud(false, true, false, false),
    recordings: crud(false, true, false, false),
    knowledge: crud(false, true, false, false),
  },
  hr_manager: {
    ...emptyPermissions(),
    jobs: crud(false, true, false, false),
    candidates: crud(true, true, true, false),
    interviews: crud(true, true, true, false),
    questions: crud(true, true, true, false),
    pipeline: crud(false, true, true, false),
    reports: crud(false, true, false, false),
    recordings: crud(false, true, false, false),
    knowledge: crud(false, true, false, false),
  },
};

/** Starter role templates a company can clone when creating custom roles. */
export const ROLE_TEMPLATES = [
  { key: 'recruiter', name: 'Recruiter', description: 'Manage jobs, candidates, and interviews.', permissions: DEFAULT_PERMISSIONS.recruiter },
  { key: 'hr_manager', name: 'HR Manager', description: 'Review candidates, interviews, and reports.', permissions: DEFAULT_PERMISSIONS.hr_manager },
  { key: 'interviewer', name: 'Interviewer', description: 'View candidates and run interviews only.', permissions: { ...emptyPermissions(), candidates: crud(false, true, false, false), interviews: crud(false, true, true, false), recordings: crud(false, true, false, false) } },
  { key: 'viewer', name: 'Viewer', description: 'Read-only access across the workspace.', permissions: Object.fromEntries(MODULE_KEYS.map((k) => [k, crud(false, k !== 'billing' && k !== 'staff', false, false)])) },
];
