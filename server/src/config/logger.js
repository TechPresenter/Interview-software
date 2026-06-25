import pino from 'pino';
import { config } from './index.js';

/**
 * Application-wide structured logger. Pretty-prints in dev, JSON in prod.
 */
export const logger = pino({
  level: config.isProd ? 'info' : 'debug',
  transport: config.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[redacted]',
  },
});

export default logger;
