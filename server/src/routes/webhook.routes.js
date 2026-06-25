import { Router } from 'express';
import express from 'express';
import * as webhooks from '../controllers/webhook.controller.js';

/**
 * Provider webhooks. Mounted (in app.js) BEFORE the JSON body parser with
 * express.raw so signature verification sees the unmodified payload.
 */
export const router = Router();

router.post('/stripe', express.raw({ type: '*/*' }), webhooks.stripe);
router.post('/razorpay', express.raw({ type: '*/*' }), webhooks.razorpay);

export default router;
