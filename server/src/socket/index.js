import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifyAccessToken } from '../utils/tokens.js';
import { duplicateRedis } from '../config/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { registerInterviewHandlers } from './interview.handlers.js';

let io = null;

/** Returns the live Socket.IO server (throws if not yet initialized). */
export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

/**
 * Initializes Socket.IO with JWT auth and the Redis adapter (for horizontal
 * scaling). Joins each connection to user/company rooms so the rest of the app
 * can target audiences precisely.
 * @param {import('http').Server} httpServer
 */
export async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    maxHttpBufferSize: 5e6,
  });

  // Redis adapter for multi-instance broadcasting.
  const pub = duplicateRedis();
  const sub = duplicateRedis();
  io.adapter(createAdapter(pub, sub));

  // Authenticate every socket via the access token in the handshake.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.slice(7);
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      socket.user = { id: payload.sub, role: payload.role, company: payload.company };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, company } = socket.user;
    socket.join(`user:${id}`);
    if (company) socket.join(`company:${company}`);
    logger.debug({ socketId: socket.id, user: id }, 'socket connected');

    registerInterviewHandlers(io, socket);

    socket.on('disconnect', (reason) =>
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected'),
    );
  });

  logger.info('🔌 Socket.IO initialized');
  return io;
}

export default initSocket;
