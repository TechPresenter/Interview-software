import { Subscription } from '../models/Subscription.js';
import { Company } from '../models/Company.js';
import { safeSendTemplated, formatMoney } from '../services/email.service.js';
import { getSetting, setMany } from '../services/settings.service.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Time-based billing emails: trial-expiry and renewal reminders.
 *
 * Runs at most once per calendar day (guarded by a stored timestamp so restarts
 * don't re-send). Thresholds ("exactly N days left") keep the cadence to a couple
 * of messages per subscription rather than a daily nag. All sends are best-effort.
 */

const DAY = 864e5;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const daysUntil = (d) => Math.ceil((new Date(d).getTime() - Date.now()) / DAY);

async function recipientFor(companyId) {
  const company = await Company.findById(companyId).select('name billingEmail contactEmail').lean();
  if (!company) return null;
  const to = company.billingEmail || company.contactEmail;
  return to ? { to, name: company.name } : null;
}

/** Send due trial-expiry + renewal reminders. Idempotent per day. */
export async function runBillingReminders({ force = false } = {}) {
  const ymd = new Date().toISOString().slice(0, 10);
  if (!force) {
    const last = await getSetting('jobs.remindersLastRun', null);
    if (last === ymd) return { skipped: true };
  }

  const link = `${config.clientUrl}/dashboard/billing`;
  let sent = 0;

  // Trial expiry — trialing subs ending in exactly 3 or 1 days.
  const trials = await Subscription.find({ status: 'trialing' }).lean();
  for (const s of trials) {
    const end = s.trialEndsAt || s.currentPeriodEnd;
    if (!end) continue;
    const daysLeft = daysUntil(end);
    if (daysLeft !== 3 && daysLeft !== 1) continue;
    const rc = await recipientFor(s.company);
    if (!rc) continue;
    await safeSendTemplated('trial_expiry', {
      to: rc.to,
      vars: { name: rc.name, daysLeft: String(daysLeft), link },
      company: s.company,
    });
    sent += 1;
  }

  // Renewal reminder — active subs renewing in exactly 3 days.
  const active = await Subscription.find({ status: 'active' }).lean();
  for (const s of active) {
    if (!s.currentPeriodEnd || daysUntil(s.currentPeriodEnd) !== 3) continue;
    const rc = await recipientFor(s.company);
    if (!rc) continue;
    await safeSendTemplated('renewal_reminder', {
      to: rc.to,
      vars: { name: rc.name, planName: s.plan, amount: formatMoney(s.amount, s.currency), renewalDate: fmtDate(s.currentPeriodEnd), link },
      company: s.company,
    });
    sent += 1;
  }

  await setMany('jobs', [{ key: 'jobs.remindersLastRun', value: ymd }]);
  logger.info({ sent }, 'billing reminders run complete');
  return { sent };
}

export default runBillingReminders;
