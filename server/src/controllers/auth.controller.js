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
  setPending,
  getPending,
  clearPending,
  claimSendWindow,
  hasCode,
} from '../utils/otp.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { emails, safeSendTemplated } from '../services/email.service.js';
import { audit } from '../services/audit.service.js';
import { saveBuffer } from '../services/file.service.js';
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

/** How long a started registration may wait for its email code. */
const REGISTER_TTL = 900; // 15 minutes — matches what the email tells the user

/**
 * POST /auth/register — phase 1 of 2.
 *
 * Nothing is created here. The validated signup is staged in Redis and a
 * 6-digit code goes to the email; only /auth/register/verify — proof the
 * inbox is theirs — turns it into a real account. Creating the User first
 * and gating later leaves half-accounts squatting on email addresses and
 * hands out sessions for inboxes the caller may not own.
 *
 * The password is AES-encrypted (not bcrypt-hashed) inside the staged
 * payload: the User pre-save hook bcrypts whatever it is given, so staging
 * a bcrypt hash would get double-hashed and never match at login again.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, password, role, companyName } = req.body;
  const email = String(req.body.email).toLowerCase().trim();

  if (await User.exists({ email })) throw ApiError.conflict('Email already registered');
  if (role === ROLES.COMPANY_ADMIN && !companyName) {
    throw ApiError.badRequest('companyName is required to create a workspace');
  }

  // The staged details always update — a resubmit with a corrected name or
  // password must not verify into the stale payload.
  await setPending('register', email, { name, email, password: encryptSecret(password), role, companyName }, REGISTER_TTL);

  // One code email per address per minute — the auth limiter only counts
  // failures, so without this a stranger could pump codes at any inbox. Inside
  // the window the earlier code is still valid, so this is a 200 pointing the
  // user at their inbox, not an error stranding them on the form.
  const maySend = await claimSendWindow('register', email);
  if (maySend || !(await hasCode('register', email))) {
    const code = generateNumericCode();
    await setCode('register', email, code, REGISTER_TTL);
    await emails.verification(email, code, undefined, name);
  }

  await audit({ req, action: 'auth.register.start', meta: { email, role } });
  return ok(
    res,
    { pendingVerification: true, email },
    maySend
      ? 'We sent a 6-digit code to your email. Enter it to create your account.'
      : 'A code was already sent to your email — enter it below.',
  );
});

/**
 * POST /auth/register/verify — phase 2: the code proves inbox ownership,
 * so NOW the account (and workspace) is created and a session issued.
 */
