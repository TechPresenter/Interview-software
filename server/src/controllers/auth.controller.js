import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { nanoid } from 'nanoid';

import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  issueTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from '../utils/tokens.js';
import {
  generateNumericCode,
  setCode,
  verifyCode,
} from '../utils/otp.js';
import { emails } from '../services/email.service.js';
import { audit } from '../services/audit.service.js';
import { ROLES } from '../constants/enums.js';

const REFRESH_COOKIE = 'refreshToken';
const cookieOpts = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 7,
  path: config.apiPrefix,
};

const slugify = (s) =>
  `${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)}-${nanoid(6)}`;

/** Issues tokens, sets the refresh cookie, and returns the standard auth payload. */
async function sendAuth(res, user, statusFn = ok) {
  const { accessToken, refreshToken } = await issueTokenPair(user);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
  return statusFn(res, { user, accessToken, refreshToken }, 'Authenticated');
}

/** POST /auth/register */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, companyName } = req.body;

  if (await User.exists({ email })) throw ApiError.conflict('Email already registered');

  let company = null;
  if (role === ROLES.COMPANY_ADMIN) {
    if (!companyName) throw ApiError.badRequest('companyName is required to create a workspace');
    company = await Company.create({ name: companyName, slug: slugify(companyName) });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    company: company?._id,
  });

  if (company) {
    company.owner = user._id;
    await company.save();
  }

  // Fire-and-forget email verification code.
  const code = generateNumericCode();
  await setCode('verify', String(user._id), code, 600);
  await emails.verification(email, code);

  await audit({ req, action: 'auth.register', entityType: 'User', entityId: user._id });
  return sendAuth(res, user, created);
});

/** POST /auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password, otp } = req.body;

  const user = await User.findOne({ email }).select('+password +twoFactor.secret');
  if (!user || !(await user.comparePassword(password))) {
    await audit({ req, action: 'auth.login', status: 'failure', meta: { email } });
    throw ApiError.unauthorized('Invalid credentials');
  }
  if (!user.isActive) throw ApiError.forbidden('Account is disabled');

  if (user.twoFactor?.enabled) {
    if (!otp) throw ApiError.unauthorized('2FA code required', { code: 'TWO_FACTOR_REQUIRED' });
    const valid = authenticator.verify({ token: otp, secret: user.twoFactor.secret });
    if (!valid) throw ApiError.unauthorized('Invalid 2FA code');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await audit({ req, action: 'auth.login', entityType: 'User', entityId: user._id });
  return sendAuth(res, user);
});

/** POST /auth/refresh — rotates the refresh token. */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  const payload = await verifyRefreshToken(token);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Session is no longer valid');
  }

  // Rotation: revoke the used token, issue a fresh pair.
  await revokeRefreshToken(payload.sub, payload.jti);
  return sendAuth(res, user);
});

/** POST /auth/logout */
export const logout = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = await verifyRefreshToken(token);
      await revokeRefreshToken(payload.sub, payload.jti);
    } catch {
      /* token already invalid — nothing to revoke */
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: config.apiPrefix });
  return ok(res, null, 'Logged out');
});

/** POST /auth/logout-all — invalidates every session. */
export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllRefreshTokens(String(req.user._id));
  req.user.tokenVersion += 1; // also invalidates outstanding access tokens
  await req.user.save();
  res.clearCookie(REFRESH_COOKIE, { path: config.apiPrefix });
  return ok(res, null, 'Logged out from all devices');
});

/** GET /auth/me */
export const me = asyncHandler(async (req, res) => ok(res, { user: req.user }));

/** POST /auth/verify-email */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw ApiError.notFound('User not found');
  const valid = await verifyCode('verify', String(user._id), code);
  if (!valid) throw ApiError.badRequest('Invalid or expired code');
  user.isEmailVerified = true;
  await user.save();
  return ok(res, null, 'Email verified');
});

/** POST /auth/otp/request — passwordless login code. */
export const requestOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Always respond 200 to avoid leaking which emails exist.
  if (user) {
    const code = generateNumericCode();
    await setCode('otp', String(user._id), code, 300);
    await emails.otp(email, code);
  }
  return ok(res, null, 'If that email exists, a login code has been sent');
});

