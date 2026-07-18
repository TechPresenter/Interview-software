import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * The activation core: applyPaidPlan is the single function that turns money
 * into access. Everything a customer pays for funnels through it — from the
 * webhook AND from the return-page verify — so the properties below are the
 * whole billing contract:
 *
 *  - both event spellings activate ({ company, plan } from parseEvent,
 *    { companyId, planKey } from the verify endpoints). The mismatch between
 *    them is exactly the "paid but still on free" bug this service fixed.
 *  - a retried delivery must never double-record the payment or re-number the
 *    invoice. Idempotency is keyed the same way the Payment indexes are:
 *    provider+paymentId first, provider+orderId (paid rows only) as backstop.
 *  - the GST snapshot is frozen at payment time and never changes the amount
 *    charged (prices are GST-inclusive).
 *
 * Like the rest of this suite, no live Mongo is assumed: the model statics are
 * replaced with an in-memory store that mirrors the two partial unique indexes
 * on Payment. The last describe block pins those indexes on the real schema so
 * the simulation and the schema cannot drift apart silently.
 */

const H = vi.hoisted(() => ({
  settings: {},
  notify: vi.fn(async () => null),
  safeSendTemplated: vi.fn(async () => null),
  audit: vi.fn(async () => {}),
  logActivity: vi.fn(async () => null),
  emitToCompany: vi.fn(),
}));

// settings.service reads through Redis; stub it so these tests describe the
// billing rules rather than the cache.
vi.mock('../src/services/settings.service.js', () => ({
  getSetting: vi.fn(async (key, fallback) => (key in H.settings ? H.settings[key] : fallback)),
  setMany: vi.fn(async () => []),
  getGroup: vi.fn(async () => []),
}));
// The trail and the emails are best-effort side channels — recorded here so we
// can assert they FIRE, stubbed so a mail/socket problem can't fail activation
// tests (which is also the production contract: safeSendTemplated never throws).
vi.mock('../src/services/audit.service.js', () => ({
  audit: H.audit,
  logActivity: H.logActivity,
  default: H.audit,
}));
vi.mock('../src/services/notification.service.js', () => ({ notify: H.notify, default: H.notify }));
vi.mock('../src/services/email.service.js', () => ({
  safeSendTemplated: H.safeSendTemplated,
  formatMoney: (amount, currency = 'INR') => `${currency} ${(Number(amount) || 0) / 100}`,
}));
vi.mock('../src/socket/emitters.js', () => ({
  emitToUser: vi.fn(),
  emitToCompany: H.emitToCompany,
  emitToInterview: vi.fn(),
  default: {},
}));
// Keeps pdfkit/exceljs out of the test graph; the PDF rides the receipt email.
vi.mock('../src/services/export.service.js', () => ({
  invoiceToPdf: vi.fn(async () => ({ filename: 'invoice.pdf', buffer: Buffer.from('pdf') })),
}));

const { Payment } = await import('../src/models/Payment.js');
const { Company } = await import('../src/models/Company.js');
const { Plan } = await import('../src/models/Plan.js');
const { Subscription } = await import('../src/models/Subscription.js');
const { User } = await import('../src/models/User.js');
const { Branding } = await import('../src/models/Branding.js');
const { Coupon } = await import('../src/models/Coupon.js');
const { applyPaidPlan } = await import('../src/services/payment/index.js');

const oid = () => new mongoose.Types.ObjectId();

/** The in-memory "database" the model statics read and write. */
const db = { payments: [], companies: [], plans: [], subscriptions: [], admins: [] };

/** Equality-and-regex filter matcher — enough for every query the service makes. */
const matches = (doc, filter) =>
  Object.entries(filter).every(([k, v]) =>
    v instanceof RegExp ? v.test(String(doc[k] ?? '')) : String(doc[k] ?? '') === String(v ?? ''));

const dup = (name) => Object.assign(new Error(`E11000 duplicate key: ${name}`), { code: 11000 });

/** A Payment doc whose save() enforces the one-paid-row-per-order index. */
function paymentDoc(data) {
  return {
    _id: oid(),
    status: 'created',
    currency: 'INR',
    ...data,
    save: vi.fn(async function save() {
      if (this.status === 'paid' && this.providerOrderId) {
        const clash = db.payments.find(
          (p) => p !== this && p.status === 'paid' && p.provider === this.provider && p.providerOrderId === this.providerOrderId,
        );
        if (clash) throw dup('one_paid_per_order');
      }
      return this;
    }),
  };
}

const PRO_LIMITS = { seats: 25, activeJobs: 25, interviewsPerMonth: 300, aiTokensPerMonth: 5_000_000 };
const FREE_LIMITS = { seats: 3, activeJobs: 3, interviewsPerMonth: 50, aiTokensPerMonth: 500_000 };

