import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS } from '../src/services/email/templates.js';
import { renderBranded, button } from '../src/services/email/layout.js';
import { interpolate } from '../src/services/template.service.js';

const entries = Object.entries(DEFAULT_TEMPLATES);

/** Every {{placeholder}} in a string, matching template.service's own regex. */
function placeholders(str) {
  const found = new Set();
  String(str || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => found.add(key));
  return found;
}

/** Everything a send interpolates against: subject, body, and the preview line. */
function usedVars(tpl) {
  return new Set([...placeholders(tpl.subject), ...placeholders(tpl.html), ...placeholders(tpl.preheader)]);
}

describe('email templates · catalogue', () => {
  it('exposes keys matching the catalogue', () => {
    expect(TEMPLATE_KEYS).toEqual(Object.keys(DEFAULT_TEMPLATES));
    expect(TEMPLATE_KEYS.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s has the required shape', (_key, tpl) => {
    expect(tpl.name).toBeTruthy();
    expect(tpl.category).toBeTruthy();
    expect(tpl.subject).toBeTruthy();
    expect(tpl.html).toBeTruthy();
    expect(tpl.preheader).toBeTruthy();
    expect(Array.isArray(tpl.variables)).toBe(true);
  });

  it.each(entries)('%s declares no duplicate variables', (_key, tpl) => {
    expect(new Set(tpl.variables).size).toBe(tpl.variables.length);
  });
});

/**
 * The render-blank class of bug: a placeholder nobody declares never reaches the
 * admin variable chips or SAMPLE, and a declared variable nobody renders means
 * the call site is passing data into a void.
 */
describe('email templates · variable contract', () => {
  it.each(entries)('%s declares every placeholder it renders', (_key, tpl) => {
    const declared = new Set(tpl.variables);
    const undeclared = [...usedVars(tpl)].filter((v) => !declared.has(v));
    expect(undeclared).toEqual([]);
  });

  it.each(entries)('%s renders every variable it declares', (_key, tpl) => {
    const used = usedVars(tpl);
    const unused = tpl.variables.filter((v) => !used.has(v));
    expect(unused).toEqual([]);
  });
});

describe('email templates · interpolation', () => {
  it.each(entries)('%s leaves no placeholder behind once every variable is supplied', (_key, tpl) => {
    const vars = Object.fromEntries(tpl.variables.map((v) => [v, `val-${v}`]));
    const rendered = interpolate(tpl.subject, vars) + interpolate(tpl.html, vars) + interpolate(tpl.preheader, vars);
    expect(rendered).not.toMatch(/\{\{/);
  });

  it('credential-bearing templates carry a security notice', () => {
    for (const key of ['company_registration', 'login_otp', 'password_reset', 'password_changed', 'staff_invite']) {
      expect(DEFAULT_TEMPLATES[key].html).toContain('Security notice');
    }
  });

  it('keeps the keys other modules reference by name', () => {
    // These are hard-coded at call sites (pipeline STAGE_EMAIL, email.service's
    // `emails` helpers, payment, reminders) — renaming one silently stops an email.
    for (const key of [
      'account_verification', 'welcome', 'password_reset', 'login_otp',
      'interview_invite', 'interview_completed', 'application_confirmation',
      'candidate_shortlisted', 'candidate_selected', 'candidate_rejected',
      'subscription_confirmation', 'payment_receipt', 'trial_expiry',
      'renewal_reminder', 'system_notification', 'contact_ack',
      'newsletter_welcome', 'demo_ack',
    ]) {
      expect(DEFAULT_TEMPLATES[key]).toBeDefined();
    }
  });
});

describe('email layout · renderBranded', () => {
  const branding = {
    platformName: 'Acme Hire',
    logoUrl: '/uploads/logo.png',
    theme: { primary: '#ff0000', accent: '#00ff00' },
    contact: { email: 'help@acme.test', phone: '+91 98765 43210', address: '1 Test Road, Bengaluru' },
    social: { linkedin: 'https://linkedin.com/acme', telegram: 'https://t.me/acme' },
  };

  it('produces a full document', () => {
    const html = renderBranded({ branding, subject: 'Hello', bodyHtml: '<p>Body</p>' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
    expect(html).toContain('<p>Body</p>');
  });

  it('includes the preheader, hidden', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '', preheader: 'Peek at this' });
    expect(html).toContain('Peek at this');
    expect(html).toMatch(/display:none;[^"]*max-height:0[^"]*">Peek at this/);
  });

  it('escapes a hostile subject', () => {
    const html = renderBranded({ branding, subject: '</title><script>alert(1)</script>', bodyHtml: '' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes hostile branding values', () => {
    const html = renderBranded({
      branding: { ...branding, platformName: '"><script>x</script>' },
      subject: 'S',
      bodyHtml: '',
    });
    expect(html).not.toContain('<script>x</script>');
  });

  it('works with an empty branding object', () => {
    const html = renderBranded({ subject: 'S', bodyHtml: '<p>Hi</p>' });
    expect(html).toContain('AIPL Hire');
    expect(html).toContain('<p>Hi</p>');
    expect(html).not.toContain('undefined');
  });

  it('works with no arguments at all', () => {
    expect(() => renderBranded()).not.toThrow();
  });

  it('falls back to the platform name when there is no logo', () => {
    const html = renderBranded({ branding: { platformName: 'Textual' }, subject: 'S', bodyHtml: '' });
    expect(html).toContain('>Textual</span>');
    expect(html).not.toContain('<img class="em-logo-light"');
  });

  it('resolves a relative logo against assetBase and leaves absolute URLs alone', () => {
    const rel = renderBranded({ branding, subject: 'S', bodyHtml: '', assetBase: 'https://cdn.test' });
    expect(rel).toContain('src="https://cdn.test/uploads/logo.png"');

    const abs = renderBranded({
      branding: { ...branding, logoUrl: 'https://img.test/l.png' },
      subject: 'S',
      bodyHtml: '',
      assetBase: 'https://cdn.test',
    });
    expect(abs).toContain('src="https://img.test/l.png"');
  });

  it('swaps in the dark logo only when one is configured', () => {
    // Match the element, not the class: the <style> block always defines the rule.
    expect(renderBranded({ branding, subject: 'S', bodyHtml: '' })).not.toContain('class="em-logo-dark"');
    const both = renderBranded({
      branding: { ...branding, logoDarkUrl: '/uploads/logo-dark.png' },
      subject: 'S',
      bodyHtml: '',
      assetBase: 'https://cdn.test',
    });
    expect(both).toContain('class="em-logo-dark"');
    expect(both).toContain('https://cdn.test/uploads/logo-dark.png');
  });

  it('defaults to a light palette and adapts to dark', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '' });
    expect(html).toContain('background:#f4f5f7');
    expect(html).toContain('@media (prefers-color-scheme:dark)');
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('name="supported-color-schemes" content="light dark"');
  });

  it('carries the Outlook conditional wrapper and a solid header colour behind the gradient', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '' });
    expect(html).toContain('<!--[if mso | IE]>');
    expect(html).toContain('bgcolor="#ff0000"');
    expect(html).toContain('linear-gradient(135deg,#ff0000,#00ff00)');
  });

  it('re-colours the CTA from the tenant theme', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: button('https://x.test', 'Go') });
    expect(html).toContain('.em-btn{background:#ff0000 !important;}');
  });

  it('is responsive', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '' });
    expect(html).toContain('@media only screen and (max-width:620px)');
    expect(html).toContain('name="viewport"');
  });

  it('renders contact details as actionable links', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '' });
    expect(html).toContain('mailto:help@acme.test');
    expect(html).toContain('href="tel:+919876543210"');
    expect(html).toContain('1 Test Road, Bengaluru');
  });

  it('renders social links as text, including the networks the old shell dropped', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '' });
    expect(html).toContain('>LinkedIn</a>');
    expect(html).toContain('>Telegram</a>');
  });

  it('carries a legal line and the current year', () => {
    const html = renderBranded({ branding, subject: 'S', bodyHtml: '' });
    expect(html).toContain('You are receiving this message because');
    expect(html).toContain(String(new Date().getFullYear()));
  });

  it('shows the unsubscribe line only for marketing sends', () => {
    expect(renderBranded({ branding, subject: 'S', bodyHtml: '' })).not.toContain('>Unsubscribe</a>');
    const marketing = renderBranded({ branding, subject: 'S', bodyHtml: '', unsubscribeUrl: 'https://x.test/u/1' });
    expect(marketing).toContain('href="https://x.test/u/1"');
    expect(marketing).toContain('>Unsubscribe</a>');
  });

  it('keeps the tracking pixel behaviour', () => {
    expect(renderBranded({ branding, subject: 'S', bodyHtml: '' })).not.toContain('width="1" height="1"');
    const tracked = renderBranded({ branding, subject: 'S', bodyHtml: '', trackingPixel: 'https://api.test/track/open/1' });
    expect(tracked).toContain('src="https://api.test/track/open/1" width="1" height="1"');
  });

  it('stays clear of Gmail\'s ~102KB clipping threshold for a typical send', () => {
    const html = renderBranded({
      branding,
      subject: 'S',
      bodyHtml: DEFAULT_TEMPLATES.company_registration.html,
      preheader: 'p',
    });
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(102 * 1024);
  });
});

describe('email layout · button', () => {
  it('gives Outlook a VML fallback and everyone else an anchor', () => {
    const html = button('https://x.test/go', 'Start interview');
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('v:roundrect');
    expect(html).toContain('<!--[if !mso]><!-- -->');
    expect(html).toContain('href="https://x.test/go"');
  });

  it('escapes the URL', () => {
    expect(button('https://x.test/"><script>', 'Go')).not.toContain('"><script>');
  });
});

/**
 * The admin preview is only trustworthy if every declared variable has a sample.
 * A missing one renders blank exactly where the admin is trying to check copy.
 */
describe('email · admin preview samples', () => {
  it('SAMPLE covers every variable declared by every template', async () => {
    const { SAMPLE } = await import('../src/controllers/admin/email.controller.js');
    const missing = [];
    for (const [key, tpl] of Object.entries(DEFAULT_TEMPLATES)) {
      for (const v of tpl.variables || []) {
        if (!(v in SAMPLE)) missing.push(`${key} -> ${v}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
