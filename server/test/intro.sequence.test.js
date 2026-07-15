import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Drive the REAL room.service through a whole interview and watch the order of
 * questions.
 *
 * The tests in intro.flow.test.js pin the pieces — the budget maths, the stage
 * wording, the schema line, the shape of the source. None of them prove the one
 * thing the requirement actually asks for: that a candidate is asked about
 * themselves BEFORE they are asked anything technical, every time, on every
 * path. That is a property of the sequence, so it needs the sequence.
 *
 * Everything external is stubbed (Mongo, Redis, the LLM, sockets, email) because
 * the flow is pure decision-making — which question comes next, and what it
 * costs. The AI stubs return marked text so a technical question is
 * distinguishable from a background one at a glance.
 */

const H = vi.hoisted(() => {
  const saved = [];
  const answers = [];
  return {
    saved,
    answers,
    greet: vi.fn(async () => 'Hi there, welcome.'),
    nextQuestion: vi.fn(async () => ({
      question: 'TECHNICAL: how would you shard this table?',
      competencies: ['technical'],
      expectedPoints: ['hash key', 'hot partitions'],
      rationale: 'probes data modelling',
    })),
    maybeFollowUp: vi.fn(async () => null),
    scoreAnswer: vi.fn(async () => ({
      score: 70, competencyScores: { technical: 70 }, reasoning: 'ok',
      keywordsHit: [], keywordsMissed: [], followUpSuggested: null,
    })),
    aiConfigured: vi.fn(async () => true),
    selectNextQuestion: vi.fn(async () => null), // bank empty → LLM tier
  };
});

vi.mock('../src/services/ai/interview.engine.js', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    greet: H.greet,
    nextQuestion: H.nextQuestion,
    maybeFollowUp: H.maybeFollowUp,
    // adaptDifficulty / isComplete stay real — they are part of what's under test.
    default: { ...actual.default, greet: H.greet, nextQuestion: H.nextQuestion, maybeFollowUp: H.maybeFollowUp },
  };
});
vi.mock('../src/services/ai/scoring.engine.js', () => ({ scoreAnswer: H.scoreAnswer }));
vi.mock('../src/services/ai/ai.status.js', () => ({ isAiConfigured: H.aiConfigured, invalidateAiStatusCache: vi.fn() }));
vi.mock('../src/services/question.selector.js', () => ({ selectNextQuestion: H.selectNextQuestion, markUsed: vi.fn() }));
vi.mock('../src/services/ai/report.engine.js', () => ({ generateReport: vi.fn(async () => ({ overallScore: 70 })) }));
vi.mock('../src/services/knowledgeBase.service.js', () => ({ contextFor: vi.fn(async () => null) }));
vi.mock('../src/services/settings.service.js', () => ({ getAiWeightage: vi.fn(async () => ({})) }));
vi.mock('../src/services/audit.service.js', () => ({ logActivity: vi.fn() }));
vi.mock('../src/services/notification.service.js', () => ({ notify: vi.fn() }));
vi.mock('../src/services/email.service.js', () => ({ safeSendTemplated: vi.fn() }));
vi.mock('../src/socket/emitters.js', () => ({ emitToCompany: vi.fn(), emitToInterview: vi.fn() }));
vi.mock('../src/models/Candidate.js', () => ({
  Candidate: { findById: () => ({ lean: async () => ({ name: 'Liam Patel', totalExperienceYears: 6 }) }) },
}));
vi.mock('../src/models/Job.js', () => ({
  Job: { findById: () => ({ lean: async () => ({ title: 'Backend Engineer', skills: [] }) }) },
}));
vi.mock('../src/models/QuestionSet.js', () => ({ QuestionSet: { findById: () => ({ populate: () => ({ lean: async () => null }) }) } }));
vi.mock('../src/models/Report.js', () => ({ Report: { findOne: () => ({ lean: async () => null }), create: vi.fn(async () => ({ _id: 'r1' })) } }));
vi.mock('../src/models/Answer.js', () => ({
  Answer: {
    create: vi.fn(async (doc) => { H.answers.push(doc); return doc; }),
    find: () => ({ sort: () => ({ lean: async () => H.answers }) }),
  },
}));
vi.mock('../src/models/Interview.js', () => ({ Interview: { findOne: vi.fn() } }));

const room = await import('../src/services/room.service.js');

