import crypto from 'node:crypto';
import { Application } from '../models/Application.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { getSetting, setMany } from './settings.service.js';
import { cashfreeProvider } from './payment/cashfree.provider.js';
import { safeSendTemplated } from './email.service.js';
import { config as appConfig } from '../config/index.js';

/** Same envelope-address fallback chain the contact form uses. */
const APPLICATIONS_TO =
  process.env.APPLICATIONS_TO || process.env.CONTACT_TO || appConfig.mail?.from || 'support@aipl.online';

/** Matches the PDF/email date format used elsewhere in this module. */
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/**
 * The applicant + admin "application received" notifications.
 *
 * Deliberately fired from ONE place so it runs exactly once per real submission:
 * immediately for the free / link / off routes, but only after the fee is paid
 * for the gateway route — a "received" email before the money would be a lie,
 * and silence when it finally arrives would lose the applicant.
 */
export async function notifyApplicationReceived(application) {
  const { payment } = application;
  const common = {
    applicationId: application.applicationId,
    name: application.fullName,
    submittedAt: fmtDate(application.submittedAt),
    preferredJobRole: application.preferredJobRole || 'Not specified',
    paymentStatus: payment.status,
    paymentReference: payment.reference || 'None given',
    currency: payment.currency,
    fee: payment.amount,
  };
  await Promise.all([
    safeSendTemplated('application.received', { to: application.email, vars: common }),
    safeSendTemplated('application.admin.new', {
      to: APPLICATIONS_TO,
      vars: { ...common, email: application.email, mobile: application.mobile, adminUrl: `${appConfig.clientUrl}/dashboard/applications` },
    }),
  ]);
}

/**
 * The public "Apply for Interview" module's business rules.
 *
 * Everything that arrives here came from an unauthenticated stranger, so this
 * layer owns the three things the route cannot: a collision-free public id, the
 * one-live-application rule, and the deliberate gap between "the applicant says
 * they paid" and "we know they paid".
 */

/** Settings group backing the admin-editable payment configuration. */
const SETTINGS_GROUP = 'applications';

const DEFAULT_DECLARATION =
  'I confirm that the information provided in this application is accurate and complete to the best of my knowledge.';

/** The settings keys this module owns. `getGroup(SETTINGS_GROUP)` lists them. */
export const SETTING_KEYS = {
  enabled: 'applications.enabled',
  paymentMode: 'applications.paymentMode',
  paymentUrl: 'applications.paymentUrl',
  fee: 'applications.fee',
  currency: 'applications.currency',
  declarationText: 'applications.declarationText',
  paymentInstructions: 'applications.paymentInstructions',
};

/**
 * How the fee is collected.
 *  - `cashfree`: the applicant pays at the gateway and the submission is only
 *    finished when the signed webhook says so.
 *  - `link`: the legacy one-way redirect to an admin-configured URL; the
 *    applicant pastes a reference that an admin verifies by hand.
 *  - `off`: record the fee on the application but do not gate on it.
 */
export const PAYMENT_MODES = ['cashfree', 'link', 'off'];

/**
 * Admin-editable configuration.
 *
 * Lives in Settings rather than env so the payment link can change without a
 * deploy — which is the entire reason it is a URL and not a gateway
 * integration. Read one key at a time via getSetting because that is what is
 * Redis-cached; getGroup() returns a display array (and masks secret-looking
 * values), which is for rendering the settings screen, not for reading config.
 */
export async function applicationConfig() {
  const [enabled, paymentMode, paymentUrl, fee, currency, declarationText, paymentInstructions] = await Promise.all([
    getSetting(SETTING_KEYS.enabled, true),
    getSetting(SETTING_KEYS.paymentMode, 'cashfree'),
    getSetting(SETTING_KEYS.paymentUrl, ''),
    getSetting(SETTING_KEYS.fee, 0),
    getSetting(SETTING_KEYS.currency, 'INR'),
    getSetting(SETTING_KEYS.declarationText, DEFAULT_DECLARATION),
    getSetting(SETTING_KEYS.paymentInstructions, ''),
  ]);
  const mode = PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'cashfree';
  return {
    enabled: enabled !== false, // open unless explicitly switched off
    paymentMode: mode,
    paymentUrl: paymentUrl || '',
    fee: Number(fee) || 0,
    currency: currency || 'INR',
    declarationText: declarationText || DEFAULT_DECLARATION,
    // Shown above the Pay Now button, so the admin can explain "pay by UPI to
    // ..., then paste the UTR below" without a code change.
    paymentInstructions: paymentInstructions || '',
    // Whether the gateway can actually take money right now. Read from env-backed
    // config, so a fee set to `cashfree` with no credentials fails loudly at
    // submit rather than quietly letting applications through unpaid.
    gatewayReady: cashfreeProvider.enabled(),
  };
}

