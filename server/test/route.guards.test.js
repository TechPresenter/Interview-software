import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PERMISSIONS, MODULE_KEYS, emptyPermissions } from '../src/constants/permissions.js';

/**
 * Every company route must state the permission it needs.
 *
 * The permission system was fully built — a module/action catalog, custom roles
 * a company_admin can author in the UI, `effectivePermissions()`, `can()`,
 * `requirePermission()` — and then almost nothing called it. 54 of 102 company
 * routes carried no guard, so authentication was the only real check: any
 * recruiter could delete a job, wipe a knowledge base, or rewrite the AI
 * interviewer's script. The role editor was decorative.
 *
 * A route with no guard fails open and looks exactly like a route that doesn't
 * need one, so this reads the router source and makes "I forgot" a test failure
 * rather than a privilege escalation. Anything genuinely public goes in
 * INTENTIONALLY_UNGATED, with a reason, as a deliberate act.
 */

const ROUTES_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/routes/company.routes.js',
);
const source = fs.readFileSync(ROUTES_FILE, 'utf8');

/** Routes that are open on purpose. Key is "METHOD path"; value is why. */
const INTENTIONALLY_UNGATED = {
  'GET /company/overview':
    "The dashboard landing page — a summary of the caller's own workspace. Every staff role must reach their own home screen.",
  'GET /company/me/permissions':
    'Returns the caller their OWN permission map. The client needs it to decide what to render; gating it behind a permission would be circular.',
};

/** [{ method, route, guards, key }] parsed from the router source. */
function parseRoutes() {
  const re = /router\.(get|post|patch|put|delete)\(\s*'([^']+)'([^;]*?)\);/gs;
  const out = [];
  for (const m of source.matchAll(re)) {
    const [, verb, route, rest] = m;
    const method = verb.toUpperCase();
    out.push({
      method,
      route,
      key: `${method} ${route}`,
      guards: [...rest.matchAll(/requirePermission\(\s*'(\w+)'\s*,\s*'(\w+)'\s*\)/g)].map((g) => ({
        module: g[1],
        action: g[2],
      })),
      hasRbac: /rbac\(/.test(rest),
    });
  }
  return out;
}

const routes = parseRoutes();

describe('company routes · guards', () => {
  it('parses the router (guard against a regex that silently matches nothing)', () => {
    expect(routes.length).toBeGreaterThan(90);
  });

  it('every route declares a permission or an explicit role check', () => {
    const naked = routes
      .filter((r) => !r.guards.length && !r.hasRbac)
      .filter((r) => !(r.key in INTENTIONALLY_UNGATED))
      .map((r) => r.key);

    expect(
      naked,
      `These routes have no requirePermission() and no rbac(). A route with no guard fails OPEN — ` +
        `any authenticated staff member reaches the controller regardless of their role. Add a guard, ` +
        `or add it to INTENTIONALLY_UNGATED in this file with a reason:\n  ${naked.join('\n  ')}`,
    ).toEqual([]);
  });

  it('names only real modules and actions', () => {
    const bad = [];
    for (const r of routes) {
      for (const g of r.guards) {
        if (!MODULE_KEYS.includes(g.module)) bad.push(`${r.key} → unknown module '${g.module}'`);
        if (!['create', 'read', 'update', 'delete'].includes(g.action)) {
          bad.push(`${r.key} → unknown action '${g.action}'`);
        }
      }
    }
    // A typo'd module is silently false for everyone except admins, which looks
    // like a working guard right up until it locks out the role it should allow.
    expect(bad, `guards referencing something that isn't in the catalog:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('keeps the ungated allowlist honest', () => {
    const stale = Object.keys(INTENTIONALLY_UNGATED).filter(
      (key) => !routes.some((r) => r.key === key && !r.guards.length && !r.hasRbac),
    );
    expect(stale, `allowlisted but no longer an ungated route — drop the entry: ${stale.join(', ')}`).toEqual([]);
  });

  it('gates destructive verbs on delete, never on read', () => {
    const wrong = routes
      .filter((r) => r.method === 'DELETE' && r.guards.length)
      .filter((r) => !r.guards.some((g) => g.action === 'delete'))
      .map((r) => `${r.key} → ${r.guards.map((g) => `${g.module}:${g.action}`).join(', ')}`);
    expect(wrong, `DELETE routes gated on something weaker than 'delete':\n  ${wrong.join('\n  ')}`).toEqual([]);
  });
});

/**
 * The regressions that were live, pinned as behaviour rather than as source
 * text. Each of these was reachable by a role the map says no to.
 */
describe('company routes · the specific holes that were open', () => {
  const guardFor = (key) => routes.find((r) => r.key === key)?.guards ?? [];
  const denies = (role, module, action) => DEFAULT_PERMISSIONS[role]?.[module]?.[action] === false;

  it.each([
    ['DELETE /jobs/:id', 'jobs', 'delete'],
    ['DELETE /candidates/:id', 'candidates', 'delete'],
    ['DELETE /knowledge-bases/:id', 'knowledge', 'delete'],
    ['POST /knowledge-bases', 'knowledge', 'create'],
    ['PATCH /knowledge-bases/:id', 'knowledge', 'update'],
    ['POST /knowledge-bases/:id/sources', 'knowledge', 'update'],
    ['POST /knowledge-bases/:id/toggle', 'knowledge', 'update'],
    ['PUT /company/ai-interviewer', 'settings', 'update'],
    ['POST /reports/:id/regenerate', 'reports', 'update'],
  ])('%s requires %s:%s', (key, module, action) => {
    expect(guardFor(key)).toContainEqual({ module, action });
  });

  it('those guards actually exclude recruiter and hr_manager', () => {
    // The point of the guard is that the map says no. If DEFAULT_PERMISSIONS is
    // ever widened, this fails and forces a fresh look rather than quietly
    // re-opening the hole.
    for (const role of ['recruiter', 'hr_manager']) {
      expect(denies(role, 'jobs', 'delete'), `${role} may now delete jobs`).toBe(true);
      expect(denies(role, 'candidates', 'delete'), `${role} may now delete candidates`).toBe(true);
      expect(denies(role, 'knowledge', 'create'), `${role} may now create knowledge bases`).toBe(true);
      expect(denies(role, 'knowledge', 'delete'), `${role} may now delete knowledge bases`).toBe(true);
      expect(denies(role, 'settings', 'update'), `${role} may now rewrite the AI interviewer`).toBe(true);
    }
  });

  it('a read-only custom role is denied every write', () => {
    // The Viewer template is the case the unguarded routes made a lie: read on
    // everything, write on nothing. It is what a company_admin builds when they
    // want a safe pair of eyes.
    const viewer = Object.fromEntries(
      MODULE_KEYS.map((k) => [k, { create: false, read: true, update: false, delete: false }]),
    );
    const writes = routes.filter((r) =>
      r.guards.some((g) => ['create', 'update', 'delete'].includes(g.action)),
    );
    expect(writes.length).toBeGreaterThan(20);
    for (const r of writes) {
      for (const g of r.guards.filter((x) => x.action !== 'read')) {
        expect({ ...emptyPermissions(), ...viewer }[g.module][g.action], `${r.key} would let a Viewer ${g.action} ${g.module}`).toBe(false);
      }
    }
  });
});