/** A plain interview double — room.service only needs .save() and the fields. */
function makeInterview(config = {}) {
  return {
    _id: 'iv1',
    company: 'c1',
    candidate: 'cand1',
    job: 'job1',
    types: ['technical'],
    status: 'scheduled',
    questionSet: null,
    config: {
      questionCount: 8, durationMinutes: 30, difficulty: 'medium', language: 'en',
      adaptiveDifficulty: true, followUps: true, allowSkip: true, maxSkips: 2,
      useQuestionBank: true, ...config,
    },
    engineState: {
      currentIndex: 0, difficulty: 'medium', phase: 'greeting',
      askedQuestionIds: [], askedTexts: [], competenciesCovered: [], skipsUsed: 0,
      introPlan: [], introAsked: 0, introFresher: false,
      pendingQuestion: {},
    },
    transcript: [],
    proctoring: { integrityScore: 100 },
    recomputeIntegrity() {},
    save: vi.fn(async function save() { H.saved.push(this.engineState.currentIndex); return this; }),
  };
}

beforeEach(() => {
  H.answers.length = 0;
  H.saved.length = 0;
  vi.clearAllMocks();
  H.maybeFollowUp.mockResolvedValue(null);
  H.nextQuestion.mockResolvedValue({
    question: 'TECHNICAL: how would you shard this table?',
    competencies: ['technical'],
    expectedPoints: ['hash key'],
    rationale: 'probes data modelling',
  });
});

/** Walk the interview, returning the ordered list of questions actually asked. */
async function runInterview(iv, { turns = 14, answer = 'a reasonable answer' } = {}) {
  const asked = [];
  const first = await room.start(iv);
  asked.push({ text: first.question.text, intro: Boolean(iv.engineState.pendingQuestion.isIntro), progress: first.progress });
  for (let i = 0; i < turns; i += 1) {
    const res = await room.answer(iv, { answer });
    if (res.done) { asked.push({ done: true }); break; }
    asked.push({
      text: res.question.text,
      intro: Boolean(iv.engineState.pendingQuestion.isIntro),
      followUp: Boolean(iv.engineState.pendingQuestion.isFollowUp),
      progress: res.progress,
    });
  }
  return asked;
}

describe('the background phase runs before anything technical', () => {
  it('asks about the candidate first, not the role', async () => {
    const iv = makeInterview();
    const first = await room.start(iv);
    expect(first.question.text).toMatch(/tell me a bit about yourself/i);
    expect(first.question.text).not.toMatch(/TECHNICAL/);
    expect(H.nextQuestion, 'the LLM was called for the opening question').not.toHaveBeenCalled();
  });

  it('runs every planned background stage before the first technical question', async () => {
    const iv = makeInterview({ questionCount: 8, durationMinutes: 30 }); // → 3 stages
    const asked = await runInterview(iv, { turns: 4 });
    const kinds = asked.filter((a) => !a.done).map((a) => (a.intro ? 'background' : 'technical'));
    expect(kinds.slice(0, 3)).toEqual(['background', 'background', 'background']);
    expect(kinds[3]).toBe('technical');
  });

  it('the three stages are the three distinct topics, in spec order', async () => {
    const iv = makeInterview();
    const asked = await runInterview(iv, { turns: 3 });
    expect(asked[0].text).toMatch(/tell me a bit about yourself/i); // spec 2+3+4
    expect(asked[1].text).toMatch(/project or piece of work/i);     // spec 5+6
    expect(asked[2].text).toMatch(/career/i);                       // spec 7+8
  });

  it('bridges into the technical section instead of spending a turn on it', async () => {
    const iv = makeInterview();
    const asked = await runInterview(iv, { turns: 4 });
    const firstTechnical = asked.find((a) => !a.done && !a.intro);
    // Spec stage 9 rides on the first scored question.
    expect(firstTechnical.text).toMatch(/good picture of where you are coming from/i);
    expect(firstTechnical.text).toMatch(/TECHNICAL/); // and it IS the real question
  });
});

