import { Router } from 'express';
import express from 'express';
import * as webhooks from '../controllers/webhook.controller.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

/**
 * Provider webhooks. Mounted (in app.js) BEFORE the JSON body parser with
 * express.raw so signature verification sees the unmodified payload — which
 * also means BEFORE the global limiter, so these routes carry their own.
 */
export const router = Router();

router.use(webhookLimiter);
router.post('/stripe', express.raw({ type: '*/*' }), webhooks.stripe);
router.post('/razorpay', express.raw({ type: '*/*' }), webhooks.razorpay);
router.post('/cashfree', express.raw({ type: '*/*' }), webhooks.cashfree);

export default router;
