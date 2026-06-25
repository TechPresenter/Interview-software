import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import { nanoid } from 'nanoid';

import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { router as apiRouter } from './routes/index.js';
import { router as webhookRouter } from './routes/webhook.routes.js';

/**
 * Builds and returns the configured Express app (no listening). Kept separate
 * from server.js so it can be imported in tests.
 */
export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS — credentialed, restricted to the client origin
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    }),
  );

  // Payment webhooks need the RAW body for signature verification, so they are
  // mounted before the JSON parser.
  app.use(`${config.apiPrefix}/webhooks`, webhookRouter);

  // Body & cookie parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Hardening
  app.use(mongoSanitize());
  app.use(hpp());
  app.use(compression());

  // Request id + structured logging
  app.use((req, _res, next) => {
    req.id = req.headers['x-request-id'] || nanoid(12);
    next();
  });
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));

  // Serve uploaded files (dev/local storage; use object storage in prod).
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // Friendly root so hitting the API host directly isn't a scary 404.
  app.get('/', (_req, res) =>
    res.json({
      success: true,
      name: 'HireSense API',
      message: `This is the API server. Open the web app at ${config.clientUrl}`,
      api: config.apiPrefix,
      health: '/health',
    }),
  );

  // Health check (before rate limiter so probes never get throttled)
  app.get('/health', (_req, res) =>
    res.json({ success: true, status: 'ok', uptime: process.uptime(), ts: Date.now() }),
  );

  // Rate limiting + API routes
  app.use(config.apiPrefix, globalLimiter, apiRouter);

  // 404 + central error handler
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
