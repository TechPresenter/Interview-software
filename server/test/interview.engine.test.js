import { describe, it, expect } from 'vitest';
import { adaptDifficulty, isComplete } from '../src/services/ai/interview.engine.js';

describe('interview.engine · adaptDifficulty', () => {
  it('steps up on a strong answer', () => {
    expect(adaptDifficulty('medium', 85)).toBe('hard');
  });
  it('steps down on a weak answer', () => {
    expect(adaptDifficulty('medium', 30)).toBe('easy');
  });
  it('holds steady on a middling answer', () => {
    expect(adaptDifficulty('medium', 60)).toBe('medium');
  });
  it('does not exceed the bounds', () => {
    expect(adaptDifficulty('expert', 95)).toBe('expert');
    expect(adaptDifficulty('easy', 10)).toBe('easy');
  });
  it('keeps difficulty when score is missing', () => {
    expect(adaptDifficulty('hard', null)).toBe('hard');
  });
});

describe('interview.engine · isComplete', () => {
  const make = (currentIndex, questionCount) => ({
    engineState: { currentIndex },
    config: { questionCount },
  });
  it('is complete once the question budget is reached', () => {
    expect(isComplete(make(8, 8))).toBe(true);
    expect(isComplete(make(9, 8))).toBe(true);
  });
  it('is not complete mid-interview', () => {
    expect(isComplete(make(3, 8))).toBe(false);
  });
});