/** POST /auth/otp/verify */
export const otpLogin = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw ApiError.unauthorized('Invalid code');
  const valid = await verifyCode('otp', String(user._id), code);
  if (!valid) throw ApiError.unauthorized('Invalid or expired code');
  user.isEmailVerified = true;
  user.lastLoginAt = new Date();
  await user.save();
  await audit({ req, action: 'auth.otp_login', entityType: 'User', entityId: user._id });
  return sendAuth(res, user);
});

/** POST /auth/forgot-password */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const code = generateNumericCode();
    await setCode('reset', String(user._id), code, 900);
    await emails.passwordReset(email, code);
  }
  return ok(res, null, 'If that email exists, a reset code has been sent');
});

/** POST /auth/reset-password */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw ApiError.badRequest('Invalid or expired code');
  const valid = await verifyCode('reset', String(user._id), code);
  if (!valid) throw ApiError.badRequest('Invalid or expired code');
  user.password = password;
  user.tokenVersion += 1; // force re-login everywhere
  await user.save();
  await revokeAllRefreshTokens(String(user._id));
  await audit({ req, action: 'auth.password_reset', entityType: 'User', entityId: user._id });
  return ok(res, null, 'Password updated, please log in again');
});

/**
 * POST /auth/google — sign in / sign up with a Google ID token (credential)
 * issued by Google Identity Services on the client. We verify the token against
 * Google's tokeninfo endpoint (no extra SDK) and check the audience.
 */
export const googleLogin = asyncHandler(async (req, res) => {
  if (!config.oauth.google.enabled) throw ApiError.badRequest('Google login is not configured');
  const { credential, role } = req.body;

  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!resp.ok) throw ApiError.unauthorized('Invalid Google credential');
  const payload = await resp.json();

  if (payload.aud !== config.oauth.google.clientId) throw ApiError.unauthorized('Token audience mismatch');
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw ApiError.unauthorized('Google email is not verified');
  }

  const email = String(payload.email).toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    let company = null;
    if (role === ROLES.COMPANY_ADMIN) {
      company = await Company.create({ name: `${payload.name || email}'s workspace`, slug: slugify(payload.name || email) });
    }
    user = await User.create({
      name: payload.name || email.split('@')[0],
      email,
      role: role === ROLES.COMPANY_ADMIN ? ROLES.COMPANY_ADMIN : ROLES.CANDIDATE,
      company: company?._id,
      avatar: payload.picture,
      isEmailVerified: true,
      providers: { google: { id: payload.sub } },
    });
    if (company) {
      company.owner = user._id;
      await company.save();
    }
  } else if (!user.providers?.google?.id) {
    user.providers = { ...(user.providers || {}), google: { id: payload.sub } };
    user.isEmailVerified = true;
    await user.save();
  }

  if (!user.isActive) throw ApiError.forbidden('Account is disabled');
  user.lastLoginAt = new Date();
  await user.save();
  await audit({ req, action: 'auth.google_login', entityType: 'User', entityId: user._id });
  return sendAuth(res, user);
});

/** POST /auth/2fa/setup — returns provisioning QR + secret. */
export const setup2fa = asyncHandler(async (req, res) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(req.user.email, 'HireSense', secret);
  const qr = await qrcode.toDataURL(otpauth);
  // Stash the pending secret on the user; only flips `enabled` after verify.
  req.user.twoFactor = { enabled: false, secret };
  await req.user.save();
  return ok(res, { secret, qr, otpauth }, 'Scan the QR, then confirm with a code');
});

/** POST /auth/2fa/enable */
export const enable2fa = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactor.secret');
  if (!user.twoFactor?.secret) throw ApiError.badRequest('Run 2FA setup first');
  const valid = authenticator.verify({ token: req.body.token, secret: user.twoFactor.secret });
  if (!valid) throw ApiError.badRequest('Invalid code');
  user.twoFactor.enabled = true;
  await user.save();
  await audit({ req, action: 'auth.2fa_enabled', entityType: 'User', entityId: user._id });
  return ok(res, null, 'Two-factor authentication enabled');
});

/** POST /auth/2fa/disable */
export const disable2fa = asyncHandler(async (req, res) => {
  req.user.twoFactor = { enabled: false, secret: undefined };
  await req.user.save();
  await audit({ req, action: 'auth.2fa_disabled', entityType: 'User', entityId: req.user._id });
  return ok(res, null, 'Two-factor authentication disabled');
});
