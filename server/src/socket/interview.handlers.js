import { logger } from '../config/logger.js';

/**
 * Realtime handlers for the live interview room. The heavy lifting (engine calls,
 * persistence) lands in Phase 4; this wires the event surface and rooms so the
 * client and the AI loop can communicate.
 *
 * Rooms: `interview:{id}` — joined by the candidate's socket and any recruiter
 * watching live.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerInterviewHandlers(io, socket) {
  // Candidate / observer joins an interview room.
  socket.on('interview:join', ({ interviewId }) => {
    if (!interviewId) return;
    socket.join(`interview:${interviewId}`);
    socket.to(`interview:${interviewId}`).emit('interview:presence', {
      user: socket.user.id,
      status: 'joined',
    });
  });

  // Candidate submits an answer (Phase 4 pipes this into the scoring engine).
  socket.on('interview:answer', (payload) => {
    logger.debug({ interview: payload?.interviewId }, 'answer received (realtime)');
    // Phase 4: validate ownership, persist Answer, run scoring, emit next question.
    socket.to(`interview:${payload?.interviewId}`).emit('interview:answer:ack', {
      order: payload?.order,
    });
  });

  // Anti-cheat: client streams proctoring events; we relay to observers and (P4)
  // persist + recompute the integrity score.
  socket.on('interview:proctoring', (event) => {
    if (!event?.interviewId || !event?.type) return;
    io.to(`interview:${event.interviewId}`).emit('interview:proctoring:event', {
      type: event.type,
      severity: event.severity || 'low',
      at: Date.now(),
    });
  });

  socket.on('interview:leave', ({ interviewId }) => {
    if (interviewId) socket.leave(`interview:${interviewId}`);
  });
}

export default registerInterviewHandlers;
