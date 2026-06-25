import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Optional error monitoring via Sentry. The SDK is loaded lazily and only when
 * SENTRY_DSN is set, so the app runs identically without it. captureException is
 * a safe no-op until initialized.
 */

let sentry = null;

export async function initObservability() {
  if (!config.sentry.enabled) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.env,
      tracesSampleRate: config.isProd ? 0.1 : 1.0,
    });
    sentry = Sentry;
    logger.info('🛰️  Sentry error monitoring enabled');
  } catch (err) {
    logger.warn({ err: err.message }, 'Sentry init skipped (package missing?)');
  }
}

/** Report an exception to Sentry if configured; always safe to call. */
export function captureException(err, context) {
  if (!sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* never let monitoring break the request */
  }
}

export default { initObservability, captureException };
