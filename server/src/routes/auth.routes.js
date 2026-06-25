import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  requestOtpSchema,
  otpLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  enable2faSchema,
  googleLoginSchema,
} from '../validators/auth.validators.js';

export const router = Router();

// Public (rate-limited) auth endpoints
router.post('/register', authLimiter, validate(registerSchema), auth.register);
router.post('/login', authLimiter, validate(loginSchema), auth.login);
router.post('/google', authLimiter, validate(googleLoginSchema), auth.googleLogin);
router.post('/refresh', validate(refreshSchema), auth.refresh);
router.post('/logout', auth.logout);

router.post('/verify-email', validate(verifyEmailSchema), auth.verifyEmail);
router.post('/otp/request', authLimiter, validate(requestOtpSchema), auth.requestOtp);
router.post('/otp/verify', authLimiter, validate(otpLoginSchema), auth.otpLogin);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), auth.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), auth.resetPassword);

// Authenticated
router.get('/me', authenticate, auth.me);
router.post('/logout-all', authenticate, auth.logoutAll);
router.post('/2fa/setup', authenticate, auth.setup2fa);
router.post('/2fa/enable', authenticate, validate(enable2faSchema), auth.enable2fa);
router.post('/2fa/disable', authenticate, auth.disable2fa);

export default router;
