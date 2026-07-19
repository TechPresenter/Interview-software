import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Email-OTP-gated registration + the hardened reset flow.
 *
 * The contract under test: POST /auth/register creates NOTHING — it stages the
 * signup in Redis and emails a code; only /auth/register/verify (proof the
 * inbox is the caller's) creates the User/Company and issues tokens. These
 * tests drive the real controllers + the real otp util over an in-memory
 * Redis fake, with models/emails/tokens mocked in the house style.
 */

const H = vi.hoisted(() => {
  /** In-memory Redis honouring the subset otp.js uses: EX ttl, NX, EXISTS,
   *  and the compare-and-delete Lua script (emulated faithfully, attempt cap
   *  included, so the burn-after-5-wrong-guesses behaviour is really tested). */
  const store = new Map();
  const redis = {
    set: vi.fn(async (key, value, ...args) => {
      const nx = args.includes('NX');
      if (nx && store.has(key)) return null;
      store.set(key, String(value));
      return 'OK';
    }),
    get: vi.fn(async (key) => store.get(key) ?? null),
    del: vi.fn(async (...keys) => keys.reduce((n, k) => n + (store.delete(k) ? 1 : 0), 0)),
    exists: vi.fn(async (key) => (store.has(key) ? 1 : 0)),
    eval: vi.fn(async (_script, _numKeys, codeKey, attemptsKey, hashArg, maxArg) => {
      const stored = store.get(codeKey);
      if (stored === undefined) return 0;
      if (stored === hashArg) {
        store.delete(codeKey);
        store.delete(attemptsKey);
        return 1;
      }
      const attempts = Number(store.get(attemptsKey) || 0) + 1;
      store.set(attemptsKey, String(attempts));
      if (attempts >= Number(maxArg)) {
        store.delete(codeKey);
        store.delete(attemptsKey);
      }
      return 0;
    }),
  };
  return {
    store,
    redis,
    verification: vi.fn(async () => null),
    welcome: vi.fn(async () => null),
    passwordReset: vi.fn(async () => null),
    safeSendTemplated: vi.fn(async () => null),
    audit: vi.fn(async () => {}),
    issueTokenPair: vi.fn(async () => ({ accessToken: 'at', refreshToken: 'rt' })),
    revokeAllRefreshTokens: vi.fn(async () => {}),
  };
});

vi.mock('../src/config/redis.js', () => ({ redis: H.redis, default: H.redis }));
vi.mock('../src/services/email.service.js', () => ({
  emails: { verification: H.verification, welcome: H.welcome, passwordReset: H.passwordReset, otp: vi.fn() },
  safeSendTemplated: H.safeSendTemplated,
}));
vi.mock('../src/services/audit.service.js', () => ({ audit: H.audit, default: H.audit }));
vi.mock('../src/utils/tokens.js', () => ({
  issueTokenPair: H.issueTokenPair,
  verifyRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllRefreshTokens: H.revokeAllRefreshTokens,
}));
vi.mock('../src/services/file.service.js', () => ({ saveBuffer: vi.fn() }));

const { User } = await import('../src/models/User.js');
const { Company } = await import('../src/models/Company.js');
const auth = await import('../src/controllers/auth.controller.js');

/** Minimal express fakes — the controllers only touch these surfaces. */
const makeReq = (body = {}) => ({ body, ip: '127.0.0.1', get: () => 'vitest' });
function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.cookie = vi.fn(() => res);
  return res;
}
/** asyncHandler swallows into next(err) normally; here we call handlers directly. */
const run = async (handler, body) => {
  const req = makeReq(body);
  const res = makeRes();
  await handler(req, res, (err) => { if (err) throw err; });
  return res;
};

const SIGNUP = { name: 'Asha Rao', email: 'asha@example.com', password: 'S3curePass!', role: 'company_admin', companyName: 'Rao Talent' };

/** The staged code, recovered from the fake redis the way the server stored it. */
const sentCodeFor = (email) => H.verification.mock.calls.find((c) => c[0] === email)?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  H.store.clear();

  User.exists = vi.fn(async () => null);
  User.create = vi.fn(async (data) => ({ _id: 'u1', ...data }));
  User.findOne = vi.fn(async () => null);
  Company.create = vi.fn(async (data) => ({ _id: 'c1', ...data, save: vi.fn(async () => {}) }));
});

