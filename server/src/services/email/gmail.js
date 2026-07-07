import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

/**
 * Gmail OAuth 2.0 helpers — no SDK, plain HTTPS calls to Google's OAuth
 * endpoints (mirrors the existing Google-login token verification).
 *
 * Scopes requested:
 *   - gmail.send                → send email on the user's behalf
 *   - userinfo.email + openid   → read the connected account's email address
 * `access_type=offline` + `prompt=consent` guarantee a refresh token so we keep
 * secure, long-lived offline access. Nodemailer's OAuth2 transport exchanges the
 * refresh token for short-lived access tokens automatically at send time.
 */

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** True when Google OAuth client credentials are configured. */
export function gmailConfigured() {
  return Boolean(config.oauth.google.clientId && config.oauth.google.clientSecret);
}

/** The backend callback URL Google redirects to (must be allow-listed in the Google console). */
export function redirectUri() {
  const base = config.apiPublicUrl || `http://localhost:${config.port}${config.apiPrefix}`;
  return `${base.replace(/\/$/, '')}/integrations/gmail/callback`;
}

/** Sign a short-lived, tamper-proof state token binding the flow to a company/user. */
export function signState(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '15m' });
}

/** Verify + decode a state token; throws if invalid/expired. */
export function verifyState(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/** Build the Google consent screen URL for the given signed state. */
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.oauth.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchange an authorization code for tokens. Returns { access_token, refresh_token, scope, expires_in }. */
export async function exchangeCode(code) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    logger.error({ data }, 'Gmail code exchange failed');
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
  return data;
}

/** Look up the email address of the connected account using its access token. */
export async function getUserEmail(accessToken) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Failed to read profile');
  return data.email;
}

/** Exchange a refresh token for a fresh access token (used by the mail transport). */
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed');
  return data; // { access_token, expires_in, scope, token_type }
}
