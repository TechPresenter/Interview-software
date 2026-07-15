import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as room from '../services/room.service.js';
import * as ttsService from '../services/tts.service.js';
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

/**
 * POST /interview-room/:token/tts — synthesize question/intro audio with Sarvam
 * (natural Indian voice, EN/HI). Token-gated so the paid key can't be abused.
 * Returns { audios: [], enabled:false } when Sarvam isn't configured; the client
 * then falls back to the browser's speech synthesis.
 */
export const tts = asyncHandler(async (req, res) => {
  await room.loadByToken(req.params.token); // authorize by unguessable token
  const { text, lang, gender } = req.body || {};
  if (!text || typeof text !== 'string') throw ApiError.badRequest('text is required');
  const result = await ttsService.synthesize({
    text: text.slice(0, 4000),
    lang: lang === 'hi' ? 'hi' : 'en',
    gender: gender === 'male' ? 'male' : gender === 'auto' ? 'auto' : 'female',
  });
  return ok(res, result || { audios: [], mime: null });
});

/** POST /interview-room/:token/complete */
export const complete = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.complete(interview), 'Interview completed');
});

/** POST /interview-room/:token/proctoring — anti-cheat event(s) (single or batched). */
export const proctoring = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  if (interview.status !== 'in_progress' && interview.status !== 'flagged') {
    return ok(res, { ignored: true });
  }
  return ok(res, await room.recordProctoring(interview, req.body));
});

/** POST /interview-room/:token/device — device + network fingerprint (§10). */
export const device = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  return ok(res, await room.recordDevice(interview, req.body), 'Device info recorded');
});

/** POST /interview-room/:token/evidence — screenshot / webcam snapshot (§13). */
export const evidence = asyncHandler(async (req, res) => {
  const interview = await room.loadByToken(req.params.token);
  if (interview.status !== 'in_progress' && interview.status !== 'flagged') {
    return ok(res, { ignored: true });
  }
  return ok(res, await room.recordEvidence(interview, req.body), 'Evidence saved');
});

/** POST /interview-room/:token/recording — upload captured media. */
export const recording = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Recording file required (field "recording")');
  // Already resolved by resolveRoomToken, which runs ahead of multer so a bad
  // token is rejected before the body is buffered.
  const interview = req.interview;
  const { url } = await saveBuffer(req.file.buffer, req.file.originalname || 'recording.webm');
  if (req.file.mimetype.startsWith('video/')) interview.recordings.videoUrl = url;
  else interview.recordings.audioUrl = url;
  await interview.save();
  return ok(res, { url }, 'Recording saved');
});

/**
 * POST /interview-room/:token/recording-chunk — append one MediaRecorder chunk to
 * the interview's recording file (incremental, full-length 1080p capture).
 * Query: ?first=1 on the first chunk (creates the file), ?ext=webm|mp4.
 */
export const recordingChunk = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Recording chunk required (field "chunk")');
  const interview = req.interview; // resolved before multer — see room.routes.js
  const first = req.query.first === '1' || req.query.first === 'true';
  return ok(res, await room.appendRecordingChunk(interview, req.file.buffer, { first, ext: req.query.ext || 'webm' }));
});
