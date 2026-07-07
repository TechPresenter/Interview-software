import { z } from 'zod';
import { ROLES } from '../constants/enums.js';

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const email = z.string().email().toLowerCase();

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email,
  password,
  // Public registration only allows company_admin (creates a workspace) or candidate.
  role: z.enum([ROLES.COMPANY_ADMIN, ROLES.CANDIDATE]).default(ROLES.CANDIDATE),
  companyName: z.string().min(2).max(160).optional(),
});

export const loginSchema = z.object({
  email,
  password,
  otp: z.string().length(6).optional(), // 2FA TOTP when enabled
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(), // falls back to httpOnly cookie
});

export const verifyEmailSchema = z.object({
  email,
  code: z.string().length(6),
});

export const requestOtpSchema = z.object({ email });

export const otpLoginSchema = z.object({
  email,
  code: z.string().length(6),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  code: z.string().length(6),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

export const enable2faSchema = z.object({ token: z.string().length(6) });

export const googleLoginSchema = z.object({
  credential: z.string().min(10),
  role: z.enum([ROLES.COMPANY_ADMIN, ROLES.CANDIDATE]).optional(),
});
