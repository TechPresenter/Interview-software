import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { uploadResume } from '../middleware/upload.js';
import { ROLES } from '../constants/enums.js';
import { updateProfileSchema } from '../validators/candidate.validators.js';
import * as candidate from '../controllers/candidate.controller.js';

/** Candidate self-service portal (auth + candidate role). Mounted under /me. */
export const router = Router();

router.use(authenticate, rbac(ROLES.CANDIDATE));

router.get('/interviews', candidate.myInterviews);
router.get('/profile', candidate.getProfile);
router.put('/profile', validate(updateProfileSchema), candidate.updateProfile);
router.post('/resume', uploadResume, candidate.uploadResume);
router.get('/notifications', candidate.notifications);
router.patch('/notifications/:id/read', candidate.markRead);
router.post('/notifications/read-all', candidate.markAllRead);

export default router;
