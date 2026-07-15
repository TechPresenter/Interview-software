/**
 * Reusable inline-styled blocks for email bodies. Every block returns an HTML
 * string, so a template body is just a concatenation of these.
 *
 * Two constraints shape everything in this file:
 *
 *  - Inline styles have to carry the design on their own. Gmail drops
 *    <head><style> in clipped and forwarded views, so each block must look
 *    right with zero external CSS. The shell's <style> block only *enhances*
 *    (dark mode, mobile stacking) via the `em-*` classes attached here.
 *  - Blocks are evaluated once at module load — templates.js concatenates them
 *    into static strings — so nothing here can read per-send branding. Anything
 *    tenant-specific must arrive as a {{placeholder}} or be applied by the shell.
 *
 * Text arguments are treated as trusted author HTML (templates pass <strong>,
 * entities and {{placeholders}} through them). Values that originate from users
 * arrive later, via interpolate(), and are NOT escaped by this layer — see the
 * note on credentialsCard.
 */

/** Declared on every text-bearing element: Outlook falls back to Times New Roman wherever it is missing. */
export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
export const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

/**
 * Light is the baseline and dark the adaptation, never the reverse: a hard-coded
 * dark shell reads as a dark slab beside every other message in a Gmail or
 * Outlook light-mode list, and any client forcing a light background turns white
 * headings invisible.
 *
 * `dark` is applied by layout.js through a prefers-color-scheme block keyed on
 * the same `em-*` classes these blocks carry, so the two halves cannot drift.
 */
export const PALETTE = {
  light: {
    page: '#f4f5f7',
    card: '#ffffff',
    panel: '#f7f8fa',
    border: '#e4e6eb',
    heading: '#16181d',
    text: '#3c4149',
    muted: '#6b7280',
    footer: '#767d88',
    noteBg: '#fff8e6',
    noteBorder: '#f0d089',
    noteText: '#6b4e12',
  },
  dark: {
    page: '#0f1115',
    card: '#171a21',
    panel: '#1d2029',
    border: '#2a2f3a',
    heading: '#f5f6f8',
    text: '#c9ced8',
    muted: '#8b93a1',
    footer: '#767e8c',
    noteBg: '#2a2313',
    noteBorder: '#5c4a1e',
    noteText: '#e8d9a8',
  },
};

const L = PALETTE.light;

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

export const escapeAttr = escapeHtml;

/** Section heading. */
export const h = (t) =>
  `<h1 class="em-h" style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${L.heading};">${t}</h1>`;

/** Body paragraph. */
export const p = (t) =>
  `<p class="em-t" style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${L.text};">${t}</p>`;

/** Secondary/footnote text. */
export const muted = (t) =>
  `<p class="em-m" style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${L.muted};">${t}</p>`;

/** Horizontal rule. */
export const divider = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr><td class="em-hr" style="height:1px;line-height:1px;font-size:0;background:${L.border};">&nbsp;</td></tr></table>`;

/** Label/value rows. `em-stack` lets the shell stack them on narrow screens. */
function rows(pairs) {
  return pairs
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td class="em-lbl em-stack" style="padding:7px 12px 7px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${L.muted};width:38%;vertical-align:top;">${k}</td>` +
        `<td class="em-val em-stack" style="padding:7px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${L.text};font-weight:600;vertical-align:top;">${v}</td>` +
        `</tr>`,
    )
    .join('');
}

/**
 * Bare label/value table — the unboxed variant of infoCard. Exported because
 * stored admin overrides embed this markup shape, having been copied out of a
 * default body before they were edited.
 */
export const details = (pairs) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:8px 0 14px;border-collapse:collapse;">${rows(pairs)}</table>`;

/**
 * Boxed label/value block with an optional title.
 * @param {string} title
 * @param {Array<[string,string]>} pairs
 */
export function infoCard(title, pairs = []) {
  const heading = title
    ? `<tr><td class="em-lbl" style="padding:0 0 10px;font-family:${FONT};font-size:11px;line-height:1.4;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:${L.muted};">${title}</td></tr>`
    : '';
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-card em-panel" style="width:100%;margin:18px 0;border-collapse:separate;background:${L.panel};border:1px solid ${L.border};border-radius:10px;">` +
    `<tr><td class="em-pad-card" style="padding:18px 20px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${heading}` +
    `<tr><td colspan="2" style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${rows(pairs)}</table></td></tr>` +
    `</table></td></tr></table>`
  );
}

/**
 * Login credentials with a mandatory security note.
 *
 * The values arrive as {{placeholders}} and template.service.interpolate() does
 * NOT escape, so a generated password containing < or " would break out of the
 * markup. Escaping has to happen where the value is produced — see the
 * call-site notes for the company-registration and staff-invite flows.
 *
 * @param {Array<[string,string]>} pairs
 */
