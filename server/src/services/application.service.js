import crypto from 'node:crypto';
import { Application } from '../models/Application.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { getSetting, setMany } from './settings.service.js';

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
  paymentUrl: 'applications.paymentUrl',
  fee: 'applications.fee',
  currency: 'applications.currency',
  declarationText: 'applications.declarationText',
  paymentInstructions: 'applications.paymentInstructions',
};

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
  const [enabled, paymentUrl, fee, currency, declarationText, paymentInstructions] = await Promise.all([
    getSetting(SETTING_KEYS.enabled, true),
    getSetting(SETTING_KEYS.paymentUrl, ''),
    getSetting(SETTING_KEYS.fee, 0),
    getSetting(SETTING_KEYS.currency, 'INR'),
    getSetting(SETTING_KEYS.declarationText, DEFAULT_DECLARATION),
    getSetting(SETTING_KEYS.paymentInstructions, ''),
  ]);
  return {
    enabled: enabled !== false, // open unless explicitly switched off
    paymentUrl: paymentUrl || '',
    fee: Number(fee) || 0,
    currency: currency || 'INR',
    declarationText: declarationText || DEFAULT_DECLARATION,
    // Shown above the Pay Now button, so the admin can explain "pay by UPI to
    // ..., then paste the UTR below" without a code change.
    paymentInstructions: paymentInstructions || '',
  };
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
    .select('applicationId status email mobile submittedAt')
    .lean();
}

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
  if (existing) {
    throw ApiError.conflict(
      `You already have an application (${existing.applicationId}) under review. We'll be in touch — no need to apply again.`,
      { code: 'DUPLICATE_APPLICATION', applicationId: existing.applicationId },
    );
  }

  // The applicant's payment claim is recorded, never believed. `claimed` says
  // "they typed a reference"; only an admin moves it to `verified`.
  const reference = data.paymentReference?.trim();
  const payment = {
    status: reference ? 'claimed' : 'unpaid',
    reference: reference || undefined,
    // Freeze the fee as it stood when they applied — the admin may change it
    // tomorrow, and this application must still say what it asked for.
    amount: config.fee,
    currency: config.currency,
    claimedAt: reference ? new Date() : undefined,
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
  findLiveApplication,
  createApplication,
  setPaymentStatus,
  setStatus,
};
