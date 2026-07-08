import { getSetting } from './settings.service.js';
import { logger } from '../config/logger.js';

/**
 * Configurable CAPTCHA (spam protection) for public forms.
 *
 * Supported providers: Google reCAPTCHA v2 (checkbox), reCAPTCHA v3 (score),
 * and hCaptcha. Keys + provider are configured in the Admin → System → Spam
 * protection card and stored in SystemSetting (group "captcha"). The site key is
 * public; the secret key is stored masked and never returned to the browser.
 */

const VERIFY_URLS = {
  recaptcha_v2: 'https://www.google.com/recaptcha/api/siteverify',
  recaptcha_v3: 'https://www.google.com/recaptcha/api/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
};

/** Full server-side config (includes the secret). */
export async function getCaptchaConfig() {
  const [enabled, provider, siteKey, secretKey, minScore, forms] = await Promise.all([
    getSetting('captcha.enabled', false),
    getSetting('captcha.provider', 'none'),
    getSetting('captcha.siteKey', ''),
    getSetting('captcha.secretKey', ''),
    getSetting('captcha.minScore', 0.5),
    getSetting('captcha.forms', ['contact', 'newsletter']),
  ]);
  return { enabled: Boolean(enabled), provider, siteKey, secretKey, minScore: Number(minScore) || 0.5, forms: Array.isArray(forms) ? forms : ['contact', 'newsletter'] };
}

/** Public config for the browser (never includes the secret). */
export async function getPublicCaptchaConfig() {
  const c = await getCaptchaConfig();
  const active = c.enabled && c.provider !== 'none' && Boolean(c.siteKey) && Boolean(c.secretKey);
  return { enabled: active, provider: active ? c.provider : 'none', siteKey: active ? c.siteKey : '', forms: c.forms };
}

/** Is CAPTCHA required for a given public form ('contact' | 'newsletter')? */
export async function captchaRequiredFor(form) {
  const c = await getCaptchaConfig();
  return c.enabled && c.provider !== 'none' && Boolean(c.siteKey) && Boolean(c.secretKey) && c.forms.includes(form);
}

/**
 * Verify a CAPTCHA token with the provider.
 * @returns {Promise<{success:boolean, skipped?:boolean, score?:number, error?:string}>}
 */
export async function verifyCaptcha(token, remoteIp, form = null) {
  const c = await getCaptchaConfig();
  const enforced = c.enabled && c.provider !== 'none' && c.secretKey && (!form || c.forms.includes(form));
  if (!enforced) return { success: true, skipped: true };
  if (!token) return { success: false, error: 'Missing CAPTCHA — please complete the challenge.' };

  const url = VERIFY_URLS[c.provider];
  if (!url) return { success: true, skipped: true };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: c.secretKey, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!data.success) {
      logger.warn({ provider: c.provider, errors: data['error-codes'] }, 'captcha verification failed');
      return { success: false, error: 'CAPTCHA verification failed — please try again.' };
    }
    // reCAPTCHA v3 returns a score (0..1); enforce the configured threshold.
    if (c.provider === 'recaptcha_v3' && typeof data.score === 'number' && data.score < c.minScore) {
      return { success: false, score: data.score, error: 'CAPTCHA score too low — please try again.' };
    }
    return { success: true, score: data.score };
  } catch (err) {
    logger.error({ err: err.message }, 'captcha verify request failed');
    // Fail-open on network errors so an outage doesn't block the whole form.
    return { success: true, skipped: true, error: 'captcha_unreachable' };
  }
}
