import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * KB → questions. The cases that matter are the ones that used to be silent: a KB
 * whose only source was a scanned PDF ingested as empty text and then generated
 * nothing, reporting "AI question generation is not working" when the truth was
 * "your upload has no text layer". The unreadable source must be NAMED.
 */

// vi.mock is hoisted above module-level consts, so every stub it closes over must
// be hoisted too — otherwise the factory runs first, binds undefined, and the mock
// silently fails to take effect.
const { findOne, insertMany, generateQuestions, isAiConfigured, audit } = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertMany: vi.fn(),
  generateQuestions: vi.fn(),
  isAiConfigured: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('../src/models/KnowledgeBase.js', () => ({ KnowledgeBase: { findOne } }));
vi.mock('../src/models/Question.js', () => ({ Question: { insertMany } }));
vi.mock('../src/services/ai/question.generator.js', () => ({ generateQuestions }));
vi.mock('../src/services/ai/ai.status.js', () => ({ isAiConfigured }));
vi.mock('../src/services/audit.service.js', () => ({ audit }));

const kbController = await import('../src/controllers/knowledgeBase.controller.js');

const COMPANY = '507f1f77bcf86cd799439011';

/** findOne(...).select('+content +chunks') — resolve the doc at the end of the chain. */
function mockKb(doc) {
  findOne.mockReturnValue({ select: () => Promise.resolve(doc) });
}

function makeKb(over = {}) {
  return {
    _id: 'kb1',
    name: 'Payments Handbook',
    status: 'active',
    content: 'Settlement runs nightly at 02:00 UTC.\n\nRefunds are reversed against the original instrument.',
    chunks: [
      { text: 'Settlement runs nightly at 02:00 UTC.' },
      { text: 'Refunds are reversed against the original instrument.' },
    ],
    sources: [{ kind: 'text', label: 'Pasted text', chars: 96 }],
    jobRole: 'Payments Engineer',
    department: 'Engineering',
    skills: ['settlement'],
    experienceLevel: 'senior',
    difficulty: 'hard',
    language: 'both',
    topics: ['settlement', 'refunds'],
    ...over,
  };
}

const QUESTION = {
  text: 'Walk me through what happens to a refund issued after the nightly settlement run.',
  type: 'technical',
  difficulty: 'hard',
  skills: ['settlement'],
};

/** Minimal express doubles; the handler only ever calls res.status().json(). */
function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(c) {
      res.statusCode = c;
      return res;
    },
    json(b) {
      res.body = b;
      return res;
    },
  };
  return res;
}

const makeReq = (body = {}) => ({
  params: { id: 'kb1' },
  companyId: COMPANY,
  user: { _id: 'u1', role: 'company_admin', company: COMPANY },
  body,
});

/** asyncHandler forwards a rejection to next(); surface it as a throw instead. */
async function run(req, res) {
  let err = null;
  await kbController.generateQuestions(req, res, (e) => {
    err = e;
  });
  if (err) throw err;
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  isAiConfigured.mockResolvedValue(true);
  generateQuestions.mockResolvedValue({ questions: [QUESTION], dropped: 0, reasons: {} });
  insertMany.mockImplementation(async (docs) => docs.map((d, i) => ({ ...d, _id: `q${i}` })));
});