describe('the background phase does not cost the recruiter questions', () => {
  it('leaves the scored budget untouched', async () => {
    const iv = makeInterview({ questionCount: 8 });
    await runInterview(iv, { turns: 3 });
    expect(iv.engineState.currentIndex, 'background answers consumed scored questions').toBe(0);
    expect(iv.engineState.introAsked).toBe(3);
  });

  it('still delivers all 8 scored questions afterwards', async () => {
    const iv = makeInterview({ questionCount: 8 });
    const asked = await runInterview(iv, { turns: 13 });
    const technical = asked.filter((a) => !a.done && !a.intro).length;
    // 3 background + 8 technical asked; the 8th answer completes it.
    expect(iv.engineState.currentIndex).toBe(8);
    expect(technical).toBeGreaterThanOrEqual(8);
    expect(asked[asked.length - 1].done).toBe(true);
  });

  it('a 1-question interview is background + 1 real question, not 1 background', async () => {
    const iv = makeInterview({ questionCount: 1, durationMinutes: 30 });
    const asked = await runInterview(iv, { turns: 3 });
    expect(asked[0].intro).toBe(true);
    expect(asked[1].intro).toBe(false);
    expect(asked[1].text).toMatch(/TECHNICAL/);
    expect(asked[2].done).toBe(true);
  });

  it('never reports the interview finished during the background phase', async () => {
    const iv = makeInterview({ questionCount: 1 });
    const first = await room.start(iv);
    const res = await room.answer(iv, { answer: 'my background' });
    expect(first.question.text).toMatch(/yourself/i);
    expect(res.done, 'the interview ended before asking a single real question').toBeFalsy();
  });
});

describe('the background phase does not touch scoring', () => {
  it('never scores a background answer', async () => {
    const iv = makeInterview();
    await runInterview(iv, { turns: 3 });
    expect(H.scoreAnswer, 'the scorer ran on small talk').not.toHaveBeenCalled();
  });

  it('scores technical answers as usual', async () => {
    const iv = makeInterview();
    await runInterview(iv, { turns: 4 });
    expect(H.scoreAnswer).toHaveBeenCalledTimes(1);
  });

  it('marks background answers isIntro and leaves them unscored', async () => {
    const iv = makeInterview();
    await runInterview(iv, { turns: 3 });
    expect(H.answers).toHaveLength(3);
    for (const a of H.answers) {
      expect(a.isIntro).toBe(true);
      expect(a.evaluation.score).toBeNull();
      expect(a.evaluation.competencyScores).toEqual({});
    }
  });

  it('does not let a polished intro move the difficulty ladder', async () => {
    // adaptDifficulty reads the scalar score and cannot tell where it came from,
    // so a rehearsed elevator pitch would step the technical questions up before
    // the first real one is asked.
    const iv = makeInterview({ difficulty: 'medium' });
    await runInterview(iv, { turns: 3 });
    expect(iv.engineState.difficulty).toBe('medium');
  });

  it('still adapts difficulty on technical answers', async () => {
    H.scoreAnswer.mockResolvedValue({ score: 95, competencyScores: {}, keywordsHit: [], keywordsMissed: [], followUpSuggested: null });
    const iv = makeInterview({ difficulty: 'medium' });
    await runInterview(iv, { turns: 4 });
    expect(iv.engineState.difficulty).toBe('hard');
  });
});

describe('follow-ups on background answers', () => {
  it('asks a follow-up when the candidate says something worth probing', async () => {
    H.maybeFollowUp.mockResolvedValueOnce('You mentioned Kafka — what did you use it for?');
    const iv = makeInterview();
    const first = await room.start(iv);
    const res = await room.answer(iv, { answer: 'I worked on streaming with Kafka' });
    expect(first.question.text).toMatch(/yourself/i);
    expect(res.question.text).toMatch(/Kafka/);
    expect(iv.engineState.pendingQuestion.isFollowUp).toBe(true);
    expect(iv.engineState.pendingQuestion.isIntro, 'a background follow-up is still background').toBe(true);
  });

  it('a background follow-up costs neither a scored question nor a stage', async () => {
    H.maybeFollowUp.mockResolvedValueOnce('Say more about that?');
    const iv = makeInterview();
    await room.start(iv);
    await room.answer(iv, { answer: 'x' }); // → follow-up
    expect(iv.engineState.currentIndex).toBe(0);
    expect(iv.engineState.introAsked, 'the stage was counted once').toBe(1);
    await room.answer(iv, { answer: 'more detail' }); // answering the follow-up
    expect(iv.engineState.currentIndex).toBe(0);
    expect(iv.engineState.introAsked).toBe(1);
  });

  it('never chains a follow-up off a follow-up', async () => {
    H.maybeFollowUp.mockResolvedValue('another probe?');
    const iv = makeInterview();
    await room.start(iv);
    await room.answer(iv, { answer: 'x' });               // stage 1 → follow-up
    expect(iv.engineState.pendingQuestion.isFollowUp).toBe(true);
    await room.answer(iv, { answer: 'y' });               // follow-up → next STAGE
    expect(iv.engineState.pendingQuestion.isFollowUp).toBe(false);
    expect(iv.engineState.pendingQuestion.isIntro).toBe(true);
  });

  it('honours the followUps toggle', async () => {
    H.maybeFollowUp.mockResolvedValue('should never be asked');
    const iv = makeInterview({ followUps: false });
    await room.start(iv);
    await room.answer(iv, { answer: 'x' });
    expect(H.maybeFollowUp).not.toHaveBeenCalled();
  });

  it('a failing follow-up never breaks the interview', async () => {
    H.maybeFollowUp.mockRejectedValueOnce(new Error('provider down'));
    const iv = makeInterview();
    await room.start(iv);
    const res = await room.answer(iv, { answer: 'x' });
    expect(res.done).toBeFalsy();
    expect(res.question.text).toMatch(/project or piece of work/i); // moved on to stage 2
  });
});

