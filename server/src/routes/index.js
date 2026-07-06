import { Router } from 'express';
import { router as authRoutes } from './auth.routes.js';
import { router as adminRoutes } from './admin.routes.js';
import { router as companyRoutes } from './company.routes.js';
import { router as roomRoutes } from './room.routes.js';
import { router as candidateRoutes } from './candidate.routes.js';
import { router as contentRoutes } from './content.routes.js';
import { router as contactRoutes } from './contact.routes.js';
import { router as trackingRoutes } from './tracking.routes.js';
import { router as notificationRoutes } from './notification.routes.js';

export const router = Router();

// API meta — useful for clients to discover the version & available modules.
router.get('/', (_req, res) =>
  res.json({
    success: true,
    name: 'HireSense API',
    version: 'v1',
    modules: {
      auth: 'ready',
      superAdmin: 'ready',
      company: 'ready',
      interviewRoom: 'ready',
      candidatePortal: 'ready',
      billing: 'ready',
      cms: 'ready',
      company: 'planned',
      jobs: 'planned',
      candidates: 'planned',
      interviews: 'planned',
      reports: 'planned',
      billing: 'planned',
      cms: 'planned',
    },
  }),
);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/interview-room', roomRoutes);
router.use('/me', candidateRoutes);
router.use('/content', contentRoutes);
router.use('/contact', contactRoutes);
router.use('/track', trackingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/', companyRoutes);

export default router;
