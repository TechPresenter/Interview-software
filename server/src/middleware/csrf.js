import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Lightweight, dependency-free CSRF mitigation via strict Origin/Referer
 * checking on state-changing requests.
 *
 * The API authenticates with a Bearer token (and optionally an accessToken
 * cookie). For any cookie-carrying browser request a classic CSRF is only
 * possible from a foreign origin — and browsers always attach an `Origin`
 * header to cross-origin, state-changing fetches/XHR. So we allow a mutation
 * only when its `Origin` (or `Referer`) matches an allow-listed host.
 *
 * Requests with no Origin/Referer at all (server-to-server, curl, native mobile
 * apps that don't set Origin) are allowed through — they are not browser CSRF
 * vectors. Payment webhooks are mounted before this guard and are unaffected.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Hosts that are allowed to mutate state. */
const allowedHosts = new Set(
  [config.clientUrl, config.apiPublicUrl, `http://localhost:${config.port}`]
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u).host;
      } catch {
        return null;
      }
    })
    .filter(Boolean),
);

// Common local dev hosts so the guard never blocks legitimate localhost traffic.
if (!config.isProd) {
  for (const h of ['localhost:3000', 'localhost:5000', '127.0.0.1:3000', '127.0.0.1:5000']) {
    allowedHosts.add(h);
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function csrfGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer || req.headers.referrer;

  // No browser-controlled origin present ⇒ not a browser CSRF vector.
  if (!origin && !referer) return next();

  const host = hostOf(origin) || hostOf(referer);
  if (host && allowedHosts.has(host)) return next();

  return next(ApiError.forbidden('Request blocked: invalid origin (CSRF protection).'));
}

export default csrfGuard;
