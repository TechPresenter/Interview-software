import { Router } from 'express';
import { EmailLog } from '../models/EmailLog.js';
import { config } from '../config/index.js';
import { ingestPageView } from '../services/analytics.dashboard.service.js';

/**
 * Public email tracking endpoints (no auth). Mounted at /track.
 *  - GET /track/open/:id   → 1x1 pixel; records an open
 *  - GET /track/click/:id  → records a click and redirects to ?u=
 */
export const router = Router();

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/open/:id', async (req, res) => {
  try {
    await EmailLog.findByIdAndUpdate(req.params.id, {
      $inc: { openCount: 1 },
      $set: { openedAt: new Date() },
    });
    // Promote status to 'opened' only if it was a successful send.
    await EmailLog.updateOne({ _id: req.params.id, status: { $in: ['sent', 'mocked'] } }, { $set: { status: 'opened' } });
  } catch {
    /* never fail a tracking pixel */
  }
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(PIXEL);
});

/** POST /track/collect — first-party page-view beacon (no auth). */
router.post('/collect', async (req, res) => {
  await ingestPageView(req);
  res.status(204).end();
});

router.get('/click/:id', async (req, res) => {
  const url = String(req.query.u || '');
  try {
    await EmailLog.findByIdAndUpdate(req.params.id, { $inc: { clickCount: 1 }, $set: { status: 'clicked', lastClickAt: new Date() } });
  } catch {
    /* ignore */
  }
  res.redirect(/^https?:\/\//.test(url) ? url : config.clientUrl);
});

export default router;
