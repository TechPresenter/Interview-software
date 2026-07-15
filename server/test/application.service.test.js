import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * The Apply-for-Interview rules that are not the route's job.
 *
 * Three things here are load-bearing, and each is one quiet line away from being
 * wrong in a way nothing would report:
 *
 *  - the gap between "the applicant says they paid" and "we know they did". The
 *    Pay Now button is a redirect to an admin-configured URL, so nothing ever
 *    comes back to confirm anything. If `claimed` ever reads as paid, the PDF
 *    prints "Paid" on a stranger's say-so.
 *  - one live application per person, which must hold across a race, not just
 *    across a findOne().
 *  - the application id, which is quoted over the phone and must never be
 *    handed to two people.
 */

const H = vi.hoisted(() => ({ settings: {}, setMany: vi.fn(async () => []) }));

// settings.service reads through Redis; stub it so these tests describe the
// rules rather than the cache.
vi.mock('../src/services/settings.service.js', () => ({
  getSetting: vi.fn(async (key, fallback) => (key in H.settings ? H.settings[key] : fallback)),
  setMany: H.setMany,
}));

const { Application } = await import('../src/models/Application.js');
const svc = await import('../src/services/application.service.js');

const FILES = {
  resume: { filename: 'a1b2.pdf', originalName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
  photo: { filename: 'c3d4.jpg', originalName: 'me.jpg', mimeType: 'image/jpeg', sizeBytes: 512 },
};
const DATA = { fullName: 'Asha Rao', email: 'Asha@Example.com', mobile: '9876543210' };

beforeEach(() => {
  H.settings = {};
  vi.clearAllMocks();
  Application.create = vi.fn(async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId() }));
  Application.findOne = vi.fn(() => ({
    sort: () => ({ select: () => ({ lean: async () => null }) }),
    select: () => ({ lean: async () => null }),
  }));
});

describe('applicationConfig', () => {
  it('is open by default', async () => {
    // A fresh install with nothing configured must still accept applications;
    // `enabled` is opt-out, not opt-in.
    expect((await svc.applicationConfig()).enabled).toBe(true);
  });

  it('is closed only when explicitly switched off', async () => {
    H.settings['applications.enabled'] = false;
    expect((await svc.applicationConfig()).enabled).toBe(false);
  });

  it('carries a declaration even when the admin never wrote one', async () => {
    // The declaration is frozen onto every application. A blank default would
    // record that the applicant agreed to nothing.
    const c = await svc.applicationConfig();
    expect(c.declarationText).toMatch(/accurate and complete/i);
  });

  it('reads the admin values', async () => {
    Object.assign(H.settings, {
      'applications.paymentUrl': 'https://pay.example/x',
      'applications.fee': '499',
      'applications.currency': 'USD',
    });
    const c = await svc.applicationConfig();
    expect(c.paymentUrl).toBe('https://pay.example/x');
    expect(c.fee).toBe(499); // settings are stringly-typed; the fee must be a number
    expect(c.currency).toBe('USD');
  });

  it('never returns a NaN fee', async () => {
    H.settings['applications.fee'] = 'free';
    expect((await svc.applicationConfig()).fee).toBe(0);
  });

  it('saveApplicationConfig writes only the fields it was given', async () => {
    await svc.saveApplicationConfig({ paymentUrl: 'https://x.test' }, 'u1');
    const [, entries] = H.setMany.mock.calls[0];
    expect(entries).toEqual([{ key: 'applications.paymentUrl', value: 'https://x.test' }]);
  });

  it('saveApplicationConfig can switch applications off (false is not "absent")', async () => {
    // A `patch[field] || skip` filter would drop `false` and silently refuse to
    // ever close applications.
    await svc.saveApplicationConfig({ enabled: false }, 'u1');
    const [, entries] = H.setMany.mock.calls[0];
    expect(entries).toEqual([{ key: 'applications.enabled', value: false }]);
  });

  it('saveApplicationConfig writes nothing when given nothing', async () => {
    await svc.saveApplicationConfig({}, 'u1');
    expect(H.setMany).not.toHaveBeenCalled();
  });
});

