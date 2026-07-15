import { ApiError } from '../utils/ApiError.js';
import { zodErrorDetails } from '../utils/zodError.js';

/**
 * Validates req[part] against a Zod schema and replaces it with the parsed,
 * type-coerced result. Throws a 400 carrying per-field messages on failure.
 *
 * `details` is keyed by the full dotted path ('config.experienceLevel') so a
 * client can point at the exact input, and `message` names the first failing
 * field instead of the bare "Validation failed" that was all the interview
 * scheduler ever showed. See utils/zodError.js for why.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} [part]
 */
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (result.success) {
      req[part] = result.data;
      return next();
    }
    const { details, message } = zodErrorDetails(result.error);
    return next(ApiError.badRequest(message, { code: 'VALIDATION_ERROR', details }));
  };
}

export default validate;