export function credentialsCard(pairs = []) {
  const lines = pairs
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td class="em-lbl em-stack" style="padding:7px 12px 7px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${L.muted};width:38%;vertical-align:top;">${k}</td>` +
        `<td class="em-code em-stack" style="padding:7px 0;font-family:${MONO};font-size:14px;line-height:1.5;color:${L.heading};font-weight:700;word-break:break-all;vertical-align:top;">${v}</td>` +
        `</tr>`,
    )
    .join('');
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-card em-panel" style="width:100%;margin:18px 0;border-collapse:separate;background:${L.panel};border:1px solid ${L.border};border-radius:10px;">` +
    `<tr><td class="em-pad-card" style="padding:18px 20px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${lines}</table>` +
    `</td></tr></table>` +
    securityNotice('For your security, change this password straight after your first sign-in and never share it — we will never ask you for it.')
  );
}

/** Tinted warning block for anything credential- or account-security related. */
export function securityNotice(text) {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-note" style="width:100%;margin:18px 0;border-collapse:separate;background:${L.noteBg};border:1px solid ${L.noteBorder};border-radius:10px;">` +
    `<tr><td class="em-note-t" style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:1.55;color:${L.noteText};">` +
    `<strong>Security notice —</strong> ${text}</td></tr></table>`
  );
}

/** One-time code, spaced for legibility and safe to read aloud. */
export function otpCode(code) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;border-collapse:separate;">` +
    `<tr><td class="em-panel em-code" style="padding:16px 26px;background:${L.panel};border:1px solid ${L.border};border-radius:10px;font-family:${MONO};font-size:30px;line-height:1.2;font-weight:700;letter-spacing:8px;color:${L.heading};">${code}</td></tr>` +
    `</table>`
  );
}

/** Bulleted list. Table-based: Outlook's list indentation is unreliable. */
export function list(items = []) {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:4px 0 16px;border-collapse:collapse;">` +
    items
      .map(
        (item) =>
          `<tr>` +
          `<td width="18" style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${L.muted};vertical-align:top;" class="em-m">&bull;</td>` +
          `<td class="em-t" style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${L.text};">${item}</td>` +
          `</tr>`,
      )
      .join('') +
    `</table>`
  );
}

/**
 * Inline status chip. Tones are deliberately fixed rather than mode-aware: the
 * soft tints stay legible on both card backgrounds, and every extra class costs
 * bytes against Gmail's ~102KB clipping threshold.
 */
const TONES = {
  neutral: ['#eef0f3', '#4b5563'],
  info: ['#e8f1fe', '#1c4f9c'],
  success: ['#e7f6ed', '#1b7a3f'],
  warning: ['#fdf1dd', '#8a5a10'],
  danger: ['#fdeaea', '#a32020'],
};

export function statusPill(text, tone = 'neutral') {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  return `<span style="display:inline-block;padding:4px 11px;background:${bg};color:${fg};border-radius:999px;font-family:${FONT};font-size:12px;line-height:1.4;font-weight:700;">${text}</span>`;
}

/**
 * Bulletproof CTA. Outlook's Word engine ignores border-radius and padding on an
 * anchor, so it gets a VML roundrect instead; every other client gets the <a>.
 *
 * VML cannot size itself to its content, hence the width estimate from the label
 * length. The colour is the Branding default: bodies are static strings built at
 * import time and cannot see the tenant's theme, so the shell re-colours `.em-btn`
 * from branding.theme.primary via its <style> block. Outlook keeps this default —
 * it honours neither the class nor the gradient.
 */
export function button(url, label, color = '#7c5cff') {
  const width = Math.max(168, String(label).length * 9 + 54);
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border-collapse:separate;"><tr><td>` +
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeAttr(url)}" style="height:46px;v-text-anchor:middle;width:${width}px;" arcsize="22%" stroke="f" fillcolor="${color}"><w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->` +
    `<!--[if !mso]><!-- -->` +
    `<a class="em-btn" href="${escapeAttr(url)}" style="display:inline-block;background:${color};color:#ffffff;font-family:${FONT};font-size:15px;line-height:1;font-weight:700;text-decoration:none;padding:15px 30px;border-radius:10px;mso-hide:all;">${label}</a>` +
    `<!--<![endif]-->` +
    `</td></tr></table>`
  );
}

export default {
  FONT,
  MONO,
  PALETTE,
  escapeHtml,
  escapeAttr,
  h,
  p,
  muted,
  divider,
  details,
  infoCard,
  credentialsCard,
  securityNotice,
  otpCode,
  list,
  statusPill,
  button,
};
