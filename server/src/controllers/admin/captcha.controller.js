import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { setMany } from '../../services/settings.service.js';
import { getCaptchaConfig } from '../../services/captcha.service.js';
import { audit } from '../../services/audit.service.js';

const PROVIDERS = ['none', 'recaptcha_v2', 'recaptcha_v3', 'hcaptcha'];

/** GET /admin/captcha — current config (site key visible; secret masked). */
export const get = asyncHandler(async (_req, res) => {
  const c = await getCaptchaConfig();
  return ok(res, {
    enabled: c.enabled,
    provider: c.provider,
    siteKey: c.siteKey,        // public — safe to show
    secretKeySet: Boolean(c.secretKey), // never return the secret itself
    minScore: c.minScore,
    forms: c.forms,
  });
});

/** PUT /admin/captcha — save config. Secret is only overwritten when a new one is provided. */
export const update = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const provider = PROVIDERS.includes(b.provider) ? b.provider : 'none';
  const forms = Array.isArray(b.forms) ? b.forms.filter((f) => ['contact', 'newsletter'].includes(f)) : ['contact', 'newsletter'];

  const entries = [
    { key: 'captcha.enabled', value: Boolean(b.enabled) },
    { key: 'captcha.provider', value: provider },
    { key: 'captcha.siteKey', value: String(b.siteKey || '').trim() },
    { key: 'captcha.minScore', value: Number(b.minScore) || 0.5 },
    { key: 'captcha.forms', value: forms },
  ];
  // Only write the secret if a real (non-masked, non-empty) value was supplied.
  if (typeof b.secretKey === 'string' && b.secretKey.trim() && !b.secretKey.includes('•')) {
    entries.push({ key: 'captcha.secretKey', value: b.secretKey.trim(), isSecret: true });
  }

  await setMany('captcha', entries, req.user._id);
  await audit({ req, action: 'system.captcha.update', meta: { provider, enabled: Boolean(b.enabled) } });

  const c = await getCaptchaConfig();
  return ok(res, { enabled: c.enabled, provider: c.provider, siteKey: c.siteKey, secretKeySet: Boolean(c.secretKey), minScore: c.minScore, forms: c.forms }, 'Spam protection saved');
});