describe('createApplication', () => {
  it('refuses when applications are closed', async () => {
    H.settings['applications.enabled'] = false;
    await expect(svc.createApplication(DATA, FILES, {})).rejects.toThrow(/closed/i);
  });

  it('records a payment reference as a CLAIM, never as paid', async () => {
    H.settings['applications.fee'] = 499;
    const app = await svc.createApplication({ ...DATA, paymentReference: 'UTR999' }, FILES, {});
    expect(app.payment.status).toBe('claimed');
    expect(app.payment.reference).toBe('UTR999');
    expect(app.payment.verifiedAt).toBeUndefined();
    expect(app.payment.verifiedBy).toBeUndefined();
  });

  it('is unpaid when no reference was given', async () => {
    const app = await svc.createApplication(DATA, FILES, {});
    expect(app.payment.status).toBe('unpaid');
  });

  it('freezes the fee as it stood at submission', async () => {
    // The admin may change the fee tomorrow; this application must still say
    // what it charged.
    H.settings['applications.fee'] = 499;
    const app = await svc.createApplication(DATA, FILES, {});
    expect(app.payment.amount).toBe(499);
    H.settings['applications.fee'] = 999;
    expect(app.payment.amount).toBe(499);
  });

  it('freezes the declaration wording the applicant actually agreed to', async () => {
    H.settings['applications.declarationText'] = 'I agree to the 2026 terms.';
    const app = await svc.createApplication(DATA, FILES, {});
    expect(app.declaration.text).toBe('I agree to the 2026 terms.');
    expect(app.declaration.accepted).toBe(true);
    expect(app.declaration.acceptedAt).toBeInstanceOf(Date);
  });

  it('ignores a client-supplied status or payment status', async () => {
    // The body is attacker-controlled. Submitting { status: 'selected' } must
    // not select you, and { payment: { status: 'verified' } } must not pay you.
    const app = await svc.createApplication(
      { ...DATA, status: 'selected', payment: { status: 'verified' }, applicationId: 'AIPL-0000-000001' },
      FILES,
      {},
    );
    expect(app.status).toBe('pending');
    expect(app.payment.status).toBe('unpaid');
    expect(app.applicationId).not.toBe('AIPL-0000-000001');
  });

  it('does not persist paymentReference as a stray field', async () => {
    const app = await svc.createApplication({ ...DATA, paymentReference: 'UTR1' }, FILES, {});
    expect(app.paymentReference).toBeUndefined(); // it belongs under payment.reference
  });

  it('mints a readable, year-scoped application id', async () => {
    const app = await svc.createApplication(DATA, FILES, {});
    expect(app.applicationId).toMatch(new RegExp(`^AIPL-${new Date().getFullYear()}-\\d{6}$`));
  });

  it('continues the sequence from the highest existing id, not a count', async () => {
    // countDocuments would re-issue a deleted application's number.
    Application.findOne = vi.fn(() => ({
      sort: () => ({ select: () => ({ lean: async () => ({ applicationId: `AIPL-${new Date().getFullYear()}-000041` }) }) }),
      select: () => ({ lean: async () => null }),
    }));
    const app = await svc.createApplication(DATA, FILES, {});
    expect(app.applicationId).toBe(`AIPL-${new Date().getFullYear()}-000042`);
  });

  it('gives every application an unguessable verification code', async () => {
    const a = await svc.createApplication(DATA, FILES, {});
    const b = await svc.createApplication({ ...DATA, email: 'b@x.com' }, FILES, {});
    expect(a.verificationCode).not.toBe(b.verificationCode);
    expect(a.verificationCode.length).toBeGreaterThanOrEqual(12);
    // It must not be derivable from the id, which is printed and emailed.
    expect(a.verificationCode).not.toContain(a.applicationId);
  });

  it('retries a colliding application id instead of failing the applicant', async () => {
    let calls = 0;
    Application.create = vi.fn(async (doc) => {
      calls += 1;
      if (calls === 1) {
        const e = new Error('dup'); e.code = 11000; e.keyPattern = { applicationId: 1 };
        throw e;
      }
      return doc;
    });
    const app = await svc.createApplication(DATA, FILES, {});
    expect(calls).toBe(2);
    expect(app.applicationId).toMatch(/000002$/); // the attempt offset moved it on
  });

  it('turns the duplicate index into a sentence the applicant can act on', async () => {
    Application.create = vi.fn(async () => {
      const e = new Error('dup'); e.code = 11000; e.keyPattern = { email: 1 };
      throw e;
    });
    await expect(svc.createApplication(DATA, FILES, {})).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('blocks a second live application and names the first', async () => {
    Application.findOne = vi.fn(() => ({
      sort: () => ({ select: () => ({ lean: async () => null }) }),
      select: () => ({ lean: async () => ({ applicationId: 'AIPL-2026-000007', status: 'under_review' }) }),
    }));
    await expect(svc.createApplication(DATA, FILES, {})).rejects.toThrow(/AIPL-2026-000007/);
  });

  it('keeps the submission trail without exposing it', async () => {
    const app = await svc.createApplication(DATA, FILES, { ip: '1.2.3.4', userAgent: 'UA' });
    expect(app.submittedIp).toBe('1.2.3.4');
    // select:false is what keeps it out of responses — asserted in the model test.
  });

  it('stores the files with no url', async () => {
    // A url would mean the public /uploads path, i.e. a stranger's photo and CV
    // fetchable forever by anyone who ever sees the link.
    const app = await svc.createApplication(DATA, FILES, {});
    expect(app.resume.filename).toBe('a1b2.pdf');
    expect(app.resume.url).toBeUndefined();
    expect(app.photo.url).toBeUndefined();
  });
});

describe('findLiveApplication', () => {
  it('only counts applications still in play', async () => {
    await svc.findLiveApplication({ email: 'a@b.c' });
    const [filter] = Application.findOne.mock.calls[0];
    // A rejected applicant is allowed to apply again.
    expect(filter.status.$in).toEqual(['pending', 'under_review', 'shortlisted', 'selected']);
    expect(filter.status.$in).not.toContain('rejected');
  });

  it('matches on either email or mobile', async () => {
    await svc.findLiveApplication({ email: 'A@B.c', mobile: ' 99 ' });
    const [filter] = Application.findOne.mock.calls[0];
    expect(filter.$or).toEqual([{ email: 'a@b.c' }, { mobile: '99' }]);
  });

  it('returns null rather than matching everyone when given nothing', async () => {
    // A bare {} filter would find the newest live application and lock the form
    // for every applicant.
    expect(await svc.findLiveApplication({})).toBeNull();
    expect(Application.findOne).not.toHaveBeenCalled();
  });
});

describe('setPaymentStatus', () => {
  const app = () => ({ payment: {}, save: vi.fn(async function () { return this; }) });
  const user = { _id: 'u1', name: 'Admin' };

  it('stamps who verified it and when', async () => {
    const a = app();
    await svc.setPaymentStatus(a, { status: 'verified' }, user);
    expect(a.payment.status).toBe('verified');
    expect(a.payment.verifiedBy).toBe('u1');
    expect(a.payment.verifiedAt).toBeInstanceOf(Date);
  });

  it('treats a waiver as a decision someone made', async () => {
    const a = app();
    await svc.setPaymentStatus(a, { status: 'waived', note: 'partner referral' }, user);
    expect(a.payment.verifiedBy).toBe('u1');
    expect(a.payment.note).toBe('partner referral');
  });

  it('clears the verification when a payment is un-verified', async () => {
    // Otherwise the record keeps claiming a human approved it.
    const a = app();
    await svc.setPaymentStatus(a, { status: 'verified' }, user);
    await svc.setPaymentStatus(a, { status: 'failed', note: 'no such UTR' }, user);
    expect(a.payment.status).toBe('failed');
    expect(a.payment.verifiedAt).toBeUndefined();
    expect(a.payment.verifiedBy).toBeUndefined();
  });
});

describe('setStatus', () => {
  const user = { _id: 'u1', name: 'Admin' };
  const app = () => ({ status: 'pending', statusHistory: [], save: vi.fn(async function () { return this; }) });

  it('records who moved it and from where', async () => {
    const a = app();
    await svc.setStatus(a, 'shortlisted', user);
    expect(a.status).toBe('shortlisted');
    expect(a.statusHistory).toHaveLength(1);
    expect(a.statusHistory[0]).toMatchObject({ from: 'pending', to: 'shortlisted', by: 'u1', byName: 'Admin' });
  });

  it('does not log a no-op', async () => {
    const a = app();
    await svc.setStatus(a, 'pending', user);
    expect(a.statusHistory).toHaveLength(0);
    expect(a.save).not.toHaveBeenCalled();
  });
});
