/**
 * Turn a ZodError into per-field messages a person can act on.
 *
 * Shared by the validate() middleware (schemas mounted on a route) and the
 * global errorHandler (a ZodError thrown anywhere else, e.g. a service parsing
 * a payload). Both used to report `error.flatten().fieldErrors`, which has two
 * problems:
 *
 *  1. flatten() keys on issue.path[0] ONLY. Every failure inside `config`
 *     collapsed to the key "config", so a bad config.experienceLevel arrived as
 *     { config: ["Invalid enum value..."] } and the caller could not tell which
 *     of ~20 fields was wrong.
 *  2. zod's default text is aimed at the developer who wrote the schema, not the
 *     person filling in the form: "Invalid enum value. Expected 'fresher' |
 *     'junior' | 'mid' | 'senior' | 'lead', received ''".
 *
 * Keeping both copies in sync by hand is how one of them drifts, so there is
 * exactly one implementation and both callers import it.
 */

/** questionCount → "question count" */
const labelOf = (path) =>
  String(path[path.length - 1] ?? 'value').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/** One zod issue → one human sentence. */
export function humanizeIssue(issue) {
  const label = labelOf(issue.path);

  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined') return `${label} is required.`;
      return `${label} must be a ${issue.expected}, but got ${issue.received}.`;
    case 'invalid_enum_value':
      return `${label} must be one of: ${issue.options.join(', ')}.`;
    case 'too_small':
      return issue.type === 'string'
        ? `${label} must be at least ${issue.minimum} character${issue.minimum === 1 ? '' : 's'}.`
        : `${label} must be at least ${issue.minimum}.`;
    case 'too_big':
      return issue.type === 'string'
        ? `${label} must be at most ${issue.maximum} characters.`
        : `${label} must be at most ${issue.maximum}.`;
    case 'invalid_string':
      // A schema can say what it means via .describe() instead of leaking its
      // regex to the user ("Invalid id").
      return issue.message === 'Invalid id' ? `${label} is not a valid selection.` : issue.message;
    case 'unrecognized_keys':
      return `unexpected field${issue.keys.length === 1 ? '' : 's'}: ${issue.keys.join(', ')}.`;
    default:
      return issue.message;
  }
}

/**
 * @param {import('zod').ZodError} error
 * @returns {{ details: Record<string,string>, message: string }}
 *   `details` keyed by full dotted path ('config.experienceLevel') so a client
 *   can point at the exact input; `message` names the first failing field rather
 *   than saying "Validation failed" and leaving the user to guess.
 */
export function zodErrorDetails(error) {
  const details = {};
  for (const issue of error.issues ?? []) {
    const key = issue.path.join('.') || '_';
    // First issue per field wins: zod can stack several onto one field and the
    // first is the one that explains the rest.
    if (!details[key]) details[key] = humanizeIssue(issue);
  }

  const fields = Object.keys(details);
  const first = details[fields[0]];
  const message = !fields.length
    ? 'Validation failed'
    : fields.length === 1
      ? first
      : `${first} (and ${fields.length - 1} other field${fields.length === 2 ? '' : 's'})`;

  return { details, message };
}

export default { humanizeIssue, zodErrorDetails };