describe('POST /auth/register (phase 1)', () => {
  it('stages the signup and emails a code — but creates NO account and NO session', async () => {
    const res = await run(auth.register, { ...SIGNUP });

    expect(res.body.data.pendingVerification).toBe(true);
    expect(User.create).not.toHaveBeenCalled();
    expect(Company.create).not.toHaveBeenCalled();
    expect(H.issueTokenPair).not.toHaveBeenCalled();
    // A 6-digit code went to the address.
    expect(H.verification).toHaveBeenCalledWith(SIGNUP.email, expect.stringMatching(/^\d{6}$/), undefined, SIGNUP.name);
    // Both the staged payload and the hashed code are in Redis.
    expect(H.store.has(`pending:register:${SIGNUP.email}`)).toBe(true);
    expect(H.store.has(`code:register:${SIGNUP.email}`)).toBe(true);
    // The staged password is NOT plaintext at rest.
    expect(H.store.get(`pending:register:${SIGNUP.email}`)).not.toContain(SIGNUP.password);
  });

  it('rejects an already-registered email up front', async () => {
    User.exists = vi.fn(async () => ({ _id: 'existing' }));
    await expect(run(auth.register, { ...SIGNUP })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('a resubmit inside the send window is a 200 pointing at the inbox — one email, not a dead-end 429', async () => {
    await run(auth.register, { ...SIGNUP });
    const res = await run(auth.register, { ...SIGNUP });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pendingVerification).toBe(true);
    expect(res.body.message).toMatch(/already sent/i);
    expect(H.verification).toHaveBeenCalledTimes(1); // the second submit sends no second email
  });

  it('a resubmit with corrected details re-stages them — the first code then creates the CORRECTED account', async () => {
    await run(auth.register, { ...SIGNUP });
    const code = sentCodeFor(SIGNUP.email);
    await run(auth.register, { ...SIGNUP, name: 'Asha R. Corrected', password: 'Different9!' });

    await run(auth.registerVerify, { email: SIGNUP.email, code });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Asha R. Corrected', password: 'Different9!' }));
  });

  it('normalises the email so the code and the verify call meet at one key', async () => {
    await run(auth.register, { ...SIGNUP, email: '  ASHA@Example.com ' });
    expect(H.store.has(`pending:register:${SIGNUP.email}`)).toBe(true);
  });
});

describe('POST /auth/register/verify (phase 2)', () => {
  it('creates the account + workspace only after the right code, verified and signed in', async () => {
    await run(auth.register, { ...SIGNUP });
    const code = sentCodeFor(SIGNUP.email);

    const res = await run(auth.registerVerify, { email: SIGNUP.email, code });

    expect(res.statusCode).toBe(201);
    expect(Company.create).toHaveBeenCalledWith(expect.objectContaining({ name: SIGNUP.companyName }));
    // The original password reaches User.create in the clear so the model's
    // bcrypt pre-save hook hashes it exactly once.
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: SIGNUP.email,
      password: SIGNUP.password,
      isEmailVerified: true,
      role: 'company_admin',
    }));
    expect(H.issueTokenPair).toHaveBeenCalled();
    expect(H.welcome).toHaveBeenCalledWith(SIGNUP.email, SIGNUP.name);
    // Staging consumed: nothing left to replay.
    expect(H.store.has(`pending:register:${SIGNUP.email}`)).toBe(false);
    expect(H.store.has(`code:register:${SIGNUP.email}`)).toBe(false);
  });

  it('creates a plain user (no company, no welcome email) for candidates', async () => {
    await run(auth.register, { name: 'Dev', email: 'dev@example.com', password: 'S3curePass!', role: 'candidate' });
    const res = await run(auth.registerVerify, { email: 'dev@example.com', code: sentCodeFor('dev@example.com') });

    expect(res.statusCode).toBe(201);
    expect(Company.create).not.toHaveBeenCalled();
    expect(H.welcome).not.toHaveBeenCalled();
  });

  it('a wrong code fails but leaves the staged signup intact for a retry', async () => {
    await run(auth.register, { ...SIGNUP });

    await expect(run(auth.registerVerify, { email: SIGNUP.email, code: '000000' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CODE' });
    expect(User.create).not.toHaveBeenCalled();
    expect(H.store.has(`pending:register:${SIGNUP.email}`)).toBe(true);

    // The genuine code still works afterwards.
    const res = await run(auth.registerVerify, { email: SIGNUP.email, code: sentCodeFor(SIGNUP.email) });
    expect(res.statusCode).toBe(201);
  });

  it('an expired / unknown staging is told to start over', async () => {
    await expect(run(auth.registerVerify, { email: 'ghost@example.com', code: '123456' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'REGISTRATION_EXPIRED' });
  });

  it('refuses if the address was registered (e.g. via Google) while the code sat unread', async () => {
    await run(auth.register, { ...SIGNUP });
    const code = sentCodeFor(SIGNUP.email);
    User.exists = vi.fn(async () => ({ _id: 'google-user' }));

    await expect(run(auth.registerVerify, { email: SIGNUP.email, code })).rejects.toMatchObject({ statusCode: 409 });
    expect(User.create).not.toHaveBeenCalled();
    // The dead staging is cleaned up rather than left to confuse a retry.
    expect(H.store.has(`pending:register:${SIGNUP.email}`)).toBe(false);
  });

  it('the code is single-use — replaying it cannot create a second account', async () => {
    await run(auth.register, { ...SIGNUP });
    const code = sentCodeFor(SIGNUP.email);
    await run(auth.registerVerify, { email: SIGNUP.email, code });

    await expect(run(auth.registerVerify, { email: SIGNUP.email, code }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(User.create).toHaveBeenCalledTimes(1);
  });

  it('five wrong guesses burn the code — the genuine one is then useless (brute-force cap)', async () => {
    await run(auth.register, { ...SIGNUP });
    const code = sentCodeFor(SIGNUP.email);

    for (let i = 0; i < 5; i += 1) {
      await expect(run(auth.registerVerify, { email: SIGNUP.email, code: '000000' }))
        .rejects.toMatchObject({ statusCode: 400 });
    }
    // The attacker exhausted the attempt budget; even the REAL code is dead.
    await expect(run(auth.registerVerify, { email: SIGNUP.email, code }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('a staged password that no longer decrypts aborts — never a passwordless account', async () => {
    await run(auth.register, { ...SIGNUP });
    const code = sentCodeFor(SIGNUP.email);
    // Simulate an AES key rotation between the phases: the blob stops decrypting.
    const key = `pending:register:${SIGNUP.email}`;
    const staged = JSON.parse(H.store.get(key));
    staged.password = 'enc:v1:corrupted-beyond-recovery';
    H.store.set(key, JSON.stringify(staged));

    await expect(run(auth.registerVerify, { email: SIGNUP.email, code }))
      .rejects.toMatchObject({ statusCode: 400, code: 'REGISTRATION_EXPIRED' });
    expect(User.create).not.toHaveBeenCalled();
  });
});

describe('forgot / reset password', () => {
  const userDoc = () => ({
    _id: 'u9',
    name: 'Asha Rao',
    email: SIGNUP.email,
    tokenVersion: 0,
    save: vi.fn(async function save() { return this; }),
  });

  it('sends a reset code, then answers identically (and silently) inside the cooldown window', async () => {
    User.findOne = vi.fn(async () => userDoc());

    const first = await run(auth.forgotPassword, { email: SIGNUP.email });
    const second = await run(auth.forgotPassword, { email: SIGNUP.email });

    expect(H.passwordReset).toHaveBeenCalledTimes(1); // second send suppressed
    // Same enumeration-safe 200 either way — the cooldown must not leak state.
    expect(first.body.message).toBe(second.body.message);
  });

  it('resets the password with the emailed code, revokes sessions, and confirms by email', async () => {
    const user = userDoc();
    User.findOne = vi.fn(async () => user);

    await run(auth.forgotPassword, { email: SIGNUP.email });
    const code = H.passwordReset.mock.calls[0][1];
    const res = await run(auth.resetPassword, { email: SIGNUP.email, code, password: 'N3wPassword!' });

    expect(res.statusCode).toBe(200);
    expect(user.password).toBe('N3wPassword!');
    expect(user.tokenVersion).toBe(1);
    expect(H.revokeAllRefreshTokens).toHaveBeenCalledWith('u9');
    expect(H.safeSendTemplated).toHaveBeenCalledWith('password_changed', expect.objectContaining({ to: SIGNUP.email }));
  });

  it('rejects a wrong reset code without touching the password', async () => {
    const user = userDoc();
    User.findOne = vi.fn(async () => user);
    await run(auth.forgotPassword, { email: SIGNUP.email });

    await expect(run(auth.resetPassword, { email: SIGNUP.email, code: '000000', password: 'N3wPassword!' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(user.password).toBeUndefined();
    expect(H.safeSendTemplated).not.toHaveBeenCalled();
  });
});
