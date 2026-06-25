import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { captureException } from '../services/observability.js';

/** 404 handler — must be registered after all routes. */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Normalizes known error types (Zod, Mongoose, JWT,
 * ApiError) into the standard error envelope and hides internals in prod.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;
  let code = err.code;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = err.flatten().fieldErrors;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    code = 'CAST_ERROR';
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
    code = 'DUPLICATE_KEY';
    details = err.keyValue;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  if (statusCode >= 500) {
    logger.error({ err, reqId: req.id, path: req.originalUrl }, 'Unhandled error');
    captureException(err, { reqId: req.id, path: req.originalUrl, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    details,
    ...(config.isProd ? {} : { stack: err.stack }),
  });
}

export default errorHandler;
