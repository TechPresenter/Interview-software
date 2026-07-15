import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { scheduleInterviewSchema, interviewConfigSchema } from '../src/validators/company.validators.js';
import { optionalEnum, nullishEnum, optionalId, emptyToUndefined } from '../src/validators/shared.js';
import { validate } from '../src/middleware/validate.js';
import { zodErrorDetails } from '../src/utils/zodError.js';
import { EXPERIENCE_LEVELS, DIFFICULTY } from '../src/constants/enums.js';

/**
 * The empty string is how a browser says "I left this alone".
 *
 * zod's .optional() accepts undefined and nothing else, so an unselected
 * <Select> — which posts '' — fails an optional enum:
 *
 *   "Invalid enum value. Expected 'fresher' | 'junior' | ... , received ''"
 *
 * The scheduling modal's DEFAULT_CFG carries experienceLevel: '' (its dropdown's
 * first option is literally ['', 'Any']), so the DEFAULT state of the form was an
 * automatic 400: nobody could schedule an interview without first touching a
 * dropdown they had no reason to touch. The UI only said "Validation failed".
 */

const VALID_ID = '507f1f77bcf86cd799439011';

describe('scheduling · the empty string that broke it', () => {
  it("accepts experienceLevel: '' — the modal's default state", () => {
    const r = scheduleInterviewSchema.safeParse({
      candidate: VALID_ID,
      types: ['hr'],
      config: { language: 'en', durationMinutes: 30, questionCount: 8, difficulty: 'medium', experienceLevel: '' },
    });
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("normalises '' to undefined rather than storing it", () => {
    // It must not survive as an empty string — '' is not an experience level and
    // nothing downstream should have to know that. zod keeps the KEY (with an
    // undefined value) rather than dropping it; that's fine, because Mongoose
    // ignores undefined on save. The value is what matters.
    const r = scheduleInterviewSchema.parse({
      candidate: VALID_ID,
      config: { experienceLevel: '', difficulty: '' },
    });
    expect(r.config.experienceLevel).toBeUndefined();
    expect(r.config.difficulty).toBeUndefined();
    expect(r.config.experienceLevel).not.toBe('');
  });

  it('still rejects a value that is wrong rather than absent', () => {
    // Tolerating '' must not turn the enum into a free-text field.
    const r = scheduleInterviewSchema.safeParse({
      candidate: VALID_ID,
      config: { experienceLevel: 'wizard' },
    });
    expect(r.success).toBe(false);
  });

  it("accepts the full payload the modal actually sends", () => {
    // Copied field-for-field from client DEFAULT_CFG.
    const r = scheduleInterviewSchema.safeParse({
      candidate: VALID_ID,
      types: ['hr'],
      sendInvite: true,
      config: {
        language: 'en', allowLanguageChange: false, durationMinutes: 30, questionCount: 8,
        difficulty: 'medium', experienceLevel: '', passingScore: 50, timePerQuestionSeconds: 0,
        maxRetries: 0, adaptiveDifficulty: true, followUps: true, randomOrder: false,
        autoSubmit: true, voiceEnabled: true, videoEnabled: true, cameraRequired: true,
        micRequired: true, proctoring: true, resumeBased: false, jdBased: true,
      },
    });
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
  });

  it.each(['', null, undefined])('treats questionSet %p as "no set chosen"', (v) => {
    const r = scheduleInterviewSchema.safeParse({ candidate: VALID_ID, questionSet: v });
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
  });

  it('rejects a malformed questionSet id', () => {
    expect(scheduleInterviewSchema.safeParse({ candidate: VALID_ID, questionSet: 'nope' }).success).toBe(false);
  });

  it('every level offered by the UI is accepted', () => {
    // The UI dropdown was missing 'junior'. If EXPERIENCE_LEVELS grows, this is
    // the reminder that a level nobody can pick may as well not exist.
    for (const level of EXPERIENCE_LEVELS) {
      const r = scheduleInterviewSchema.safeParse({ candidate: VALID_ID, config: { experienceLevel: level } });
      expect(r.success, `level '${level}' rejected`).toBe(true);
    }
  });

  it('candidate is still required', () => {
    expect(scheduleInterviewSchema.safeParse({}).success).toBe(false);
  });
});

describe('shared validator helpers', () => {
  it.each([['', undefined], ['   ', undefined], ['mid', 'mid'], [undefined, undefined]])(
    'emptyToUndefined(%p) → %p',
    (input, want) => expect(emptyToUndefined(input)).toBe(want),
  );

  it('emptyToUndefined leaves non-strings alone', () => {
    expect(emptyToUndefined(0)).toBe(0);
    expect(emptyToUndefined(false)).toBe(false);
    expect(emptyToUndefined(null)).toBe(null);
  });

  it('optionalEnum accepts blank, rejects wrong', () => {
    const s = optionalEnum(DIFFICULTY);
    expect(s.safeParse('').success).toBe(true);
    expect(s.safeParse('easy').success).toBe(true);
    expect(s.safeParse('sideways').success).toBe(false);
  });

  it('nullishEnum additionally accepts an explicit null', () => {
    expect(nullishEnum(DIFFICULTY).safeParse(null).success).toBe(true);
    // optionalEnum must NOT — the two helpers exist to be different.
    expect(optionalEnum(DIFFICULTY).safeParse(null).success).toBe(false);
  });

  it('optionalId accepts blank but not garbage', () => {
    expect(optionalId.safeParse('').success).toBe(true);
    expect(optionalId.safeParse(VALID_ID).success).toBe(true);
    expect(optionalId.safeParse('123').success).toBe(false);
  });

  it('interviewConfigSchema is optional as a whole', () => {
    expect(interviewConfigSchema.safeParse(undefined).success).toBe(true);
  });
});

/** Drives the middleware the way express does. */
function runValidate(schema, body) {
  const req = { body };
  let err = null;
  validate(schema)(req, {}, (e) => { err = e || null; });
  return { req, err };
}

describe('validate middleware · messages a person can act on', () => {
  it('names the full nested path, not just "config"', () => {
    // flatten().fieldErrors collapsed everything under config to the key
    // "config", so a caller could not tell which of ~20 fields was wrong.
    const { err } = runValidate(scheduleInterviewSchema, {
      candidate: VALID_ID,
      config: { experienceLevel: 'wizard' },
    });
    expect(err).toBeTruthy();
    expect(Object.keys(err.details)).toContain('config.experienceLevel');
  });

  it('replaces zod developer-speak with the allowed values', () => {
    const { err } = runValidate(scheduleInterviewSchema, { candidate: VALID_ID, config: { difficulty: 'nope' } });
    expect(err.details['config.difficulty']).toBe('difficulty must be one of: easy, medium, hard, expert.');
    expect(err.details['config.difficulty']).not.toMatch(/Invalid enum value|received/);
  });

  it('says which field is missing instead of "Validation failed"', () => {
    const { err } = runValidate(scheduleInterviewSchema, {});
    expect(err.message).toBe('candidate is required.');
    expect(err.message).not.toBe('Validation failed');
  });

  it('splits camelCase into words', () => {
    const { err } = runValidate(scheduleInterviewSchema, { candidate: VALID_ID, config: { questionCount: 999 } });
    expect(err.details['config.questionCount']).toBe('question count must be at most 50.');
  });

  it('summarises multiple failures without hiding the count', () => {
    const { err } = runValidate(scheduleInterviewSchema, {
      candidate: VALID_ID,
      config: { questionCount: 999, difficulty: 'nope' },
    });
    expect(Object.keys(err.details)).toHaveLength(2);
    expect(err.message).toMatch(/\(and 1 other field\)$/);
  });

  it('carries the VALIDATION_ERROR code for clients that branch on it', () => {
    const { err } = runValidate(scheduleInterviewSchema, {});
    expect(err.code ?? err.details?.code ?? err.meta?.code).toBeDefined();
  });

  it('passes valid input through and replaces the body with parsed data', () => {
    const schema = z.object({ n: z.coerce.number() });
    const { req, err } = runValidate(schema, { n: '42' });
    expect(err).toBeNull();
    expect(req.body.n).toBe(42); // coerced, not the original string
  });
});

describe('zodErrorDetails · one implementation, both callers', () => {
  // The errorHandler had its OWN copy of `err.flatten().fieldErrors` for any
  // ZodError thrown outside a route-mounted schema, carrying the same
  // path-collapsing bug. Both now import this. If someone reintroduces a private
  // flatten() in either, these pin what the shared one must produce.
  const errorOf = (schema, input) => {
    const r = schema.safeParse(input);
    if (r.success) throw new Error('expected the schema to reject this input');
    return r.error;
  };

  it('keeps nested paths intact', () => {
    const schema = z.object({ config: z.object({ level: z.enum(['a', 'b']) }) });
    const { details } = zodErrorDetails(errorOf(schema, { config: { level: 'z' } }));
    expect(Object.keys(details)).toEqual(['config.level']);
  });

  it('survives a deeply nested path', () => {
    const schema = z.object({ a: z.object({ b: z.object({ c: z.number() }) }) });
    const { details } = zodErrorDetails(errorOf(schema, { a: { b: { c: 'x' } } }));
    expect(Object.keys(details)).toEqual(['a.b.c']);
  });

  it('indexes array members rather than blaming the array', () => {
    const schema = z.object({ tags: z.array(z.enum(['x', 'y'])) });
    const { details } = zodErrorDetails(errorOf(schema, { tags: ['x', 'nope'] }));
    expect(Object.keys(details)).toEqual(['tags.1']);
  });

  it('never emits zod developer-speak', () => {
    const schema = z.object({ config: z.object({ level: z.enum(['a', 'b']) }) });
    const { details, message } = zodErrorDetails(errorOf(schema, { config: { level: '' } }));
    const text = `${message} ${Object.values(details).join(' ')}`;
    expect(text).not.toMatch(/Invalid enum value|Expected .* received|ZodError/);
  });

  it('falls back safely on an error with no issues', () => {
    expect(zodErrorDetails({ issues: [] }).message).toBe('Validation failed');
  });
});
