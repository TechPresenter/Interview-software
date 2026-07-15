import { z } from 'zod';

/**
 * Validator building blocks shared across the request schemas.
 *
 * THE EMPTY STRING PROBLEM
 * ------------------------
 * An HTML <select> with a placeholder option yields '' when nothing is chosen,
 * and JSON has no way to say "the user left this alone" other than omitting the
 * key. So browsers send '' for optional fields constantly. zod's `.optional()`
 * accepts `undefined` and nothing else, which means:
 *
 *   z.enum(['fresher','junior',...]).optional()   +   ''
 *   → "Invalid enum value. Expected 'fresher' | ... , received ''"
 *
 * That one mismatch made it impossible to schedule an interview at all: the
 * scheduling modal's DEFAULT_CFG carried `experienceLevel: ''`, so every request
 * with the default config was rejected before it reached the controller, and the
 * UI only showed "Validation failed".
 *
 * The trap is easy to fall into and has been hit here before — candidate gender
 * was "fixed" by adding '' to the enum itself, which drags a UI artifact into
 * the domain model and makes '' a legal stored value forever.
 *
 * These helpers do it the other way round: normalise '' to undefined BEFORE
 * validating, so "not chosen" and "not sent" mean the same thing to the schema,
 * and the enum stays honest about the domain.
 */

/** '' / '   ' → undefined. Anything else passes through untouched. */
export const emptyToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** An optional enum that treats '' ("nothing selected") as absent. */
export const optionalEnum = (values) => z.preprocess(emptyToUndefined, z.enum(values).optional());

/** As optionalEnum, but null is also allowed through — for fields a client clears explicitly. */
export const nullishEnum = (values) => z.preprocess(emptyToUndefined, z.enum(values).nullish());

/** A required Mongo ObjectId. */
export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/**
 * An optional ObjectId that treats '' as absent — same reason as optionalEnum:
 * an unselected <Select> sends '', and "no question set chosen" must not read as
 * "here is a malformed id".
 */
export const optionalId = z.preprocess(emptyToUndefined, objectId.optional());

/** As optionalId, but an explicit null is allowed (clearing an existing link). */
export const nullishId = z.preprocess(emptyToUndefined, objectId.nullish());

export default { emptyToUndefined, optionalEnum, nullishEnum, objectId, optionalId, nullishId };
