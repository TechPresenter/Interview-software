import { PALETTE, FONT, button, escapeHtml, escapeAttr } from './components.js';

/**
 * Branded HTML email shell. Wraps a template body in a layout driven by the
 * platform Branding (logo, name, theme, footer, social, contact).
 *
 * Design constraints, in the order they matter:
 *
 *  - Layout is tables + inline styles. Gmail strips <head><style> in clipped and
 *    forwarded views, so the mail must be correct with the style block removed.
 *  - The <style> block therefore carries only progressive enhancement: the
 *    mobile @media rules and the prefers-color-scheme block, both keyed on the
 *    `em-*` classes that components.js attaches to its blocks.
 *  - Light is the baseline palette and dark an adaptation, not the reverse. A
 *    hard-coded dark shell reads as a broken slab beside every other message in
 *    a light-mode Gmail or Outlook list, and any client forcing a light
 *    background turns white headings invisible.
 *  - Outlook's Word engine drops linear-gradient and border-radius, so the
 *    header carries a solid `bgcolor` underneath its gradient — otherwise white
 *    logo text lands on a transparent background.
 */

/** Re-exported so template bodies (and any existing importer) keep one CTA implementation. */
export { button };

const D = PALETTE.dark;
const L = PALETTE.light;

/**
 * Gmail/Apple Mail honour a <style> block; these rules only ever improve on the
 * inline defaults.
 *
 * `hasDarkLogo` gates the logo-swap rules. They used to be emitted always, but
 * headerMark only renders the .em-logo-dark node when a dark variant exists —
 * so for the common light-logo-only case, dark mode hid the logo and had
 * nothing to show in its place, and the header lost its branding entirely.
 */
function styleBlock(primary, hasDarkLogo) {
  const logoSwap = hasDarkLogo
    ? `
  .em-logo-light{display:none !important;}
  .em-logo-dark{display:block !important;max-height:none !important;overflow:visible !important;}`
    : '';
  return `
:root{color-scheme:light dark;supported-color-schemes:light dark;}
.em-btn{background:${primary} !important;}
a{color:${primary};}
@media only screen and (max-width:620px){
  .em-wrap{width:100% !important;}
  .em-pad{padding-left:20px !important;padding-right:20px !important;}
  .em-pad-card{padding:14px 16px !important;}
  .em-h{font-size:20px !important;}
  .em-btn{display:block !important;text-align:center !important;}
  .em-stack{display:block !important;width:100% !important;padding:2px 0 !important;}
  .em-lbl.em-stack{padding-top:8px !important;}
}
@media (prefers-color-scheme:dark){
  .em-page,.em-page-bg{background:${D.page} !important;}
  .em-card,.em-panel{background:${D.panel} !important;border-color:${D.border} !important;}
  .em-shell{background:${D.card} !important;border-color:${D.border} !important;}
  .em-h,.em-code{color:${D.heading} !important;}
  .em-t,.em-val{color:${D.text} !important;}
  .em-m,.em-lbl{color:${D.muted} !important;}
  .em-f,.em-f a{color:${D.footer} !important;}
  .em-hr{background:${D.border} !important;}
  .em-note{background:${D.noteBg} !important;border-color:${D.noteBorder} !important;}
  .em-note-t{color:${D.noteText} !important;}${logoSwap}
}`.trim();
}

/** Absolute URLs pass through; a relative Branding path resolves against the API origin. */
function absolute(url, assetBase) {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${assetBase}${url}`;
}

/**
 * Text links, never icons. Remote images are blocked by default in Outlook and
 * by many Gmail users, so an icon-only row would render as five broken squares —
 * nothing in the footer may depend on an image to carry its meaning.
 */
function socialRow(social = {}) {
  const links = [
    ['LinkedIn', social.linkedin],
    ['X', social.x],
    ['Facebook', social.facebook],
    ['Instagram', social.instagram],
    ['YouTube', social.youtube],
    ['WhatsApp', social.whatsapp],
    ['Telegram', social.telegram],
  ].filter(([, url]) => url);
  if (!links.length) return '';
  return (
    `<p class="em-f" style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.footer};">` +
    links
      .map(
        ([label, url]) =>
          `<a href="${escapeAttr(url)}" style="color:${L.footer};text-decoration:underline;">${label}</a>`,
      )
      .join('<span style="color:#c3c8d0;"> &nbsp;·&nbsp; </span>') +
    `</p>`
  );
}

/** Contact details as real mailto:/tel: links so a phone can act on them. */
function contactRow(contact = {}) {
  const parts = [];
  if (contact.email)
    parts.push(
      `<a href="mailto:${escapeAttr(contact.email)}" style="color:${L.footer};text-decoration:underline;">${escapeHtml(contact.email)}</a>`,
    );
  if (contact.phone)
    parts.push(
      `<a href="tel:${escapeAttr(String(contact.phone).replace(/[^\d+]/g, ''))}" style="color:${L.footer};text-decoration:underline;">${escapeHtml(contact.phone)}</a>`,
    );
  if (!parts.length) return '';
  return `<p class="em-f" style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.footer};">${parts.join('<span style="color:#c3c8d0;"> &nbsp;·&nbsp; </span>')}</p>`;
}

