import { describe, it, expect, vi } from 'vitest';

/**
 * The generation prompt states the relevance/fairness/no-duplicate rules, but a
 * prompt is a request, not a guarantee. These tests pin the server-side gate
 * that has to hold when the model ignores them.
 */

vi.mock('../src/models/Question.js', () => ({
  Question: {
    find: () => ({
      select() { return this; },
      limit() { return this; },
      lean: async () => [{ text: 'Explain how the React virtual DOM diffing algorithm works.' }],
    }),
  },
}));

// vi.mock is hoisted above module-level consts, so the stub must be too —
// otherwise the real client runs and blocks on a DB lookup.
const { completeJson } = vi.hoisted(() => ({ completeJson: vi.fn() }));
vi.mock('../src/services/ai/claude.client.js', () => ({ completeJson }));

// applyPromptOverride reads the admin's prompt override from Mongo; without a
// connection mongoose buffers the query until it times out.
vi.mock('../src/services/settings.service.js', () => ({ getSetting: async (_k, d) => d }));

const { generateQuestions } = await import('../src/services/ai/question.generator.js');

const INPUT = {
  jobTitle: 'Frontend Engineer',
  skills: ['react', 'performance'],
  count: 6,
  difficulty: 'hard',
  industry: 'software_development',
};

describe('question.generator · output gate', () => {
  it('keeps only the questions that satisfy every rule', async () => {
    completeJson.mockResolvedValue({
      data: {
        questions: [
          // good
          { text: 'How would you optimise a slow React list render of 10k rows?', type: 'technical', difficulty: 'hard', skills: ['react'], expectedPoints: ['virtualisation', 'memo', 'keys'], relevance: 'Tests the React + performance skills named for this role.' },
          // generic filler
          { text: 'Tell me about yourself.', type: 'hr', difficulty: 'easy', relevance: 'Warms up the candidate.' },
          // near-duplicate of what is already in the bank
          { text: 'Explain how React virtual DOM diffing algorithm works internally.', type: 'technical', difficulty: 'hard', skills: ['react'], relevance: 'Core React knowledge.' },
          // discriminatory
          { text: 'Are you married or planning to have children soon?', type: 'hr', difficulty: 'easy', relevance: 'Assesses availability.' },
          // unjustified (no relevance field)
          { text: 'What is your favourite colour and why does it matter?', type: 'custom', difficulty: 'easy' },
          // MCQ with no correct option marked -> unscoreable
          { text: 'Which hook memoises an expensive computation?', type: 'mcq', difficulty: 'medium', skills: ['react'], options: [{ text: 'useMemo' }, { text: 'useState' }], relevance: 'React hooks knowledge.' },
        ],
      },
    });

    const r = await generateQuestions(INPUT, { companyId: null });

    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].text).toMatch(/optimise a slow React list/);
    expect(r.dropped).toBe(5);
    expect(r.reasons.duplicate).toBe(1);
    expect(r.reasons.invalid).toBe(4);
  });

  it('tags an untagged question with the job’s skills so the selector can rank it', async () => {
    completeJson.mockResolvedValue({
      data: { questions: [{ text: 'Walk me through how you would profile a slow page load.', type: 'technical', difficulty: 'hard', relevance: 'Performance is a named skill for this role.' }] },
    });
    const r = await generateQuestions(INPUT, { companyId: null });
    expect(r.questions[0].skills).toEqual(['react', 'performance']);
  });

  it('keeps a valid MCQ and infers multiSelect', async () => {
    completeJson.mockResolvedValue({
      data: {
        questions: [{
          text: 'Which of these prevent unnecessary React re-renders?',
          type: 'mcq',
          difficulty: 'medium',
          skills: ['react'],
          options: [{ text: 'React.memo', isCorrect: true }, { text: 'useMemo', isCorrect: true }, { text: 'useEffect', isCorrect: false }],
          relevance: 'Directly tests the React performance skill.',
        }],
      },
    });
    const r = await generateQuestions(INPUT, { companyId: null });
    expect(r.questions[0].mcq.options).toHaveLength(3);
    expect(r.questions[0].mcq.multiSelect).toBe(true);
  });

  it('returns nothing when the model returns nothing usable', async () => {
    completeJson.mockResolvedValue({ data: { questions: [] } });
    const r = await generateQuestions(INPUT, { companyId: null });
    expect(r.questions).toHaveLength(0);
  });
});