function seedCompany(over = {}) {
  const doc = {
    _id: oid(),
    name: 'Acme Talent',
    slug: `acme-${db.companies.length}`,
    plan: 'free',
    limits: { ...FREE_LIMITS },
    save: vi.fn(async function save() { return this; }),
    ...over,
  };
  db.companies.push(doc);
  return doc;
}

function seedPlan(over = {}) {
  const doc = {
    _id: oid(),
    key: 'professional',
    name: 'Professional',
    pricing: { monthly: 999900, yearly: 9999000, currency: 'INR' },
    limits: { ...PRO_LIMITS },
    isActive: true,
    ...over,
  };
  db.plans.push(doc);
  return doc;
}

let seq = 0;
/** A paid-event payload as the cashfree webhook parser emits it. */
const evt = (over = {}) => ({
  provider: 'cashfree',
  amount: 999900,
  currency: 'INR',
  billingCycle: 'monthly',
  providerPaymentId: `pay_${++seq}`,
  providerOrderId: `order_${++seq}`,
  method: 'upi',
  raw: { source: 'test' },
  ...over,
});

// nanoid's default alphabet includes '-' and '_', uppercased by the service.
const INVOICE_RE = /^INV-\d{4}-[A-Z0-9_-]{8}$/;

beforeEach(() => {
  vi.clearAllMocks();
  H.settings = {};
  db.payments = [];
  db.companies = [];
  db.plans = [];
  db.subscriptions = [];
  db.admins = [];

  // Statics over the in-memory store, mirroring the real partial unique index:
  // provider+providerPaymentId is only constrained when the id is non-empty.
  Payment.create = vi.fn(async (data) => {
    if (data.providerPaymentId) {
      const clash = db.payments.find((p) => p.provider === data.provider && p.providerPaymentId === data.providerPaymentId);
      if (clash) throw dup('one_per_provider_payment');
    }
    const doc = paymentDoc(data);
    db.payments.push(doc);
    return doc;
  });
  Payment.findOne = vi.fn(async (filter) => db.payments.find((p) => matches(p, filter)) ?? null);
  /**
   * The atomic finalize gate: only a row NOT yet 'paid' matches, and flipping
   * it to 'paid' enforces the one_paid_per_order partial unique index — the
   * same two behaviours the production index + findOneAndUpdate give.
   */
  Payment.findOneAndUpdate = vi.fn(async (filter, update) => {
    const doc = db.payments.find(
      (p) => String(p._id) === String(filter._id) && (filter.status?.$ne === undefined || p.status !== filter.status.$ne),
    );
    if (!doc) return null;
    const $set = update.$set || {};
    if ($set.status === 'paid' && (doc.providerOrderId || $set.providerOrderId)) {
      const orderId = $set.providerOrderId || doc.providerOrderId;
      const clash = db.payments.find((p) => p !== doc && p.status === 'paid' && p.provider === doc.provider && p.providerOrderId === orderId);
      if (clash) throw dup('one_paid_per_order');
    }
    Object.assign(doc, $set);
    return doc;
  });
  /** The best-effort attach of a late-learned gateway payment id. */
  Payment.updateOne = vi.fn(async (filter, update) => {
    const doc = db.payments.find(
      (p) => String(p._id) === String(filter._id) && (filter.providerPaymentId?.$exists !== false || p.providerPaymentId === undefined),
    );
    if (doc) Object.assign(doc, update.$set || {});
    return { modifiedCount: doc ? 1 : 0 };
  });
  Coupon.updateOne = vi.fn(async () => ({ modifiedCount: 0 }));
  Company.findById = vi.fn(async (id) => db.companies.find((c) => String(c._id) === String(id)) ?? null);
  Plan.findOne = vi.fn(async (filter) => db.plans.find((p) => matches(p, filter)) ?? null);
  Subscription.findOneAndUpdate = vi.fn(async ({ company }, { $set }) => {
    let sub = db.subscriptions.find((s) => String(s.company) === String(company));
    if (!sub) {
      sub = { _id: oid(), company };
      db.subscriptions.push(sub);
    }
    Object.assign(sub, $set);
    return sub;
  });
  User.find = vi.fn(() => ({ select: () => ({ lean: async () => db.admins }) }));
  Branding.getGlobal = vi.fn(async () => null);
});

