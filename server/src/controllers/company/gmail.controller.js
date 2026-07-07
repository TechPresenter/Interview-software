import { Company } from '../../models/Company.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { encryptSecret } from '../../utils/crypto.js';
import { refreshSmtp } from '../../services/email.service.js';
import { logActivity } from '../../services/audit.service.js';
import {
  gmailConfigured,
  buildAuthUrl,
  signState,
  verifyState,
  exchangeCode,
  getUserEmail,
} from '../../services/email/gmail.js';

/** Where to bounce the browser back to after the OAuth round-trip. */
const settingsUrl = (params) =>
  `${config.clientUrl.replace(/\/$/, '')}/dashboard/email-settings?${new URLSearchParams(params).toString()}`;

/**
 * GET /company/email/gmail/authorize
 * Returns the Google consent URL. The frontend redirects the browser to it.
 */
export const authorize = asyncHandler(async (req, res) => {
  if (!gmailConfigured()) {
    throw ApiError.badRequest('Gmail integration is not configured on the server (missing Google OAuth credentials).');
  }
  const state = signState({ companyId: String(req.companyId), userId: String(req.user._id), purpose: 'gmail_connect' });
  return ok(res, { url: buildAuthUrl(state) });
});

/**
 * GET /integrations/gmail/callback  (public — Google redirects here)
 * Verifies the signed state, exchanges the code, stores the refresh token
 * (encrypted) + connected email on the company, then redirects to the app.
 */
export const callback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(settingsUrl({ gmail: 'error', reason: String(error) }));
  if (!code || !state) return res.redirect(settingsUrl({ gmail: 'error', reason: 'missing_code' }));

  let decoded;
  try {
    decoded = verifyState(String(state));
  } catch {
    return res.redirect(settingsUrl({ gmail: 'error', reason: 'invalid_state' }));
  }

  try {
    const tokens = await exchangeCode(String(code));
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on first consent; force re-consent.
      return res.redirect(settingsUrl({ gmail: 'error', reason: 'no_refresh_token' }));
    }
    const email = await getUserEmail(tokens.access_token);

    await Company.findByIdAndUpdate(decoded.companyId, {
      $set: {
        'emailConfig.gmail.connected': true,
        'emailConfig.gmail.email': email,
        'emailConfig.gmail.refreshToken': encryptSecret(tokens.refresh_token),
        'emailConfig.gmail.scope': tokens.scope,
        'emailConfig.gmail.connectedAt': new Date(),
      },
    });
    refreshSmtp(decoded.companyId);
    await logActivity({ company: decoded.companyId, actor: decoded.userId, action: 'email.gmail.connect', summary: `Connected Gmail: ${email}` });
    logger.info({ company: decoded.companyId, email }, 'Gmail connected');

    return res.redirect(settingsUrl({ gmail: 'connected', email }));
  } catch (err) {
    logger.error({ err: err.message }, 'Gmail callback failed');
    return res.redirect(settingsUrl({ gmail: 'error', reason: 'exchange_failed' }));
  }
});

/**
 * POST /company/email/gmail/disconnect
 * Clears the stored Gmail connection for the company.
 */
export const disconnect = asyncHandler(async (req, res) => {
  await Company.findByIdAndUpdate(req.companyId, {
    $set: {
      'emailConfig.gmail.connected': false,
      'emailConfig.gmail.email': '',
      'emailConfig.gmail.refreshToken': '',
      'emailConfig.gmail.scope': '',
      'emailConfig.gmail.connectedAt': null,
    },
  });
  refreshSmtp(req.companyId);
  await logActivity({ company: req.companyId, actor: req.user._id, action: 'email.gmail.disconnect', summary: 'Disconnected Gmail' });
  return ok(res, { connected: false }, 'Gmail disconnected');
});
