// The capability catalog every plan includes, in full.
//
// Plans differ by usage limits alone (see models/Plan.js), so this list is
// plan-agnostic by construction: there is no per-tier variant, and no code path
// reads a company's plan before serving any of it. Keeping capability here and
// quotas there is what stops a per-tier `features` array from drifting back into
// an implied gate.
//
// Every entry below is traced to a shipped route or service. This list is served
// verbatim to the public pricing page, so an entry is a promise the product must
// already keep — anything aspirational belongs in a roadmap, not here.

export const PLATFORM_FEATURES = [
  {
    key: 'ai-interviewing',
    category: 'AI interviewing',
    items: [
      { label: 'Adaptive AI interviewer', description: 'Asks, follows up, and steps difficulty between easy and expert based on how the last answer scored.' },
      { label: 'Voice and text answers', description: 'Candidates reply by speaking or typing, whichever suits them.' },
      { label: 'Natural voices in English and Hindi', description: 'Sarvam-powered speech with per-language voices, falling back to browser speech when unconfigured.' },
      { label: 'Live transcript', description: 'Every turn of the conversation is transcribed and kept on the interview record.' },
      { label: 'Configurable interviews', description: 'Set duration, question count, difficulty, language, and how many skips a candidate gets.' },
      { label: 'Skip and resume', description: 'Per-question skip with a cap, and autosaved progress so a dropped connection can reconnect.' },
      { label: 'Bulk auto-scheduling', description: 'Schedule interviews across a whole candidate set in a single action.' },
      { label: 'Live interview control', description: 'Pause, resume, terminate, cancel, or monitor an interview while it runs.' },
      { label: 'Device pre-checks', description: 'Camera and microphone are verified before the interview starts.' },
    ],
  },
  {
    key: 'question-bank',
    category: 'Question bank',
    items: [
      { label: 'Your own question bank', description: 'Full CRUD over questions scoped to your workspace, with usage stats.' },
      { label: 'AI question generation', description: 'Generate role-relevant questions instead of writing every one by hand.' },
      { label: 'Reusable question sets', description: 'Build sets by hand or have the AI compose one, then duplicate to iterate.' },
      { label: 'Skill-aware selection', description: "Questions are chosen by overlap with each job's own weighted skills." },
      { label: 'Review and lifecycle workflow', description: 'Archive, restore, duplicate, attach answer keys, and review in bulk.' },
      { label: 'Four difficulty levels', description: 'Easy, medium, hard, and expert.' },
    ],
  },
  {
    key: 'candidates',
    category: 'Candidates and pipeline',
    items: [
      { label: 'Candidate profiles', description: 'Full profiles carrying each candidate’s complete interview history.' },
      { label: 'CSV import', description: 'Import candidates in bulk, with per-row error reporting.' },
      { label: 'AI resume parsing', description: 'Skills, experience, and education extracted from PDF, DOC, or DOCX.' },
      { label: 'Resume scoring and job match', description: 'ATS score and job-match percentage with gap analysis, re-runnable on demand.' },
      { label: 'Kanban pipeline', description: 'Candidates grouped by stage and moved as they progress.' },
      { label: 'Automatic candidate emails', description: 'Branded shortlisted, selected, and rejected emails fire on decision-stage moves.' },
      { label: 'Notes and candidate search', description: 'Annotate candidates and search by name, email, or the skills parsed from their resume.' },
      { label: 'Candidate portal', description: 'Candidates get their own view of interviews, profile, resume, and notifications.' },
    ],
  },
  {
    key: 'proctoring',
    category: 'Proctoring and integrity',
    items: [
      { label: 'Live integrity score', description: 'A 0–100 fraud score with per-signal caps, auto-flagging at 60 and auto-terminating at 100.' },
      { label: 'Risk banding', description: 'Every interview lands in safe, low, medium, high, or critical.' },
      { label: 'Browser lock', description: 'Copy, cut, paste, right-click, selection, drag-drop, DevTools, view-source, PrintScreen, and zoom are blocked and logged.' },
      { label: 'Tab and window monitoring', description: 'Tab switches, focus loss, fullscreen exit, multi-monitor, and multi-tab setups are detected.' },
      { label: 'Webcam vision', description: 'Flags multiple faces, a missing face, and people entering or leaving frame.' },
      { label: 'Gaze and attention tracking', description: 'Head turns, looking away, and closed eyes, via MediaPipe face landmarks.' },
      { label: 'Passive liveness check', description: 'The first genuine blink marks the candidate as present and live, with no extra step for them.' },
      { label: 'Audio monitoring', description: 'High and background noise, long silences, and a muted or disconnected mic.' },
      { label: 'Input analytics', description: 'Abnormal typing speed, automated input, and idle detection.' },
      { label: 'Screenshot evidence', description: 'Captured automatically when a high-severity signal fires.' },
      { label: 'Device and network fingerprint', description: 'Recorded at the start of every interview.' },
      { label: 'Proctoring audit trail', description: 'Browse, drill into, and export the full signal history as CSV.' },
    ],
  },
  {
    key: 'reports',
    category: 'Reports and analytics',
    items: [
      { label: 'AI interview reports', description: 'Competency scores, strengths, gaps, and a hire recommendation.' },
      { label: 'Auditable scoring', description: 'The weightage used is snapshotted onto each report, so an old score stays explainable.' },
      { label: 'Report regeneration', description: 'Re-run evaluation against current prompts while the transcript stays immutable and notes are preserved.' },
      { label: 'Candidate ranking', description: 'Rank a role’s candidates side by side.' },
      { label: 'Exports', description: 'Branded PDF reports, Excel rankings, and CSV proctoring logs.' },
      { label: 'Recruiter notes on reports', description: 'Add context that survives regeneration.' },
      { label: 'Company overview', description: 'KPIs, hiring funnel, recent activity, and live usage against your limits.' },
      { label: 'Hiring analytics', description: 'Trends across your jobs, candidates, and interviews.' },
    ],
  },
  {
    key: 'recordings',
    category: 'Recordings',
    items: [
      { label: 'Full-length recording, up to 1080p', description: 'Requests 1080p at 30fps and falls back gracefully on webcams that refuse it.' },
      { label: 'Crash-resilient capture', description: 'Video streams to the server in chunks during the interview, so a crash does not lose it.' },
      { label: 'Recordings library', description: 'Browse, play inline, and download any interview.' },
    ],
  },
  {
    key: 'collaboration',
    category: 'Team and collaboration',
    items: [
      { label: 'Custom roles', description: 'Granular create/read/update/delete permissions across all 11 modules.' },
      { label: 'Staff management', description: 'Invite with a temporary password, then activate, deactivate, edit, or remove.' },
      { label: 'Login history and activity log', description: 'A company-scoped record of who did what, and when.' },
      { label: 'Real-time updates', description: 'Proctoring signals, interview state, and notifications push live over websockets.' },
      { label: 'Notification centre', description: 'In-app and email notifications in one place.' },
    ],
  },
  {
    key: 'knowledge',
    category: 'Knowledge base',
    items: [
      { label: 'Ground interviews in your own material', description: 'Upload files, add URLs, or paste text; content is auto-chunked and keyword-indexed.' },
      { label: 'Per-base toggle', description: 'Switch a knowledge base in or out without deleting it.' },
    ],
  },
  {
    key: 'email',
    category: 'Email',
    items: [
      { label: 'Send from your own domain', description: 'Custom SMTP with a test-connection action before you rely on it.' },
      { label: 'Gmail OAuth', description: 'Connect a Gmail account for outgoing mail.' },
      { label: 'Branded transactional templates', description: 'Candidate-facing mail carries your branding.' },
      { label: 'Email log with delivery tracking', description: 'Opens, clicks, and a retry action on anything that failed.' },
    ],
  },
  {
    key: 'security',
    category: 'Security',
    items: [
      { label: 'Two-factor authentication', description: 'TOTP setup, enable, and disable.' },
      { label: 'Google sign-in', description: 'Alongside email/password and one-time-code login.' },
      { label: 'Session invalidation', description: 'Log out every device at once; existing tokens stop working immediately.' },
      { label: 'Encrypted secrets at rest', description: 'Provider API keys are encrypted, never stored in the clear.' },
      { label: 'Tenant isolation', description: 'Every company route is scoped to your workspace and rate-limited at the auth edge.' },
      { label: 'Self-serve account deletion', description: 'Delete your workspace and its data on your own terms.' },
    ],
  },
  {
    key: 'billing',
    category: 'Billing',
    items: [
      { label: 'Three payment gateways', description: 'Cashfree, Razorpay, and Stripe, each with signature-verified webhooks.' },
      { label: 'Branded PDF invoices', description: 'Downloadable from your billing page.' },
      { label: 'Coupons', description: 'Percentage or fixed discounts with usage limits.' },
      { label: 'Free trial with no card', description: 'Start without entering payment details.' },
      { label: 'Self-serve plan changes', description: 'Upgrade, downgrade, or cancel, with usage shown against your limits.' },
    ],
  },
];

/** Derived so it can never drift from the list above. */
export const PLATFORM_FEATURE_COUNT = PLATFORM_FEATURES.reduce((n, c) => n + c.items.length, 0);

export default { PLATFORM_FEATURES, PLATFORM_FEATURE_COUNT };