/** Does this application have to pay before it counts as submitted? */
export function paymentRequired(config) {
  return config.enabled && config.fee > 0 && config.paymentMode !== 'off';
}

/**
 * Is the fee collected through the gateway (rather than the manual link)?
 * `gatewayReady` is part of the test on purpose: an admin who selects Cashfree
 * but never sets credentials degrades to the manual flow instead of 503-ing
 * every applicant.
 */
export function gatewayPayment(config) {
  return paymentRequired(config) && config.paymentMode === 'cashfree' && config.gatewayReady;
}

/**
 * Persist the admin's changes.
 * @param {object} patch a partial of the applicationConfig() shape
 */
export async function saveApplicationConfig(patch, userId) {
  const entries = Object.entries(SETTING_KEYS)
    .filter(([field]) => patch[field] !== undefined)
    .map(([field, key]) => ({ key, value: patch[field] }));
  if (entries.length) await setMany(SETTINGS_GROUP, entries, userId);
  return applicationConfig();
}

/**
 * Mint the next public application id: AIPL-2026-000123.
 *
 * Sequential within a year, because "AIPL-2026-000042" is a thing a person can
 * read over the phone — which is what this id is FOR. The unguessable identifier
 * is `verificationCode`; this one is meant to be quotable.
 *
 * countDocuments + 1 races: two simultaneous submits both read N and both build
 * N+1. That is survivable rather than ignored — `applicationId` is uniquely
 * indexed, so the loser fails at the database and retries here rather than two
 * applicants sharing an id. Retrying a handful of times is cheaper than a
 * counters collection for a form that takes minutes to fill in.
 */
async function nextApplicationId(attempt = 0) {
  const year = new Date().getFullYear();
  const prefix = `AIPL-${year}-`;
  // Highest existing id for the year, not a count: a deleted application must
  // not hand its number to the next applicant.
  const last = await Application.findOne({ applicationId: new RegExp(`^${prefix}`) })
    .sort({ applicationId: -1 })
    .select('applicationId')
    .lean();
  const lastSeq = last ? Number(String(last.applicationId).slice(prefix.length)) : 0;
  return `${prefix}${String(lastSeq + 1 + attempt).padStart(6, '0')}`;
}

/** Unguessable, and short enough to sit under a QR code. */
const newVerificationCode = () => crypto.randomBytes(9).toString('base64url');

/**
 * Is this person already in the queue?
 *
 * "One live application per person" — a rejected applicant may apply again, a
 * pending one may not. Checked here so the applicant gets a sentence they can
 * act on; also enforced by a partial unique index, because two simultaneous
 * submits both pass this check and only the database stops the second.
 */
export async function findLiveApplication({ email, mobile }) {
  const or = [];
  if (email) or.push({ email: String(email).toLowerCase().trim() });
  if (mobile) or.push({ mobile: String(mobile).trim() });
  if (!or.length) return null;
  return Application.findOne({
    $or: or,
    status: { $in: ['pending', 'under_review', 'shortlisted', 'selected'] },
  })
    .select('applicationId status email mobile submittedAt payment.status verificationCode')
    .lean();
}

/**
 * An application that exists but was never paid for is not a submission — it is
 * an abandoned checkout. It still occupies the one-live-per-person unique index,
 * so without this the applicant is locked out of ever applying again by their
 * own half-finished attempt.
 */
const isAbandonedCheckout = (app) => app?.payment?.status === 'pending' || app?.payment?.status === 'failed';

