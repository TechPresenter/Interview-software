import { Router } from 'express';
import { EmailLog } from '../models/EmailLog.js';
import { config } from '../config/index.js';
import { ingestPageView, ingestEvent } from '../services/analytics.dashboard.service.js';

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

/** POST /track/event — first-party generic event beacon (CTA, feature, custom; no auth). */
router.post('/event', async (req, res) => {
  await ingestEvent(req);
  res.status(204).end();
});

/**
 * Only ever bounce back into our own app.
 *
 * The old test was `/^https?:\/\//.test(url)` — "starts with http", which every
 * URL on the internet does. That made this an open redirect on a domain
 * recipients are told to trust, reachable by anyone:
 *   /track/click/anything?u=https://evil.example/login
 * and the link in the email reads as ours right up to the redirect. Tracked
 * links only ever point back into the product (interview room, dashboard), so
 * pinning the origin costs nothing and takes the phishing gadget away.
 */
function safeRedirect(raw) {
  try {
    const target = new URL(String(raw || ''));
    const home = new URL(config.clientUrl);
    // Compare parsed origins, not string prefixes: `https://app.example.com.evil.io`
    // passes a startsWith check and is a different site entirely.
    if (target.origin === home.origin) return target.href;
  } catch {
    /* not a URL at all — fall through */
  }
  return config.clientUrl;
}

router.get('/click/:id', async (req, res) => {
  try {
    await EmailLog.findByIdAndUpdate(req.params.id, { $inc: { clickCount: 1 }, $set: { status: 'clicked', lastClickAt: new Date() } });
  } catch {
    /* ignore */
  }
  res.redirect(safeRedirect(req.query.u));
});

export default router;
