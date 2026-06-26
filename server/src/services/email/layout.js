/**
 * Branded, responsive HTML email shell. Wraps a template body in a professional
 * layout driven by the platform Branding (logo, name, colors, footer, social,
 * contact). Table-based + inline styles for broad email-client support.
 */

const escapeAttr = (s) => String(s || '').replace(/"/g, '&quot;');

function socialRow(social = {}) {
  const links = [
    ['LinkedIn', social.linkedin],
    ['X', social.x],
    ['Facebook', social.facebook],
    ['Instagram', social.instagram],
    ['YouTube', social.youtube],
  ].filter(([, url]) => url);
  if (!links.length) return '';
  return `<p style="margin:8px 0 0;font-size:12px;">${links
    .map(([label, url]) => `<a href="${escapeAttr(url)}" style="color:#8b8b9a;text-decoration:none;margin:0 6px;">${label}</a>`)
    .join('·')}</p>`;
}

/**
 * @param {object} o
 * @param {object} o.branding   Branding doc (platformName, logoUrl, footerText, theme, social, contact)
 * @param {string} o.subject
 * @param {string} o.bodyHtml   inner content (already interpolated)
 * @param {string} [o.preheader]
 * @param {string} [o.assetBase] absolute origin to resolve a relative logoUrl
 * @param {string} [o.trackingPixel] absolute URL of the open-tracking pixel
 * @returns {string} full HTML document
 */
export function renderBranded({ branding = {}, subject = '', bodyHtml = '', preheader = '', assetBase = '', trackingPixel = '' }) {
  const name = branding.platformName || 'HireSense';
  const primary = branding.theme?.primary || '#7c5cff';
  const accent = branding.theme?.accent || '#22d3ee';
  const year = new Date().getFullYear();
  const footer = (branding.footerText || `© {year} ${name}. All rights reserved.`).replace('{year}', String(year));
  const logo = branding.logoUrl
    ? (/^https?:\/\//.test(branding.logoUrl) ? branding.logoUrl : `${assetBase}${branding.logoUrl}`)
    : '';
  const contact = branding.contact || {};
  const contactLine = [contact.email, contact.phone, contact.address].filter(Boolean).join(' · ');

  const header = logo
    ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(name)}" height="40" style="height:40px;display:block;border:0;" />`
    : `<span style="font-size:22px;font-weight:700;color:#ffffff;">${name}</span>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeAttr(subject)}</title></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e8e8ef;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeAttr(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f14;padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#17171f;border-radius:16px;overflow:hidden;border:1px solid #26263200;">
      <tr><td style="background:linear-gradient(135deg,${primary},${accent});padding:24px 28px;">${header}</td></tr>
      <tr><td style="padding:32px 28px;font-size:15px;line-height:1.6;color:#d7d7e0;">${bodyHtml}</td></tr>
      <tr><td style="padding:20px 28px;border-top:1px solid #262632;text-align:center;color:#8b8b9a;font-size:12px;">
        <p style="margin:0;">${footer}</p>
        ${contactLine ? `<p style="margin:6px 0 0;">${contactLine}</p>` : ''}
        ${socialRow(branding.social)}
      </td></tr>
    </table>
    <p style="color:#55555f;font-size:11px;margin:16px 0 0;">Sent by ${name}</p>
  </td></tr>
</table>
${trackingPixel ? `<img src="${escapeAttr(trackingPixel)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" />` : ''}
</body></html>`;
}

/** Reusable CTA button (inline-styled) for use inside template bodies. */
export function button(url, label, color = '#7c5cff') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:10px;background:${color};">
    <a href="${escapeAttr(url)}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`;
}

export default { renderBranded, button };
