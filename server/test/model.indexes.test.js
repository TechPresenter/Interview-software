import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Question } from '../src/models/Question.js';
import { QuestionSet } from '../src/models/QuestionSet.js';

/**
 * A MongoDB text index reads each document's `language` field as ITS OWN
 * language unless `language_override` says otherwise, and it only accepts
 * languages it knows. Both models below carry a `language` of 'en' | 'hi' |
 * 'bilingual', so without the override every Hindi and bilingual row is rejected
 * on insert:
 *
 *   MongoBulkWriteError: language override unsupported: bilingual (code 17262)
 *
 * That made the entire Hindi question bank impossible to save, and it failed at
 * the driver rather than in validation, so nothing in the app explained it.
 * These tests are cheap; the bug was not.
 */

/** Reads the schema's declared indexes: [[spec, options], ...]. */
const textIndexOf = (schema) =>
  schema.indexes().find(([spec]) => Object.values(spec).includes('text'));

describe.each([
  ['Question', Question],
  ['QuestionSet', QuestionSet],
])('%s · text index', (name, model) => {
  const entry = textIndexOf(model.schema);

  it('declares a text index', () => {
    expect(entry, `${name} lost its text index`).toBeDefined();
  });

  it('does not let the text index claim the document language field', () => {
    const [, options] = entry;
    // Anything other than our sentinel — including the default (undefined) —
    // means Mongo will read `language` and reject 'hi'/'bilingual'.
    expect(options?.language_override, `${name}'s text index must not use the "language" field`).toBe('textSearchLanguage');
  });

  it('has a language field that is NOT a MongoDB language, which is why the override matters', () => {
    const values = model.schema.path('language')?.enumValues ?? [];
    expect(values).toContain('hi');
    // If this ever becomes a real Mongo language list the override is still
    // correct, but the reason above would no longer be the reason.
    expect(values.some((v) => !['en', 'english', 'none'].includes(v))).toBe(true);
  });
});

describe('text index registry', () => {
  it('every model with a language field overrides its text index language', () => {
    const offenders = [];
    for (const [name, model] of Object.entries(mongoose.models)) {
      const entry = textIndexOf(model.schema);
      if (!entry) continue;
      const hasLanguageField = Boolean(model.schema.path('language'));
      const [, options] = entry;
      if (hasLanguageField && options?.language_override !== 'textSearchLanguage') {
        offenders.push(name);
      }
    }
    expect(offenders, `these models will reject non-English rows: ${offenders.join(', ')}`).toEqual([]);
  });
});
