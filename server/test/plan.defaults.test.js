import { describe, it, expect } from 'vitest';
import { Plan } from '../src/models/Plan.js';
import { PLATFORM_FEATURES, PLATFORM_FEATURE_COUNT } from '../src/constants/platformFeatures.js';
import { ENFORCED_BY_LIMIT_KEY } from '../src/services/limits.service.js';

/**
 * The product rule these tests defend: plans differ by usage limits alone, and
 * every capability ships to every plan. A tier's `features` array is therefore
 * quota copy, never a capability list — the moment a capability bullet lands on
 * one tier, the pricing page implies a gate that limits.service.js does not
 * enforce. That is the regression this file exists to catch.
 */

const tiers = Plan.defaults();
const bullets = tiers.flatMap((t) => t.features);
const labels = PLATFORM_FEATURES.flatMap((c) => c.items.map((i) => i.label));

const LIMIT_KEYS = ['seats', 'activeJobs', 'interviewsPerMonth', 'aiTokensPerMonth'];

/** '3 AI interviews (one-time)', '100 AI interviews / month', '20M AI tokens / month', 'Unlimited active jobs'. */
const QUOTA_BULLET = /^(\d[\d,]*[KMB]?|Unlimited)\s/;

/**
 * The only bullets allowed to not be a quota. Support responsiveness and
 * account management are human commitments, not platform capabilities, so they
 * remain a legitimate axis for tiers to differ on. Closed by design: adding to
 * this list should be a deliberate act, not a drive-by.
 */
const SERVICE_BULLETS = [
  'Every platform feature included',
  'Email support',
  'Priority support',
  'Dedicated account manager',
  'SLA & onboarding support',
];

/** Capabilities that were once sold per-tier but do not exist in the product at all. */
const PHANTOMS = ['sso', 'white label', 'ats', 'hrms', 'api access', 'weightage', 'webhook'];

describe('Plan.defaults · tiers differ by limits alone', () => {
  it('advertises no capability on any single tier', () => {
    for (const bullet of bullets) {
      const leaked = labels.find((l) => bullet.toLowerCase().includes(l.toLowerCase()));
      expect(leaked, `"${bullet}" names a platform capability. Capabilities ship to every plan and belong in PLATFORM_FEATURES, not on one tier.`).toBeUndefined();
    }
  });

  it('carries only quota bullets and service levels', () => {
    for (const bullet of bullets) {
      const isQuota = QUOTA_BULLET.test(bullet);
      const isService = SERVICE_BULLETS.includes(bullet);
      expect(isQuota || isService, `"${bullet}" is neither a quota nor a known service level. Tiers may only differ by usage limits.`).toBe(true);
    }
  });

  it('tells every tier it gets the whole platform', () => {
    for (const t of tiers) {
      expect(t.features, `${t.key} must state that every feature is included`).toContain('Every platform feature included');
    }
  });

  it('never resurrects a capability the product does not have', () => {
    for (const text of [...bullets, ...labels]) {
      const phantom = PHANTOMS.find((p) => text.toLowerCase().includes(p));
      expect(phantom, `"${text}" mentions "${phantom}", which is not implemented anywhere.`).toBeUndefined();
    }
  });

  // A tier may only sell a quota the code actually checks. This replaced a
  // blocklist of words: the real invariant is that every limit on the plan maps
  // to an assertWithinLimit branch, which is what makes the number a promise
  // rather than decoration.
  it('enforces every limit the tiers advertise', () => {
    for (const k of LIMIT_KEYS) {
      expect(
        ENFORCED_BY_LIMIT_KEY[k],
        `Plan.limits.${k} is sold on the pricing cards but has no assertWithinLimit branch.`,
      ).toBeTruthy();
    }
  });
});

describe('Plan.defaults · limits', () => {
  it('defines all four limits as numbers on every tier', () => {
    for (const t of tiers) {
      for (const k of LIMIT_KEYS) {
        expect(typeof t.limits[k], `${t.key}.limits.${k}`).toBe('number');
      }
    }
  });

  it('never shrinks a limit as the tier gets more expensive', () => {
    const ordered = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const k of LIMIT_KEYS) {
      for (let i = 1; i < ordered.length; i++) {
        expect(
          ordered[i].limits[k],
          `${ordered[i].key} offers less ${k} than ${ordered[i - 1].key}`,
        ).toBeGreaterThanOrEqual(ordered[i - 1].limits[k]);
      }
    }
  });

  it('covers each plan key exactly once, in a stable order', () => {
    expect(tiers.map((t) => t.key)).toEqual(['free', 'starter', 'professional', 'enterprise']);
    expect(tiers.map((t) => t.sortOrder)).toEqual([0, 1, 2, 3]);
  });
});

describe('PLATFORM_FEATURES · the catalog every plan gets', () => {
  it('lists no capability twice', () => {
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes, `duplicate labels: ${dupes.join(', ')}`).toEqual([]);
  });

  it('names each category once', () => {
    const cats = PLATFORM_FEATURES.map((c) => c.category);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('gives every entry a label and a description', () => {
    for (const c of PLATFORM_FEATURES) {
      expect(c.items.length, `${c.category} is empty`).toBeGreaterThan(0);
      for (const i of c.items) {
        expect(i.label?.trim(), `label in ${c.category}`).toBeTruthy();
        expect(i.description?.trim(), `description for "${i.label}"`).toBeTruthy();
      }
    }
  });

  it('derives its count rather than hardcoding one', () => {
    expect(PLATFORM_FEATURE_COUNT).toBe(labels.length);
  });
});
