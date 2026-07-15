import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * What happens when the candidate's submit times out but the server finishes.
 *
 * The room's axios instance aborts at 30s. Measured against real AiUsage rows
 * from this deployment, one answer() request is two sequential LLM calls —
 * scoring then next-question — with a median of 1.4s, a p90 of 7.1s, and a worst
 * observed pair of 23.5s. Two individual calls have already exceeded 30s alone.
 * So the abort fires rarely, and rarely is not never.
 *
 * When it fires, the request is still in flight: the server records the answer,
 * advances the question, and replies to a socket nobody is reading. The client
 * sees a network error, restores the text, and invites a retry.
 */

const H = vi.hoisted(() => ({
  answers: [],
  greet: vi.fn(async () => 'hello'),
  nextQuestion: vi.fn(async () => ({ question: 'Q_NEXT', competencies: ['technical'], expectedPoints: [], rationale: '' })),
  maybeFollowUp: vi.fn(async () => null),
  scoreAnswer: vi.fn(async () => ({ score: 70, competencyScores: {}, keywordsHit: [], keywordsMissed: [], followUpSuggested: null })),
}));

vi.mock('../src/services/ai/interview.engine.js', async (orig) => {
  const actual = await orig();
  return { ...actual, greet: H.greet, nextQuestion: H.nextQuestion, maybeFollowUp: H.maybeFollowUp, default: { ...actual.default } };
});
vi.mock('../src/services/ai/scoring.engine.js', () => ({ scoreAnswer: H.scoreAnswer }));
vi.mock('../src/services/ai/ai.status.js', () => ({ isAiConfigured: vi.fn(async () => true), invalidateAiStatusCache: vi.fn() }));
vi.mock('../src/services/question.selector.js', () => ({ selectNextQuestion: vi.fn(async () => null), markUsed: vi.fn() }));
vi.mock('../src/services/ai/report.engine.js', () => ({ generateReport: vi.fn(async () => ({})) }));
vi.mock('../src/services/knowledgeBase.service.js', () => ({ contextFor: vi.fn(async () => null) }));
vi.mock('../src/services/settings.service.js', () => ({ getAiWeightage: vi.fn(async () => ({})) }));
vi.mock('../src/services/audit.service.js', () => ({ logActivity: vi.fn() }));
vi.mock('../src/services/notification.service.js', () => ({ notify: vi.fn() }));
vi.mock('../src/services/email.service.js', () => ({ safeSendTemplated: vi.fn() }));
vi.mock('../src/socket/emitters.js', () => ({ emitToCompany: vi.fn(), emitToInterview: vi.fn() }));
vi.mock('../src/models/Candidate.js', () => ({ Candidate: { findById: () => ({ lean: async () => ({ name: 'A', totalExperienceYears: 5 }) }) } }));
vi.mock('../src/models/Job.js', () => ({ Job: { findById: () => ({ lean: async () => ({ title: 'Eng', skills: [] }) }) } }));
vi.mock('../src/models/QuestionSet.js', () => ({ QuestionSet: { findById: () => ({ populate: () => ({ lean: async () => null }) }) } }));
vi.mock('../src/models/Report.js', () => ({ Report: { findOne: () => ({ lean: async () => null }), create: vi.fn(async () => ({ _id: 'r' })) } }));
vi.mock('../src/models/Answer.js', () => ({
  Answer: { create: vi.fn(async (d) => { H.answers.push(d); return d; }), find: () => ({ sort: () => ({ lean: async () => H.answers }) }) },
}));
vi.mock('../src/models/Interview.js', () => ({ Interview: { findOne: vi.fn() } }));

const room = await import('../src/services/room.service.js');

const makeInterview = (config = {}) => ({
  _id: 'iv', company: 'c', candidate: 'cd', job: 'j', types: ['technical'], status: 'scheduled',
  questionSet: null,
  config: {
    questionCount: 8, durationMinutes: 30, difficulty: 'medium', language: 'en',
    adaptiveDifficulty: true, followUps: true, allowSkip: true, maxSkips: 2, introCount: 0, ...config,
  },
  engineState: {
    currentIndex: 0, difficulty: 'medium', phase: 'greeting', askedQuestionIds: [], askedTexts: [],
    competenciesCovered: [], skipsUsed: 0, introPlan: [], introAsked: 0, introFresher: false,
    turnCount: 0, pendingQuestion: {},
  },
  transcript: [], proctoring: { integrityScore: 100 },
  recomputeIntegrity() {}, save: vi.fn(async function () { return this; }),
});

beforeEach(() => {
  H.answers.length = 0;
  vi.clearAllMocks();
  H.maybeFollowUp.mockResolvedValue(null);
  H.nextQuestion.mockResolvedValue({ question: 'Q_NEXT', competencies: ['technical'], expectedPoints: [], rationale: '' });
});

