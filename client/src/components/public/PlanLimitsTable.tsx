import { number } from '@/lib/format';
import { ComparisonTable, type Cell } from '@/components/public/ComparisonTable';

export interface PlanLimits {
  seats?: number;
  activeJobs?: number;
  interviewsPerMonth?: number;
  aiTokensPerMonth?: number;
}

/** A plan as served by GET /content/plans. */
export interface PublicPlan {
  _id: string;
  key: string;
  name: string;
  description?: string;
  pricing: { monthly: number; yearly: number; currency: string };
  limits?: PlanLimits;
  features?: string[];
  isPopular?: boolean;
  sortOrder?: number;
}

/**
 * Plan.js encodes "unlimited" as a very high number rather than null, so any
 * limit at or above this is presented as unlimited rather than as a literal.
 */
const UNLIMITED_FROM = 999_999;

/** Tokens have their own sentinel — a real monthly allowance already exceeds 999,999. */
const UNLIMITED_TOKENS_FROM = 1_000_000_000;

const isUnlimited = (n: number) => n >= UNLIMITED_FROM;

type LimitRow = { label: string; cell: (plan: PublicPlan) => Cell };

/** 2_000_000 → '2M'. Raw token counts are unreadable at a glance. */
function compact(n: number) {
  if (n >= 1_000_000_000) return `${n / 1_000_000_000}B`;
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

/**
 * Only limits that limits.service.js `assertWithinLimit` actually checks are
 * published — all four now are. Storage has no row because nothing meters it:
 * advertising a cap the product does not enforce is a promise in the wrong
 * direction. Add the row when the check exists, not before.
 */
const LIMIT_ROWS: LimitRow[] = [
  {
    label: 'AI interviews',
    cell: (p) => {
      const n = p.limits?.interviewsPerMonth;
      if (n == null) return '—';
      if (isUnlimited(n)) return 'Unlimited';
      // The Free allowance is all-time, not monthly: limits.service.js counts
      // usage.interviewsTotal when company.plan === 'free', and nothing resets it.
      return p.key === 'free' ? `${number(n)} total (one-time)` : `${number(n)} / month`;
    },
  },
  {
    // Drafts count against this limit alongside open and paused jobs, so the bare
    // word "active" would overstate what a workspace can hold.
    label: 'Active jobs (open, paused, or draft)',
    cell: (p) => {
      const n = p.limits?.activeJobs;
      if (n == null) return '—';
      return isUnlimited(n) ? 'Unlimited' : number(n);
    },
  },
  {
    // Staff only — candidates are not workspace members and never occupy a seat.
    label: 'Team members',
    cell: (p) => {
      const n = p.limits?.seats;
      if (n == null) return '—';
      return isUnlimited(n) ? 'Unlimited' : number(n);
    },
  },
  {
    label: 'AI usage / month',
    cell: (p) => {
      const n = p.limits?.aiTokensPerMonth;
      if (n == null) return '—';
      // NOT isUnlimited(): token allowances are legitimately in the millions, so
      // the 999,999 sentinel used for seats and jobs would read every paid tier
      // as unlimited. Only Enterprise's 1e9 means unlimited here.
      return n >= UNLIMITED_TOKENS_FROM ? 'Unlimited' : `${compact(n)} tokens`;
    },
  },
];

/**
 * The usage limits that separate one plan from another — the only axis on which
 * plans differ. Reads straight from each plan's enforced `limits` so the page
 * cannot drift from what the server actually applies.
 */
export function PlanLimitsTable({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) return null;
  const popular = plans.findIndex((p) => p.isPopular);

  return (
    <ComparisonTable
      firstColLabel="Usage limit"
      columns={plans.map((p) => p.name)}
      rows={LIMIT_ROWS.map((r) => ({ label: r.label, values: plans.map(r.cell) }))}
      highlightCol={popular >= 0 ? popular : undefined}
    />
  );
}

export default PlanLimitsTable;
