import { getSetting, setMany } from './settings.service.js';
import { config } from '../config/index.js';

/**
 * Admin-editable seller identity for invoices + GST.
 *
 * Lives in Settings so the finance details on an invoice — legal name, address,
 * GSTIN, the tax rate, the terms paragraph — can change without a deploy. The
 * env vars (GST_NUMBER / GST_PERCENT) remain as DEFAULTS so an existing install
 * keeps its behaviour until an admin first saves this panel.
 *
 * Key naming: none of these may contain 'key'/'secret'/'pass' — the settings
 * screen masks values whose KEY matches that pattern, and a masked value that
 * round-trips through the generic editor is dropped on save.
 */
const SETTINGS_GROUP = 'billing';

export const SETTING_KEYS = {
  legalName: 'billing.legalName',
  address: 'billing.address',
  gstin: 'billing.gstin',
  gstPercent: 'billing.gstPercent',
  phone: 'billing.phone',
  email: 'billing.email',
  website: 'billing.website',
  terms: 'billing.terms',
};

const DEFAULT_TERMS =
  'This is a system-generated invoice for a prepaid subscription. ' +
  'Payments are subject to the refund policy published on our website. ' +
  'For billing queries, contact us at the address above quoting the invoice number.';

/** The seller block an invoice prints, merged over env defaults. */
export async function billingIdentity() {
  const [legalName, address, gstin, gstPercent, phone, email, website, terms] = await Promise.all([
    getSetting(SETTING_KEYS.legalName, ''),
    getSetting(SETTING_KEYS.address, ''),
    getSetting(SETTING_KEYS.gstin, config.billing.gstin),
    getSetting(SETTING_KEYS.gstPercent, config.billing.gstPercent),
    getSetting(SETTING_KEYS.phone, ''),
    getSetting(SETTING_KEYS.email, ''),
    getSetting(SETTING_KEYS.website, ''),
    getSetting(SETTING_KEYS.terms, DEFAULT_TERMS),
  ]);
  return {
    legalName: legalName || '',
    address: address || '',
    gstin: gstin || '',
    // GST applies only when a GSTIN exists — a rate with no registration is noise.
    gstPercent: gstin ? Number(gstPercent) || 0 : 0,
    phone: phone || '',
    email: email || '',
    website: website || '',
    terms: terms || DEFAULT_TERMS,
  };
}

/**
 * The GST snapshot applyPaidPlan freezes onto each Payment (minor units).
 * Prices are GST-inclusive, so the taxable base is backed out of the total —
 * enabling GST never changes what the customer was charged.
 */
export function gstBreakdown(amount, identity) {
  const pct = identity?.gstin ? Number(identity.gstPercent) || 0 : 0;
  if (!pct || !amount) return undefined;
  const taxable = Math.round(amount / (1 + pct / 100));
  return { percent: pct, taxable, tax: amount - taxable, gstin: identity.gstin };
}

/** Persist the admin's changes (PATCH semantics — only supplied keys move). */
export async function saveBillingConfig(patch, userId) {
  const entries = Object.entries(SETTING_KEYS)
    .filter(([field]) => patch[field] !== undefined)
    .map(([field, key]) => ({ key, value: patch[field] }));
  if (entries.length) await setMany(SETTINGS_GROUP, entries, userId);
  return billingIdentity();
}

export default { billingIdentity, gstBreakdown, saveBillingConfig, SETTING_KEYS };
