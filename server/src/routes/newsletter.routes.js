import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { newsletterSchema } from '../validators/lead.validators.js';
import { subscribeNewsletter } from '../controllers/newsletter.controller.js';

/** Public newsletter subscription endpoint. Mounted under /newsletter. */
export const router = Router();

router.post('/', contactLimiter, validate(newsletterSchema), subscribeNewsletter);

export default router;
