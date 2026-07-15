import { describe, it, expect } from 'vitest';
import { recommendationFromScore, buildPerQuestion, buildSkillCoverage } from '../src/services/ai/report.engine.js';

describe('report.engine · recommendationFromScore', () => {
  it('maps score bands to recommendations', () => {
    expect(recommendationFromScore(90)).toBe('strong_hire');
    expect(recommendationFromScore(85)).toBe('strong_hire');
    expect(recommendationFromScore(75)).toBe('hire');
    expect(recommendationFromScore(60)).toBe('consider');
    expect(recommendationFromScore(40)).toBe('reject');
    expect(recommendationFromScore(0)).toBe('reject');
  });
});

const ANSWERS = [
  {
    order: 1,
    questionText: 'How do you optimise React re-renders?',
    response: 'I use React.memo.',
    competencies: ['technical'],
    expectedPoints: ['memo', 'useMemo', 'keys'],
    durationSeconds: 45,
    evaluation: { score: 55, keywordsHit: ['memo'], keywordsMissed: ['useMemo', 'keys'], reasoning: 'Partial.' },
  },
  {
    order: 0,
    questionText: 'Explain SQL indexing.',
    response: '(skipped)',
    skipped: true,
    competencies: ['databases'],
    evaluation: { score: 0, reasoning: 'Candidate skipped this question.' },
  },
];

describe('report.engine · buildPerQuestion', () => {
  it('orders by question order and surfaces the per-answer detail', () => {
    const rows = buildPerQuestion(ANSWERS);
    expect(rows.map((r) => r.order)).toEqual([0, 1]);
    expect(rows[1]).toMatchObject({
      score: 55,
      covered: ['memo'],
      missed: ['useMemo', 'keys'],
      skipped: false,
      durationSeconds: 45,
    });
    expect(rows[0].skipped).toBe(true);
  });

  it('does not mutate the caller’s array', () => {
    const input = [...ANSWERS];
    buildPerQuestion(input);
    expect(input[0].order).toBe(1);
  });

  it('tolerates answers with no evaluation', () => {
    const rows = buildPerQuestion([{ order: 0, questionText: 'Q', response: 'A' }]);
    expect(rows[0].score).toBeNull();
    expect(rows[0].covered).toEqual([]);
  });

  it('returns an empty array for no answers', () => {
    expect(buildPerQuestion([])).toEqual([]);
  });
});

describe('report.engine · buildSkillCoverage', () => {
  it('reports how often each required skill was probed, and how well', () => {
    const job = { skills: [{ name: 'databases' }, { name: 'react' }, { name: 'kubernetes' }] };
    const rows = buildSkillCoverage(job, ANSWERS);
    // 'databases' matches by competency tag; 'react' by question text.
    expect(rows).toEqual([
      { skill: 'databases', asked: 1, score: 0 },
      { skill: 'react', asked: 1, score: 55 },
      // Never asked about — exactly what a recruiter needs to see.
      { skill: 'kubernetes', asked: 0, score: null },
    ]);
  });

  it('returns nothing when the job lists no skills', () => {
    expect(buildSkillCoverage({ skills: [] }, ANSWERS)).toEqual([]);
    expect(buildSkillCoverage(null, ANSWERS)).toEqual([]);
  });
});