describe('knowledgeBase · generate-questions', () => {
  it('refuses a KB with no readable content and names the unreadable source', async () => {
    mockKb(makeKb({
      content: '',
      chunks: [],
      sources: [
        { kind: 'file', label: 'handbook-scan.pdf', chars: 0, error: 'bad XRef entry' },
        { kind: 'file', label: 'notes.docx', chars: 0, error: null },
      ],
    }));

    await expect(run(makeReq(), makeRes())).rejects.toMatchObject({
      statusCode: 400,
      code: 'KB_NO_CONTENT',
    });

    // The whole point of the guard: the operator learns WHICH file failed and why.
    const err = await run(makeReq(), makeRes()).catch((e) => e);
    expect(err.message).toContain('handbook-scan.pdf');
    expect(err.message).toContain('bad XRef entry');
    expect(err.message).toContain('notes.docx');
    expect(err.message).toMatch(/no readable text/);
    expect(err.details.sources).toHaveLength(2);
    expect(generateQuestions).not.toHaveBeenCalled();
  });

  it('tells an operator with an empty KB to add a source', async () => {
    mockKb(makeKb({ content: '', chunks: [], sources: [] }));
    const err = await run(makeReq(), makeRes()).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/no sources yet/i);
  });

  it('passes the KB text to the generator as the relevance anchor', async () => {
    mockKb(makeKb());
    await run(makeReq({ types: ['mcq'], count: 5 }), makeRes());

    expect(generateQuestions).toHaveBeenCalledTimes(1);
    const [input, opts] = generateQuestions.mock.calls[0];
    expect(input.knowledge).toContain('Settlement runs nightly at 02:00 UTC.');
    expect(input.knowledge).toContain('Refunds are reversed against the original instrument.');
    expect(opts).toEqual({ companyId: COMPANY });
    // KB taxonomy fills what the request omits.
    expect(input.jobTitle).toBe('Payments Engineer');
    expect(input.department).toBe('Engineering');
    expect(input.experienceLevel).toBe('senior');
    // KB_LANGUAGES 'both' is Question.language's 'bilingual'; passing 'both' through
    // would write a value the enum rejects.
    expect(input.language).toBe('bilingual');
    expect(input.types).toEqual(['mcq']);
  });

  it('lets the request override the KB taxonomy', async () => {
    mockKb(makeKb());
    await run(makeReq({ jobTitle: 'Staff Engineer', skills: ['reconciliation'], difficulty: 'easy' }), makeRes());
    const [input] = generateQuestions.mock.calls[0];
    expect(input.jobTitle).toBe('Staff Engineer');
    expect(input.skills).toEqual(['reconciliation']);
    expect(input.difficulty).toBe('easy');
  });

  it('previews without writing anything to the bank', async () => {
    mockKb(makeKb());
    const res = await run(makeReq({ count: 3 }), makeRes());

    expect(insertMany).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.data.questions).toHaveLength(1);
    expect(res.body.message).toMatch(/nothing saved/i);
  });

  it('saves as pending_review from source ai, tagged with the KB it came from', async () => {
    mockKb(makeKb());
    const res = await run(makeReq({ save: true }), makeRes());

    expect(insertMany).toHaveBeenCalledTimes(1);
    const [docs, options] = insertMany.mock.calls[0];
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      text: QUESTION.text,
      company: COMPANY,
      knowledgeBase: 'kb1',
      status: 'pending_review',
      source: 'ai',
      isPublic: false,
      createdBy: 'u1',
    });
    expect(options).toEqual({ ordered: false });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.inserted).toBe(1);
  });

  it('is scoped to the caller’s tenant', async () => {
    mockKb(makeKb());
    await run(makeReq(), makeRes());
    expect(findOne).toHaveBeenCalledWith({ _id: 'kb1', company: COMPANY });
  });

  it('404s when the KB belongs to another company', async () => {
    mockKb(null);
    const err = await run(makeReq(), makeRes()).catch((e) => e);
    expect(err.statusCode).toBe(404);
    expect(generateQuestions).not.toHaveBeenCalled();
  });

  it('refuses a disabled KB', async () => {
    mockKb(makeKb({ status: 'disabled' }));
    const err = await run(makeReq(), makeRes()).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/disabled/i);
  });

  it('checks AI routing for question_generation, scoped to the company', async () => {
    isAiConfigured.mockResolvedValue(false);
    mockKb(makeKb());
    const err = await run(makeReq(), makeRes()).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(isAiConfigured).toHaveBeenCalledWith('question_generation', { company: COMPANY });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('reports why nothing survived the generator’s gate rather than saving nothing', async () => {
    mockKb(makeKb());
    generateQuestions.mockResolvedValue({ questions: [], dropped: 4, reasons: { duplicate: 4 } });
    const err = await run(makeReq({ save: true }), makeRes()).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('NO_QUESTIONS');
    expect(err.details.reasons).toEqual({ duplicate: 4 });
    expect(insertMany).not.toHaveBeenCalled();
  });
});