function headerMark(branding, assetBase, name) {
  const logo = absolute(branding.logoUrl, assetBase);
  if (!logo) {
    return `<span style="font-family:${FONT};font-size:22px;line-height:1.2;font-weight:700;color:#ffffff;">${escapeHtml(name)}</span>`;
  }
  const dark = absolute(branding.logoDarkUrl, assetBase);
  const light = `<img class="em-logo-light" src="${escapeAttr(logo)}" alt="${escapeAttr(name)}" height="36" style="height:36px;display:block;border:0;outline:none;text-decoration:none;" />`;
  if (!dark) return light;
  // The dark variant is collapsed rather than display:none — Gmail keeps the node
  // laid out, so max-height/overflow are what actually hide it until the media query.
  return (
    light +
    `<div class="em-logo-dark" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">` +
    `<img src="${escapeAttr(dark)}" alt="${escapeAttr(name)}" height="36" style="height:36px;display:block;border:0;outline:none;text-decoration:none;" />` +
    `</div>`
  );
}

/**
 * @param {object} o
 * @param {object} o.branding   Branding doc (platformName, logoUrl, logoDarkUrl, footerText, theme, social, contact)
 * @param {string} o.subject
 * @param {string} o.bodyHtml   inner content (already interpolated)
 * @param {string} [o.preheader]
 * @param {string} [o.assetBase] absolute origin to resolve a relative logoUrl
 * @param {string} [o.trackingPixel] absolute URL of the open-tracking pixel
 * @param {string} [o.unsubscribeUrl] renders the footer unsubscribe line; marketing mail only
 * @returns {string} full HTML document
 */
export function renderBranded({
  branding = {},
  subject = '',
  bodyHtml = '',
  preheader = '',
  assetBase = '',
  trackingPixel = '',
  unsubscribeUrl = '',
} = {}) {
  const name = branding.platformName || 'AIPL Hire';
  const primary = branding.theme?.primary || '#7c5cff';
  const accent = branding.theme?.accent || '#22d3ee';
  const year = new Date().getFullYear();
  const footer = (branding.footerText || `© {year} ${name}. All rights reserved.`).replace('{year}', String(year));
  const contact = branding.contact || {};

  // Gmail shows the preview line, then keeps reading into the body — the padding
  // characters stop it from trailing the first heading after the preheader.
  const pad = '&#847;&zwnj;&nbsp;&#8199;&#65279;'.repeat(8);

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>${styleBlock(primary, Boolean(absolute(branding.logoDarkUrl, assetBase)))}</style>
</head>
<body class="em-page" style="margin:0;padding:0;width:100%;background:${L.page};font-family:${FONT};color:${L.text};-webkit-font-smoothing:antialiased;">
<div class="em-m" style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${pad}</div>
<table role="presentation" class="em-page-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${L.page};">
  <tr><td align="center" style="padding:28px 12px;">
    <!--[if mso | IE]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="em-wrap em-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${L.card};border:1px solid ${L.border};border-radius:14px;">
      <tr><td bgcolor="${escapeAttr(primary)}" class="em-pad" style="background:${primary};background-image:linear-gradient(135deg,${primary},${accent});padding:24px 28px;border-radius:14px 14px 0 0;">${headerMark(branding, assetBase, name)}</td></tr>
      <tr><td class="em-pad em-t" style="padding:32px 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${L.text};">${bodyHtml}</td></tr>
      <tr><td class="em-hr" style="height:1px;line-height:1px;font-size:0;background:${L.border};">&nbsp;</td></tr>
      <tr><td class="em-pad em-f" align="center" style="padding:22px 28px 26px;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.footer};text-align:center;">
        ${contact.email ? `<p class="em-f" style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.footer};">Need help? Email <a href="mailto:${escapeAttr(contact.email)}" style="color:${L.footer};text-decoration:underline;">${escapeHtml(contact.email)}</a> and a human will reply.</p>` : ''}
        <p class="em-f" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.footer};">${escapeHtml(footer)}</p>
        ${contact.address ? `<p class="em-f" style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.footer};">${escapeHtml(contact.address)}</p>` : ''}
        ${contactRow(contact)}
        ${socialRow(branding.social)}
        <p class="em-f" style="margin:14px 0 0;font-family:${FONT};font-size:11px;line-height:1.6;color:${L.footer};">You are receiving this message because you have an account with ${escapeHtml(name)} or asked us to contact you. This email may contain confidential information — if it reached you by mistake, please delete it.</p>
        ${unsubscribeUrl ? `<p class="em-f" style="margin:8px 0 0;font-family:${FONT};font-size:11px;line-height:1.6;color:${L.footer};"><a href="${escapeAttr(unsubscribeUrl)}" style="color:${L.footer};text-decoration:underline;">Unsubscribe</a> from these emails.</p>` : ''}
      </td></tr>
    </table>
    <!--[if mso | IE]></td></tr></table><![endif]-->
  </td></tr>
</table>
${trackingPixel ? `<img src="${escapeAttr(trackingPixel)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" />` : ''}
</body></html>`;
}

export default { renderBranded, button };