export const registerVerify = asyncHandler(async (req, res) => {
  const email = String(req.body.email).toLowerCase().trim();
  const { code } = req.body;

  const pending = await getPending('register', email);
  if (!pending) {
    throw ApiError.badRequest('This signup has expired — please register again.', { code: 'REGISTRATION_EXPIRED' });
  }
  if (!(await verifyCode('register', email, code))) {
    // The pending payload survives a mistyped code; only the right code (or
    // the TTL) consumes it.
    throw ApiError.badRequest('That code is incorrect or has expired.', { code: 'INVALID_CODE' });
  }

  // The address may have been registered (e.g. via Google) while the code sat
  // in the inbox.
  if (await User.exists({ email })) {
    await clearPending('register', email);
    throw ApiError.conflict('Email already registered');
  }

  // A null decrypt (the AES key rotated mid-window) MUST abort: the pre-save
  // hook skips falsy passwords, so letting it through would mint an account
  // that can never log in with the password its owner just chose.
  const password = decryptSecret(pending.password);
  if (!password) {
    await clearPending('register', email);
    throw ApiError.badRequest('This signup has expired — please register again.', { code: 'REGISTRATION_EXPIRED' });
  }

  let company = null;
  if (pending.role === ROLES.COMPANY_ADMIN) {
    company = await Company.create({ name: pending.companyName, slug: slugify(pending.companyName) });
  }

  let user;
  try {
    user = await User.create({
      name: pending.name,
      email,
      password, // pre-save hook bcrypts it
      role: pending.role,
      company: company?._id,
      isEmailVerified: true, // the whole point of phase 2
    });
  } catch (err) {
    // Don't leave an ownerless workspace behind (e.g. a concurrent
    // double-submit losing to the unique email index).
    if (company) await Company.deleteOne({ _id: company._id, owner: null }).catch(() => {});
    throw err;
  }
  await clearPending('register', email);

  if (company) {
    company.owner = user._id;
    await company.save();
    // Branded welcome/onboarding email for new workspace owners.
    await emails.welcome(email, pending.name).catch(() => {});
  }

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

/** PATCH /auth/profile — update the signed-in user's own profile (all roles). */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('User not found');

  const { name, email, phone, dob, gender, address, city, state, country, postalCode } = req.body;

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (email && email !== user.email) {
    const exists = await User.exists({ email, _id: { $ne: user._id } });
    if (exists) throw ApiError.badRequest('That email is already in use');
    user.email = email;
    user.isEmailVerified = false;
  }

  const profile = { ...(user.meta?.profile || {}) };
  for (const [k, v] of Object.entries({ dob, gender, address, city, state, country, postalCode })) {
    if (v !== undefined) profile[k] = v;
  }
  user.meta = { ...(user.meta || {}), profile };
  user.markModified('meta');
  await user.save();

  await audit({ req, action: 'account.profile.update', entityType: 'User', entityId: user._id });
  return ok(res, { user }, 'Profile updated');
});

/** POST /auth/avatar — upload/replace the signed-in user's profile photo. */
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Image file required (field "image")');
  const { url } = await saveBuffer(req.file.buffer, req.file.originalname);
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { avatar: url } }, { new: true });
  return ok(res, { user, url }, 'Profile photo updated');
});

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
    await emails.otp(email, code, user.name);
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
  const email = String(req.body.email).toLowerCase().trim();
  // The cooldown answer is identical whether or not the account exists —
  // otherwise its 429 vs 200 would itself leak which emails are registered.
  const maySend = await claimSendWindow('reset', email);
  const user = maySend ? await User.findOne({ email }) : null;
  if (user) {
    const code = generateNumericCode();
    await setCode('reset', String(user._id), code, 900);
    await emails.passwordReset(email, code, undefined, user.name);
  }
  return ok(res, null, 'If that email exists, a reset code has been sent');
});

/** POST /auth/reset-password */
export const resetPassword = asyncHandler(async (req, res) => {
  const { code, password } = req.body;
  const email = String(req.body.email).toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) throw ApiError.badRequest('Invalid or expired code');
  const valid = await verifyCode('reset', String(user._id), code);
  if (!valid) throw ApiError.badRequest('Invalid or expired code');
  user.password = password;
  user.tokenVersion += 1; // force re-login everywhere
  await user.save();
  await revokeAllRefreshTokens(String(user._id));
  // "Your password was changed" — the alert that matters when it WASN'T them.
  await safeSendTemplated('password_changed', {
    to: email,
    vars: { name: user.name, time: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
    relatedUser: user._id,
  });
  await audit({ req, action: 'auth.password_reset', entityType: 'User', entityId: user._id });
  return ok(res, null, 'Password updated, please log in again');
});

/** PATCH /auth/change-password — authenticated password change. */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!user?.password) throw ApiError.badRequest('Password change isn’t available for social-login accounts');
  if (!(await user.comparePassword(currentPassword))) throw ApiError.unauthorized('Current password is incorrect');
  if (await user.comparePassword(newPassword)) throw ApiError.badRequest('New password must be different from the current one');
  user.password = newPassword;
  user.tokenVersion += 1; // sign out other sessions for safety
  await user.save();
  await revokeAllRefreshTokens(String(user._id));
  await audit({ req, action: 'auth.password_change', entityType: 'User', entityId: user._id });
  return ok(res, null, 'Password changed — please sign in again');
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
