import { getIO } from './index.js';
import { logger } from '../config/logger.js';

/**
 * Server-side push helpers used by services/controllers to deliver realtime
 * updates without coupling them to Socket.IO internals. Safe to call even if a
 * socket layer isn't ready (logs and no-ops).
 */

function safeEmit(room, event, payload) {
  try {
    getIO().to(room).emit(event, payload);
  } catch (err) {
    logger.debug({ err: err.message, room, event }, 'emit skipped');
  }
}

/** Push a notification to a single user. */
export const emitToUser = (userId, event, payload) => safeEmit(`user:${userId}`, event, payload);

/** Broadcast to everyone in a company (dashboards, activity feed). */
export const emitToCompany = (companyId, event, payload) =>
  safeEmit(`company:${companyId}`, event, payload);

/** Broadcast within a live interview room. */
export const emitToInterview = (interviewId, event, payload) =>
  safeEmit(`interview:${interviewId}`, event, payload);

export default { emitToUser, emitToCompany, emitToInterview };
