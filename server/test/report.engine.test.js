import { describe, it, expect } from 'vitest';
import { recommendationFromScore } from '../src/services/ai/report.engine.js';

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
