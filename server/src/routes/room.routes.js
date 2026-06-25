import { Router } from 'express';
import * as roomCtrl from '../controllers/room.controller.js';
import { validate } from '../middleware/validate.js';
import { uploadMedia } from '../middleware/upload.js';
import { answerSchema, proctoringSchema, startSchema, languageSchema } from '../validators/room.validators.js';

/**
 * Public interview room. Authorization is by the unguessable accessToken in the
 * URL — no JWT. Mounted under /interview-room.
 */
export const router = Router();

router.get('/:token', roomCtrl.getRoom);
router.post('/:token/start', validate(startSchema), roomCtrl.start);
router.post('/:token/answer', validate(answerSchema), roomCtrl.answer);
router.post('/:token/skip', roomCtrl.skip);
router.post('/:token/language', validate(languageSchema), roomCtrl.language);
router.post('/:token/complete', roomCtrl.complete);
router.post('/:token/proctoring', validate(proctoringSchema), roomCtrl.proctoring);
router.post('/:token/recording', uploadMedia, roomCtrl.recording);

export default router;
