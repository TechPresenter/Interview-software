import { Router } from 'express';
import * as roomCtrl from '../controllers/room.controller.js';
import { validate } from '../middleware/validate.js';
import { uploadMedia, uploadRecordingChunk } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as room from '../services/room.service.js';
import { answerSchema, skipSchema, proctoringSchema, startSchema, languageSchema, deviceSchema, evidenceSchema } from '../validators/room.validators.js';

/**
 * Public interview room. Authorization is by the unguessable accessToken in the
 * URL — no JWT. Mounted under /interview-room.
 */
export const router = Router();

/**
 * Resolve the room token BEFORE any body parsing, and stash the interview.
 *
 * Ordering matters on the upload routes. multer reads and buffers the entire
 * body the moment it runs, and these two use memoryStorage with a 1 GB / 64 MB
 * cap — so mounting it ahead of the token check let anyone on the internet make
 * the server allocate a gigabyte of heap by POSTing to a token that never
 * existed. The 404 only arrived after the bytes were already in RAM. The rest of
 * the app already gets this right (see auth.routes: `authenticate, uploadImage`).
 */
const resolveRoomToken = asyncHandler(async (req, _res, next) => {
  req.interview = await room.loadByToken(req.params.token);
  next();
});

router.get('/:token', roomCtrl.getRoom);
router.post('/:token/start', validate(startSchema), roomCtrl.start);
router.post('/:token/answer', validate(answerSchema), roomCtrl.answer);
router.post('/:token/skip', validate(skipSchema), roomCtrl.skip);
router.post('/:token/language', validate(languageSchema), roomCtrl.language);
router.post('/:token/tts', roomCtrl.tts);
router.post('/:token/complete', roomCtrl.complete);
router.post('/:token/proctoring', validate(proctoringSchema), roomCtrl.proctoring);
router.post('/:token/device', validate(deviceSchema), roomCtrl.device);
router.post('/:token/evidence', validate(evidenceSchema), roomCtrl.evidence);
router.post('/:token/recording', resolveRoomToken, uploadMedia, roomCtrl.recording);
router.post('/:token/recording-chunk', resolveRoomToken, uploadRecordingChunk, roomCtrl.recordingChunk);

export default router;
