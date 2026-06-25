import mongoose from 'mongoose';
import { config } from './index.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB with sensible pool settings and lifecycle logging.
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB() {
  mongoose.connection.on('connected', () => logger.info('🍃 MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(config.mongoUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !config.isProd, // build indexes in dev; manage explicitly in prod
  });

  return mongoose;
}

export async function disconnectDB() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}
