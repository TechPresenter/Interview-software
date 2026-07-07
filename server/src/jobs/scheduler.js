import { runBillingReminders } from './reminders.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Lightweight in-process scheduler. Ticks a few times a day; each job self-limits
 * to once per calendar day, so multiple ticks (or restarts) never double-send.
 * Kept dependency-free — no external cron process required.
 */

const HOUR = 3600e3;

export function startScheduler() {
  if (config.env === 'test') return;

  const tick = async () => {
    try {
      await runBillingReminders();
    } catch (err) {
      logger.warn({ err: err.message }, 'billing reminders job failed');
    }
  };

  setTimeout(tick, 60e3).unref(); // ~1 min after boot
  setInterval(tick, 6 * HOUR).unref(); // then every 6h (job dedupes to once/day)
}

export default startScheduler;
