/**
 * Operational HTTP error. Anything thrown as an ApiError is considered a known,
 * client-safe failure and is rendered by the central error handler.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {object} [options]
   * @param {unknown} [options.details] machine-readable detail (e.g. field errors)
   * @param {string} [options.code] stable error code for the client
   */
  constructor(statusCode, message, { details, code } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', opts) {
    return new ApiError(400, msg, opts);
  }
  static unauthorized(msg = 'Unauthorized', opts) {
    return new ApiError(401, msg, opts);
  }
  static forbidden(msg = 'Forbidden', opts) {
    return new ApiError(403, msg, opts);
  }
  static notFound(msg = 'Not found', opts) {
    return new ApiError(404, msg, opts);
  }
  static conflict(msg = 'Conflict', opts) {
    return new ApiError(409, msg, opts);
  }
  static tooMany(msg = 'Too many requests', opts) {
    return new ApiError(429, msg, opts);
  }
  static internal(msg = 'Internal server error', opts) {
    return new ApiError(500, msg, opts);
  }
}

export default ApiError;