describe('applyPaidPlan · event shapes', () => {
  it('activates from a webhook-shaped event ({ company, plan })', async () => {
    const company = seedCompany();
    seedPlan();

    const res = await applyPaidPlan(evt({ company: company._id, plan: 'professional' }));

    expect(res.duplicate).toBeUndefined();
    // Subscription flipped to the paid plan and marked active.
    expect(res.subscription.plan).toBe('professional');
    expect(res.subscription.status).toBe('active');
    expect(res.subscription.provider).toBe('cashfree');
    // Plan + limits snapshotted onto the company — the very next limit check
    // must see the new quotas, not the free tier's.
    expect(company.plan).toBe('professional');
    expect(company.limits).toEqual(PRO_LIMITS);
    expect(String(company.subscription)).toBe(String(res.subscription._id));
    expect(company.save).toHaveBeenCalled();
    // Payment finalized as a full invoice record.
    expect(res.payment.status).toBe('paid');
    expect(res.payment.invoiceNumber).toMatch(INVOICE_RE);
    expect(res.payment.planKey).toBe('professional');
    expect(res.payment.billingCycle).toBe('monthly');
    expect(res.payment.amount).toBe(999900);
    expect(res.payment.method).toBe('upi');
    expect(res.payment.description).toBe('Professional (monthly)');
    expect(res.payment.paidAt).toBeInstanceOf(Date);
    // No GSTIN configured → no tax block invented.
    expect(res.payment.tax).toBeUndefined();
    // Trail fired; no receipt email because the company has no billing address.
    expect(H.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'billing.activated' }));
    expect(H.emitToCompany).toHaveBeenCalledWith(company._id, 'billing:activated', expect.anything());
    expect(H.safeSendTemplated).not.toHaveBeenCalled();
  });

  it('activates equally from a verify-shaped event ({ companyId, planKey })', async () => {
    const company = seedCompany();
    seedPlan();

    const res = await applyPaidPlan(evt({ companyId: company._id, planKey: 'professional' }));

    expect(res.duplicate).toBeUndefined();
    expect(res.subscription.status).toBe('active');
    expect(res.subscription.plan).toBe('professional');
    expect(company.plan).toBe('professional');
    expect(res.payment.status).toBe('paid');
    expect(res.payment.invoiceNumber).toMatch(INVOICE_RE);
  });

  it('resolves a display-name plan tag regardless of case', async () => {
    // Orders created before checkout metadata carried the key are tagged with
    // the display name ('Professional'); the fallback must match it however it
    // was cased, and the record must still store the canonical KEY.
    const company = seedCompany();
    seedPlan();

    const res = await applyPaidPlan(evt({ company: company._id, plan: 'PROFESSIONAL' }));

    expect(res.subscription.plan).toBe('professional');
    expect(res.payment.planKey).toBe('professional');
    expect(company.plan).toBe('professional');
  });
});

describe('applyPaidPlan · idempotency', () => {
  it('treats a second delivery of the same providerPaymentId as a duplicate', async () => {
    const company = seedCompany();
    seedPlan();
    const base = { company: company._id, plan: 'professional', providerPaymentId: 'pay_dup', providerOrderId: 'order_dup' };

    const first = await applyPaidPlan(evt(base));
    const second = await applyPaidPlan(evt(base));

    expect(second.duplicate).toBe(true);
    // Same row, same invoice — a webhook retry must not re-number the invoice.
    expect(String(second.payment._id)).toBe(String(first.payment._id));
    expect(second.payment.invoiceNumber).toBe(first.payment.invoiceNumber);
    expect(db.payments).toHaveLength(1);
    expect(Payment.create).toHaveBeenCalledTimes(1);
    // The side channels are part of the dedup: no double audit entry.
    expect(H.audit).toHaveBeenCalledTimes(1);
  });

  it('dedups at the order level when the retry carries no payment id', async () => {
    // The verify path sends providerPaymentId: '' when Cashfree returns no
    // attempt row; the paid ORDER is still the same purchase.
    const company = seedCompany();
    seedPlan();

    const first = await applyPaidPlan(
      evt({ company: company._id, plan: 'professional', providerPaymentId: 'pay_1st', providerOrderId: 'order_same' }),
    );
    const second = await applyPaidPlan(
      evt({ companyId: company._id, planKey: 'professional', providerPaymentId: '', providerOrderId: 'order_same' }),
    );

    expect(second.duplicate).toBe(true);
    expect(String(second.payment._id)).toBe(String(first.payment._id));
    expect(db.payments.filter((p) => p.status === 'paid')).toHaveLength(1);
    expect(Payment.create).toHaveBeenCalledTimes(1);
  });
});

describe('applyPaidPlan · validation', () => {
  it('refuses an event with no provider', async () => {
    const company = seedCompany();
    seedPlan();
    await expect(applyPaidPlan(evt({ company: company._id, plan: 'professional', provider: undefined })))
      .rejects.toThrow(/missing its provider/i);
  });

  it('refuses an event with no company tag', async () => {
    seedPlan();
    await expect(applyPaidPlan(evt({ plan: 'professional' }))).rejects.toThrow(/company or plan/i);
  });

  it('refuses an event with no plan tag', async () => {
    const company = seedCompany();
    await expect(applyPaidPlan(evt({ company: company._id }))).rejects.toThrow(/company or plan/i);
  });

  it('refuses tags that resolve to nothing', async () => {
    seedPlan();
    await expect(applyPaidPlan(evt({ company: oid(), plan: 'professional' })))
      .rejects.toThrow(/not found/i);
  });
});

