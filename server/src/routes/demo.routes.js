import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { demoBookingSchema } from '../validators/demo.validators.js';
import { bookDemo } from '../controllers/demo.controller.js';

/** Public "Book a Demo" endpoint. Mounted under /demo. */
export const router = Router();

router.post('/', contactLimiter, validate(demoBookingSchema), bookDemo);

export default router;
