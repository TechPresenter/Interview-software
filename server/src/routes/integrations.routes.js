import { Router } from 'express';
import { callback } from '../controllers/company/gmail.controller.js';

/**
 * Public integration callbacks (OAuth redirect targets). These cannot carry the
 * app's Bearer token — they are authorized via a signed `state` parameter — so
 * they live outside the authenticated route groups.
 */
export const router = Router();

router.get('/gmail/callback', callback);

export default router;