describe('applyPaidPlan · GST snapshot', () => {
  it('freezes an inclusive-price breakdown when a GSTIN is configured', async () => {
    // Settings are stringly-typed; the percent must survive as a number.
    H.settings['billing.gstin'] = '29ABCDE1234F1Z5';
    H.settings['billing.gstPercent'] = '18';
    const company = seedCompany();
    seedPlan();

    const res = await applyPaidPlan(evt({ company: company._id, plan: 'professional' }));

    expect(res.payment.tax).toMatchObject({ percent: 18, gstin: '29ABCDE1234F1Z5' });
    // Prices are GST-INCLUSIVE: the base is backed out of the total, so enabling
    // GST never changes what the customer was charged.
    expect(res.payment.tax.taxable + res.payment.tax.tax).toBe(res.payment.amount);
    expect(res.payment.tax.taxable).toBe(Math.round(999900 / 1.18));
    expect(res.payment.amount).toBe(999900);
  });
});

describe('applyPaidPlan · billing period', () => {
  it('runs a monthly purchase one month, from activation', async () => {
    const company = seedCompany();
    seedPlan();

    const { subscription } = await applyPaidPlan(evt({ company: company._id, plan: 'professional', billingCycle: 'monthly' }));

    const expected = new Date(subscription.currentPeriodStart);
    expected.setMonth(expected.getMonth() + 1);
    expect(subscription.currentPeriodEnd.getTime()).toBe(expected.getTime());
    expect(subscription.billingCycle).toBe('monthly');
  });

  it('runs a yearly purchase one year', async () => {
    const company = seedCompany();
    seedPlan();

    const res = await applyPaidPlan(evt({ company: company._id, plan: 'professional', billingCycle: 'yearly' }));

    const expected = new Date(res.subscription.currentPeriodStart);
    expected.setFullYear(expected.getFullYear() + 1);
    expect(res.subscription.currentPeriodEnd.getTime()).toBe(expected.getTime());
    expect(res.subscription.billingCycle).toBe('yearly');
    expect(res.payment.billingCycle).toBe('yearly');
  });
});

describe('applyPaidPlan · best-effort side channels', () => {
  it('sends the confirmation + receipt and notifies the platform admins', async () => {
    const admin = { _id: oid() };
    db.admins = [admin];
    const company = seedCompany({ billingEmail: 'billing@acme.test' });
    seedPlan();

    const res = await applyPaidPlan(evt({ company: company._id, plan: 'professional' }));

    expect(res.payment.receiptEmail).toBe('billing@acme.test');
    const keys = H.safeSendTemplated.mock.calls.map(([key]) => key);
    expect(keys).toEqual(['subscription_confirmation', 'payment_receipt']);
    // The receipt rides the PDF invoice along.
    const receiptOpts = H.safeSendTemplated.mock.calls[1][1];
    expect(receiptOpts.to).toBe('billing@acme.test');
    expect(receiptOpts.attachments).toHaveLength(1);
    expect(receiptOpts.vars.invoiceNumber).toBe(res.payment.invoiceNumber);
    // Purchase ping to every active super admin.
    expect(H.notify).toHaveBeenCalledTimes(1);
    expect(H.notify.mock.calls[0][0].recipient).toEqual(admin._id);
  });
});

describe('Payment schema · the indexes the dedup relies on', () => {
  // The in-memory store above SIMULATES these two indexes; these assertions pin
  // them on the real schema so the simulation cannot drift from production.
  const indexByName = (name) => Payment.schema.indexes().find(([, opts]) => opts?.name === name);

  it('keeps one row per provider payment id (partial, non-empty only)', () => {
    const entry = indexByName('one_per_provider_payment');
    expect(entry).toBeDefined();
    const [spec, opts] = entry;
    expect(spec).toEqual({ provider: 1, providerPaymentId: 1 });
    expect(opts.unique).toBe(true);
    expect(opts.partialFilterExpression).toEqual({ providerPaymentId: { $exists: true, $gt: '' } });
  });

  it('keeps one PAID row per provider order', () => {
    const entry = indexByName('one_paid_per_order');
    expect(entry).toBeDefined();
    const [spec, opts] = entry;
    expect(spec).toEqual({ provider: 1, providerOrderId: 1 });
    expect(opts.unique).toBe(true);
    expect(opts.partialFilterExpression).toEqual({
      providerOrderId: { $exists: true, $gt: '' },
      status: 'paid',
    });
  });
});
