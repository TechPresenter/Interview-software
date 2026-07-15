import { describe, it, expect, vi, beforeEach } from 'vitest';

// The selector talks to Mongo; stub the model so these stay pure unit tests.
const BANK = [
  { _id: '1', text: 'How do you prevent unnecessary re-renders in React?', skills: ['react', 'performance'], difficulty: 'medium', type: 'technical', category: 'software_development', language: 'en', competencies: ['technical'], expectedPoints: ['memo', 'useMemo'], usageCount: 0 },
  { _id: '2', text: 'Explain the difference between SQL and NoSQL databases.', skills: ['databases'], difficulty: 'medium', type: 'technical', category: 'software_development', language: 'en', usageCount: 0 },
  { _id: '3', text: 'What are the GST filing deadlines for a private limited company?', skills: ['taxation'], difficulty: 'medium', type: 'domain', category: 'accounting', language: 'en', usageCount: 0 },
  { _id: '4', text: 'How would you prevent React components from re-rendering needlessly?', skills: ['react'], difficulty: 'medium', type: 'technical', language: 'en', usageCount: 0 },
  { _id: '5', text: 'Describe a project you are proud of and your role in it.', skills: [], difficulty: 'easy', type: 'behavioral', language: 'en', usageCount: 0 },
];

vi.mock('../src/models/Question.js', () => ({
  Question: {
    find: (f) => ({
      limit() { return this; },
      lean: async () => BANK
        .filter((q) => (f.skills?.$in ? q.skills.some((s) => f.skills.$in.includes(s)) : true))
        .filter((q) => (f._id?.$nin ? !f._id.$nin.includes(String(q._id)) : true)),
    }),
    updateOne: () => Promise.resolve(),
  },
}));

const { selectNextQuestion, selectQuestionSet } = await import('../src/services/question.selector.js');

const reactJob = {
  companyId: null,
  skills: [{ name: 'react', weight: 3 }, { name: 'performance', weight: 2 }],
  difficulty: 'medium',
  type: 'technical',
  language: 'en',
};

describe('question.selector · relevance', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('picks the question matching the job’s highest-weighted skills', async () => {
    const q = await selectNextQuestion(reactJob);
    expect(q.text).toMatch(/re-renders in React/);
  });

  it('does not re-offer an already-asked question', async () => {
    const q = await selectNextQuestion({ ...reactJob, excludeIds: ['1'] });
    expect(q._id).not.toBe('1');
    expect(q.text).toMatch(/React/);
  });

  it('excludes near-verbatim restatements of an asked question', async () => {
    const q = await selectNextQuestion({
      ...reactJob,
      excludeIds: ['1'],
      excludeTexts: ['How would you prevent React components from re-rendering needlessly?'],
    });
    expect(q?._id).not.toBe('4');
  });

  it('serves a domain question to its own industry', async () => {
    const q = await selectNextQuestion({
      companyId: null,
      skills: [{ name: 'taxation', weight: 3 }],
      type: 'domain',
      industry: 'accounting',
      language: 'en',
    });
    expect(q.text).toMatch(/GST/);
  });

  // The regression this whole gate exists for: quality bonuses (matching
  // language, having an answer key) must never carry an off-topic question.
  it('returns null rather than serve an unrelated question', async () => {
    const q = await selectNextQuestion({
      companyId: null,
      skills: [{ name: 'welding', weight: 3 }],
      difficulty: 'expert',
      type: 'coding',
      industry: 'manufacturing',
      language: 'en',
    });
    expect(q).toBeNull();
  });

  it('still allows untagged generic questions when the type matches', async () => {
    const q = await selectNextQuestion({
      companyId: null,
      skills: [{ name: 'welding', weight: 3 }],
      type: 'behavioral',
      language: 'en',
    });
    expect(q.text).toMatch(/project you are proud of/);
  });

  it('builds a set without repeating itself', async () => {
    const set = await selectQuestionSet(reactJob, 5);
    const ids = set.map((q) => String(q._id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
