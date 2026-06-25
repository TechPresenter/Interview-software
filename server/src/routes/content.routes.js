import { Router } from 'express';
import * as content from '../controllers/content.controller.js';

/** Public, read-only marketing content. Mounted under /content. */
export const router = Router();

// Cacheable at the CDN/edge — content changes infrequently.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  next();
});

router.get('/branding', content.branding);
router.get('/plans', content.plans);
router.get('/faqs', content.faqs);
router.get('/testimonials', content.testimonials);
router.get('/announcements', content.announcements);
router.get('/blog', content.blogList);
router.get('/blog/:slug', content.blogPost);
router.get('/pages/:slug', content.page);

export default router;