/** Turn the duplicate index's error into something the applicant can act on. */
function duplicateError(err) {
  if (err?.code !== 11000) return null;
  const key = Object.keys(err.keyPattern || {})[0];
  if (key === 'email') {
    return ApiError.conflict('An application with this email address is already being reviewed.', { code: 'DUPLICATE_APPLICATION', field: 'email' });
  }
  if (key === 'mobile') {
    return ApiError.conflict('An application with this mobile number is already being reviewed.', { code: 'DUPLICATE_APPLICATION', field: 'mobile' });
  }
  return null;
}

/**
 * Create an application.
 *
 * @param {object} data      validated body
 * @param {object} files     { resume, photo } — already written to disk
 * @param {object} meta      { ip, userAgent }
 */
export async function createApplication(data, files, meta = {}) {
  const config = await applicationConfig();
  if (!config.enabled) {
    throw ApiError.forbidden('Applications are closed at the moment. Please check back soon.', { code: 'APPLICATIONS_CLOSED' });
  }

  const existing = await findLiveApplication({ email: data.email, mobile: data.mobile });
  if (existing && isAbandonedCheckout(existing)) {
    // They started a paid application and never finished paying. Their new form
    // data is the one they want, so the stale attempt is discarded rather than
    // held against them — otherwise the unique index locks them out for good.
    await Application.deleteOne({ _id: existing._id, 'payment.status': existing.payment.status });
    logger.info({ applicationId: existing.applicationId }, 'superseded an unpaid application');
  } else if (existing) {
    throw ApiError.conflict(
      `You already have an application (${existing.applicationId}) under review. We'll be in touch — no need to apply again.`,
      { code: 'DUPLICATE_APPLICATION', applicationId: existing.applicationId },
    );
  }

  // Gateway route: the application is filed but does NOT count as submitted
  // until Cashfree's signed webhook says the money arrived. gatewayPayment()
  // already folds in gatewayReady, so a misconfigured gateway lands on the
  // manual path below rather than dead-ending the applicant.
  const viaGateway = gatewayPayment(config);

  // The applicant's payment claim is recorded, never believed. `claimed` says
  // "they typed a reference"; only an admin moves it to `verified`.
  const reference = viaGateway ? '' : data.paymentReference?.trim();
  const payment = {
    status: viaGateway ? 'pending' : reference ? 'claimed' : 'unpaid',
    reference: reference || undefined,
    // Freeze the fee as it stood when they applied — the admin may change it
    // tomorrow, and this application must still say what it asked for.
    amount: config.fee,
    currency: config.currency,
    claimedAt: reference ? new Date() : undefined,
    provider: viaGateway ? 'cashfree' : undefined,
  };

  const base = {
    ...data,
    // Never let the request set these, whatever it sends.
    paymentReference: undefined,
    status: 'pending',
    payment,
    declaration: {
      accepted: true, // the validator refuses anything else
      acceptedAt: new Date(),
      text: config.declarationText, // freeze the wording they actually agreed to
    },
    resume: files.resume,
    photo: files.photo,
    submittedIp: meta.ip,
    submittedUserAgent: meta.userAgent,
    submittedAt: new Date(),
  };

  // Retry only the id collision; anything else is a real failure.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Application.create({
        ...base,
        applicationId: await nextApplicationId(attempt),
        verificationCode: newVerificationCode(),
      });
    } catch (err) {
      const dupe = duplicateError(err);
      if (dupe) throw dupe;
      const collided = err?.code === 11000 && (err.keyPattern?.applicationId || err.keyPattern?.verificationCode);
      if (!collided || attempt === 4) throw err;
      logger.warn({ attempt }, 'application id collision — retrying');
    }
  }
  // Unreachable: the loop either returns or throws.
  throw ApiError.internal('Could not allocate an application id. Please try again.');
}

/**
 * Record an admin's verdict on the money.
 * `verified` and `waived` are the only states that count as paid.
 */
export async function setPaymentStatus(application, { status, note }, user) {
  application.payment.status = status;
  if (note !== undefined) application.payment.note = note;
  if (status === 'verified' || status === 'waived') {
    application.payment.verifiedAt = new Date();
    application.payment.verifiedBy = user._id;
  } else {
    // Un-verifying must clear the evidence of verification, or the record keeps
    // claiming a human approved it.
    application.payment.verifiedAt = undefined;
    application.payment.verifiedBy = undefined;
  }
  await application.save();
  return application;
}

