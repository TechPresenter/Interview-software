import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as room from '../services/room.service.js';
import { saveBuffer } from '../services/file.service.js';

/**
 * Public, token-gated interview room. No login: the candidate is authorized by
 * possession of the unguessable interview accessToken in the invite link.
 */

/** GET /interview-room/:token — room view + pre-check config. */
export const getRoom = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token, { lean: false });
  return ok(res, await room.roomView(interview));
});

/** POST /interview-room/:token/start */
export const start = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.start(interview, { language: req.body?.language }), 'Interview started');
});

/** POST /interview-room/:token/answer */
export const answer = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.answer(interview, req.body));
});

/** POST /interview-room/:token/skip — skip / ask another (limited). */
export const skip = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.skip(interview));
});

/** POST /interview-room/:token/language — switch EN/HI mid-interview. */
export const language = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.setLanguage(interview, req.body?.language), 'Language updated');
});

/** POST /interview-room/:token/complete */
export const complete = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.complete(interview), 'Interview completed');
});

/** POST /interview-room/:token/proctoring — anti-cheat event. */
export const proctoring = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  if (interview.status !== 'in_progress' && interview.status !== 'flagged') {
    return ok(res, { ignored: true });
  }
  return ok(res, await room.recordProctoring(interview, req.body));
});

/** POST /interview-room/:token/recording — upload captured media. */
export const recording = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Recording file required (field "recording")');
  const interview = await room.loadByToken(req.params.token);
  const { url } = await saveBuffer(req.file.buffer, req.file.originalname || 'recording.webm');
  if (req.file.mimetype.startsWith('video/')) interview.recordings.videoUrl = url;
  else interview.recordings.audioUrl = url;
  await interview.save();
  return ok(res, { url }, 'Recording saved');
});
