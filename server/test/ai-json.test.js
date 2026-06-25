import { describe, it, expect } from 'vitest';
import { extractJson } from '../src/services/ai/claude.client.js';

describe('claude.client · extractJson', () => {
  it('parses clean JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips ```json fences', () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('extracts JSON embedded in prose', () => {
    expect(extractJson('Sure! Here you go: {"score": 80} — hope that helps')).toEqual({ score: 80 });
  });
  it('parses arrays', () => {
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3]);
  });
  it('throws on unrecoverable garbage', () => {
    expect(() => extractJson('not json at all')).toThrow();
  });
});
