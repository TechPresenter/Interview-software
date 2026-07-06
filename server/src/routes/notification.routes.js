import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as notifications from '../controllers/notification.controller.js';

/** Notification feed for any authenticated user. Mounted at /notifications. */
export const router = Router();

router.use(authenticate);
router.get('/', notifications.list);
router.post('/read-all', notifications.markAllRead);
router.patch('/:id/read', notifications.markRead);

export default router;
