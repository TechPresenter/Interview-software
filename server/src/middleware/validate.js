import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req[part] against a Zod schema and replaces it with the parsed,
 * type-coerced result. Throws a 400 with field errors on failure.
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} [part]
 */
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(
        ApiError.badRequest('Validation failed', {
          code: 'VALIDATION_ERROR',
          details: result.error.flatten().fieldErrors,
        }),
      );
    }
    req[part] = result.data;
    next();
  };
}

export default validate;
