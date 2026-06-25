import { describe, it, expect } from 'vitest';
import { aggregate, defaultWeightage } from '../src/services/ai/scoring.engine.js';

describe('scoring.engine · aggregate', () => {
  it('averages competency scores across answers and rounds', () => {
    const evals = [
      { competencyScores: { technical: 80, communication: 60 } },
      { competencyScores: { technical: 90, communication: 70 } },
    ];
    const { scores } = aggregate(evals, defaultWeightage());
    expect(scores.technical).toBe(85);
    expect(scores.communication).toBe(65);
  });

  it('returns null for competencies with no data', () => {
    const { scores } = aggregate([{ competencyScores: { technical: 50 } }]);
    expect(scores.technical).toBe(50);
    expect(scores.leadership).toBeNull();
  });

  it('computes a weighted overall over present competencies only', () => {
    const evals = [{ competencyScores: { technical: 100, communication: 0 } }];
    const { overallScore } = aggregate(evals, { technical: 0.5, communication: 0.5 });
    expect(overallScore).toBe(50);
  });

  it('handles empty input without throwing', () => {
    const { scores, overallScore } = aggregate([]);
    expect(overallScore).toBeNull();
    expect(scores.technical).toBeNull();
  });

  it('default weightage sums to ~1', () => {
    const sum = Object.values(defaultWeightage()).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });
});
