import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { redis } from './config/redis.js';
import { initSocket } from './socket/index.js';
import { initObservability } from './services/observability.js';
import { startScheduler } from './jobs/scheduler.js';

/**
 * Boots the HTTP server, the database, and the realtime layer, and wires up
 * graceful shutdown.
 */
async function bootstrap() {
  await initObservability();
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Realtime (Socket.IO + Redis adapter)
  await initSocket(server);

  server.listen(config.port, () => {
    logger.info(`🚀 API listening on http://localhost:${config.port}${config.apiPrefix}`);
    logger.info(`   env=${config.env}  ai=${config.ai.enabled ? 'on' : 'off'}`);
  });

  // Background scheduler (trial-expiry + renewal reminders).
  startScheduler();

  const shutdown = async (signal) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      await redis.quit();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force-exit if it hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal boot error');
  process.exit(1);
});
