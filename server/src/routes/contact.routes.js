import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { contactSchema } from '../validators/contact.validators.js';
import { submitContact } from '../controllers/contact.controller.js';

/** Public contact form endpoint. Mounted under /contact. */
export const router = Router();

router.post('/', contactLimiter, validate(contactSchema), submitContact);

export default router;