describe('a retried submit after a client timeout', () => {
  it('does not record the same answer twice against different questions', async () => {
    const iv = makeInterview();
    const first = await room.start(iv);
    const turn = first.turn;

    // The candidate's answer reaches the server; the server records it and moves
    // to the next question. The client never sees the reply (axios aborted at
    // 30s), so it restores the text and the candidate presses Submit again.
    await room.answer(iv, { answer: 'my answer to question one', turn });
    expect(iv.engineState.currentIndex).toBe(1);

    // The retry carries the SAME turn token the candidate was answering.
    const retry = await room.answer(iv, { answer: 'my answer to question one', turn });

    // Without a turn check this books the Q1 text as the answer to Q2 — the
    // candidate's real answer to Q2 is never asked for, currentIndex jumps to 2,
    // and the interview quietly loses a question.
    expect(H.answers, 'the retry was recorded as a second answer').toHaveLength(1);
    expect(iv.engineState.currentIndex, 'the retry consumed a second question').toBe(1);
    // It must still hand back the question the candidate is actually on.
    expect(retry.done).toBeFalsy();
    expect(retry.question.text).toBe('Q_NEXT');
  });

  it('does not re-run the scorer or the question generator on a replay', async () => {
    // Both are billable. A replay must cost nothing.
    const iv = makeInterview();
    const { turn } = await room.start(iv);
    await room.answer(iv, { answer: 'x', turn });
    H.scoreAnswer.mockClear();
    H.nextQuestion.mockClear();
    await room.answer(iv, { answer: 'x', turn });
    expect(H.scoreAnswer).not.toHaveBeenCalled();
    expect(H.nextQuestion).not.toHaveBeenCalled();
  });

  it('a replay does not append a second copy to the transcript', async () => {
    const iv = makeInterview();
    const { turn } = await room.start(iv);
    await room.answer(iv, { answer: 'only once please', turn });
    const after = iv.transcript.filter((t) => t.text === 'only once please').length;
    await room.answer(iv, { answer: 'only once please', turn });
    expect(iv.transcript.filter((t) => t.text === 'only once please')).toHaveLength(after);
  });

  it('still accepts the genuine next answer', async () => {
    // The guard must reject replays without wedging the room.
    const iv = makeInterview();
    const first = await room.start(iv);
    const second = await room.answer(iv, { answer: 'answer 1', turn: first.turn });
    expect(second.turn, 'each served question needs its own token').not.toBe(first.turn);
    await room.answer(iv, { answer: 'answer 2', turn: second.turn });
    expect(H.answers).toHaveLength(2);
    expect(iv.engineState.currentIndex).toBe(2);
  });

  it('accepts a submit with no turn token at all', async () => {
    // An older client (or a tab loaded before this shipped) sends no turn. It
    // must keep working exactly as before rather than being locked out mid-interview.
    const iv = makeInterview();
    await room.start(iv);
    await room.answer(iv, { answer: 'legacy client' });
    expect(H.answers).toHaveLength(1);
    expect(iv.engineState.currentIndex).toBe(1);
  });

  it('gives every question a distinct turn token, including follow-ups', async () => {
    // progress.current cannot serve as the token: a follow-up advances neither
    // currentIndex nor introAsked, so two consecutive turns would share a value.
    H.scoreAnswer.mockResolvedValue({ score: 40, competencyScores: {}, keywordsHit: [], keywordsMissed: [], followUpSuggested: 'say more?' });
    const iv = makeInterview();
    const first = await room.start(iv);
    const fu = await room.answer(iv, { answer: 'thin answer', turn: first.turn });
    expect(fu.question.text).toBe('say more?');
    expect(fu.turn).not.toBe(first.turn);
    const seen = new Set([first.turn, fu.turn]);
    expect(seen.size).toBe(2);
  });

  it('skip() is guarded the same way', async () => {
    const iv = makeInterview();
    const first = await room.start(iv);
    await room.skip(iv, { turn: first.turn });
    expect(iv.engineState.currentIndex).toBe(1);
    await room.skip(iv, { turn: first.turn }); // replayed skip
    expect(iv.engineState.skipsUsed, 'a replayed skip burned a second skip').toBe(1);
    expect(iv.engineState.currentIndex).toBe(1);
  });
});

describe('an empty answer', () => {
  it('does not spend an LLM call following up on nothing', async () => {
    // Seen live: a blank submit on the background question produced a follow-up
    // probing an answer that did not exist ("share an example of a project...").
    const iv = makeInterview({ introCount: 1 });
    const { turn } = await room.start(iv);
    await room.answer(iv, { answer: '   ', turn });
    expect(H.maybeFollowUp).not.toHaveBeenCalled();
  });

  it('still records the blank so the report shows they said nothing', async () => {
    const iv = makeInterview({ introCount: 1 });
    const { turn } = await room.start(iv);
    await room.answer(iv, { answer: '', turn });
    expect(H.answers).toHaveLength(1);
    expect(H.answers[0].response).toBe('');
  });
});