describe('admin customization and consistency', () => {
  it('introCount: 0 turns the background phase off entirely', async () => {
    const iv = makeInterview({ introCount: 0 });
    const first = await room.start(iv);
    expect(iv.engineState.introPlan).toEqual([]);
    expect(first.question.text).toMatch(/TECHNICAL/);
    expect(first.question.text).not.toMatch(/good picture of where you are coming from/); // no bridge either
  });

  it('introCount: 1 asks exactly one background question', async () => {
    const iv = makeInterview({ introCount: 1 });
    const asked = await runInterview(iv, { turns: 2 });
    expect(asked[0].intro).toBe(true);
    expect(asked[1].intro).toBe(false);
  });

  it.each(['hr', 'technical', 'behavioural', 'aptitude', 'coding'])('applies to a %s interview', async (type) => {
    // Requirement 5: consistent across all interview types unless an admin says
    // otherwise. Nothing in the flow may branch on type.
    const iv = makeInterview();
    iv.types = [type];
    const first = await room.start(iv);
    expect(first.question.text).toMatch(/tell me a bit about yourself/i);
  });

  it('runs even when an assigned QuestionSet would otherwise win immediately', async () => {
    // Tier 0 returns on its first call, so a background phase mounted below it
    // would never fire for exactly the interviews a recruiter cares most about.
    const iv = makeInterview();
    iv.questionSet = 'set1';
    const first = await room.start(iv);
    expect(first.question.text).toMatch(/tell me a bit about yourself/i);
    expect(iv.engineState.askedQuestionIds, 'the set advanced during the intro').toEqual([]);
  });

  it('adapts the wording to a fresher without skipping the stage', async () => {
    const iv = makeInterview({ experienceLevel: 'fresher' });
    const first = await room.start(iv);
    expect(iv.engineState.introFresher).toBe(true);
    expect(first.question.text).toMatch(/internships or projects/i);
  });
});

describe('progress and the candidate view', () => {
  it('counts background turns so the bar is not frozen', async () => {
    const iv = makeInterview({ questionCount: 8 });
    const first = await room.start(iv);
    expect(first.progress).toEqual({ current: 0, total: 11 }); // 8 scored + 3 background
    const res = await room.answer(iv, { answer: 'x' });
    expect(res.progress).toEqual({ current: 1, total: 11 });
  });

  it('never leaks the background flag or the mark scheme to the candidate', async () => {
    const iv = makeInterview();
    const first = await room.start(iv);
    expect(Object.keys(first.question).sort()).toEqual(['competencies', 'isFollowUp', 'text']);
    expect(first.question.isIntro).toBeUndefined();
    expect(first.question.expectedPoints).toBeUndefined();
  });
});

describe('skipping', () => {
  it('skipping a background question does not burn a scored slot or book a zero', async () => {
    const iv = makeInterview();
    await room.start(iv);
    const res = await room.skip(iv);
    expect(iv.engineState.currentIndex, 'a skipped intro cost a real question').toBe(0);
    expect(iv.engineState.introAsked).toBe(1);
    expect(H.answers[0].isIntro).toBe(true);
    expect(H.answers[0].evaluation.score, 'declining small talk was recorded as a failed answer').toBeNull();
    expect(res.question.text).toMatch(/project or piece of work/i);
  });

  it('skipping a technical question still books a zero', async () => {
    const iv = makeInterview({ introCount: 0 });
    await room.start(iv);
    await room.skip(iv);
    expect(iv.engineState.currentIndex).toBe(1);
    expect(H.answers[0].evaluation.score).toBe(0);
  });
});