/** Cashfree wants a bare national number; the form may hold "+91 98765 43210". */
const normalisePhone = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Open (or re-open) the gateway checkout for an application awaiting payment.
 *
 * A fresh order id every call: Cashfree rejects a reused `order_id`, and an
 * applicant whose first attempt failed or timed out has to be able to try again.
 * The id is stored on the application because the webhook arrives knowing only
 * that, and it is what we look the row up by.
 */
export async function startApplicationCheckout(application, config) {
  const orderId = `app_${application._id}_${Date.now()}`;
  const returnUrl = `${appConfig.clientUrl.replace(/\/$/, '')}/apply/status?code=${application.verificationCode}`;

  const session = await cashfreeProvider.createApplicationOrder({
    orderId,
    // Already frozen in major units on the application; never re-read from
    // config here, or an applicant mid-checkout would be charged a fee the
    // admin changed a minute ago.
    amount: application.payment.amount ?? config.fee,
    currency: application.payment.currency || config.currency,
    applicationId: application._id,
    customerId: String(application._id),
    customerName: application.fullName,
    customerEmail: application.email,
    customerPhone: normalisePhone(application.mobile),
    returnUrl,
    note: `Interview application fee — ${application.applicationId}`,
  });

  application.payment.provider = 'cashfree';
  application.payment.orderId = session.orderId;
  application.payment.status = 'pending';
  await application.save();
  return session;
}

/**
 * Record a successful gateway payment. This — not the browser returning from
 * Cashfree — is what makes an application a real submission.
 *
 * Idempotent: Cashfree retries webhook delivery until it gets a 2xx, so the same
 * event arrives more than once and must not re-stamp an already-verified row.
 */
export async function markApplicationPaid({ orderId, applicationId, providerPaymentId }) {
  const filter = orderId ? { 'payment.orderId': orderId } : { _id: applicationId };
  const application = await Application.findOne(filter);
  if (!application) {
    logger.warn({ orderId, applicationId }, 'payment webhook for an unknown application');
    return null;
  }
  if (application.payment.status === 'verified') return application; // replayed delivery

  application.payment.status = 'verified';
  application.payment.providerPaymentId = providerPaymentId || application.payment.providerPaymentId;
  application.payment.paidAt = new Date();
  // Verified by the gateway, so verifiedAt is set but verifiedBy stays empty —
  // that gap is how the admin table tells a machine-confirmed payment from one a
  // human signed off. The amount is deliberately NOT taken from the webhook: it
  // reports minor units while the application froze the fee in major ones.
  application.payment.verifiedAt = new Date();
  await application.save();
  logger.info({ applicationId: application.applicationId, orderId }, 'application fee paid');
  // Only now is this a real submission — send the receipt the submit step held back.
  await notifyApplicationReceived(application);
  return application;
}

/**
 * Reconcile a still-pending application against Cashfree directly.
 *
 * The webhook is the source of truth, but it can be seconds late or (in a
 * misconfigured dashboard) never arrive. When the applicant lands back on the
 * status page we ask Cashfree outright, so a paid application is confirmed even
 * if its webhook is lost — without ever trusting the browser's word for it.
 */
export async function reconcileApplicationPayment(application) {
  if (application.payment.status !== 'pending' || !application.payment.orderId) return application;
  if (!cashfreeProvider.enabled()) return application;
  try {
    const order = await cashfreeProvider.fetchOrder(application.payment.orderId);
    if (order?.order_status === 'PAID') {
      return (await markApplicationPaid({ orderId: application.payment.orderId })) || application;
    }
  } catch (err) {
    logger.warn({ err: err.message, orderId: application.payment.orderId }, 'application payment reconcile failed');
  }
  return application;
}

/** Move an application through the funnel, keeping an audit trail. */
export async function setStatus(application, next, user) {
  const from = application.status;
  if (from === next) return application;
  application.status = next;
  application.statusHistory.push({ from, to: next, by: user._id, byName: user.name, at: new Date() });
  await application.save();
  return application;
}

export default {
  applicationConfig,
  saveApplicationConfig,
  paymentRequired,
  gatewayPayment,
  findLiveApplication,
  createApplication,
  startApplicationCheckout,
  markApplicationPaid,
  reconcileApplicationPayment,
  notifyApplicationReceived,
  setPaymentStatus,
  setStatus,
};
