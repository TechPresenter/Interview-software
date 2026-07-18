import { Router } from 'express';
import multer from 'multer';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { applicationConfig } from '../services/application.service.js';
import { applySchema, verifyCodeSchema } from '../validators/application.validators.js';
import * as application from '../controllers/application.controller.js';

/**
 * The public "Apply for Interview" endpoints. No authentication: everything that
 * reaches these three handlers came from the open internet. Mounted under /apply.
 */
export const router = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * Multipart
 *
 * This belongs in middleware/upload.js with its siblings, and should be moved
 * there. It is here because every exported instance in that file is .single() or
 * .array(), and this form needs .fields() — resume and photo arrive together, in
 * one request, or the applicant fills the form twice.
 * ──────────────────────────────────────────────────────────────────────────── */

const RESUME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);
const RESUME_EXTS = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'];
const extOf = (name) => (String(name).match(/\.[^.]+$/) || [''])[0].toLowerCase();

/**
 * Per-field acceptance, which is the point of doing this by hand: the resume box
 * takes documents and photographs of documents (file.service OCRs those), while
 * the photo box takes an image and nothing else. One shared filter would let a
 * .docx be submitted as someone's passport photo.
 *
 * The resume side accepts on mimetype OR extension for the reason upload.js
 * gives: browsers and phones send application/octet-stream for .docx often enough
 * that a mimetype-only gate rejects real resumes.
 */
const applicationFileFilter = (_req, file, cb) => {
  if (file.fieldname === 'photo') {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(ApiError.badRequest('Your photo must be an image file (JPG or PNG).'));
  }
  if (file.fieldname === 'resume') {
    if (RESUME_TYPES.has(file.mimetype) || file.mimetype.startsWith('image/')) return cb(null, true);
    if (RESUME_EXTS.includes(extOf(file.originalname))) return cb(null, true);
    return cb(ApiError.badRequest('Upload your resume as a PDF, DOCX, TXT, or a clear photo of it (PNG/JPG).'));
  }
  return cb(ApiError.badRequest(`Unexpected file field "${file.fieldname}".`));
};

const uploadApplicationFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Matches uploadResume: a phone photo of a CV is heavier than an exported PDF.
    // multer caps per FILE, not per field, so this is also the ceiling a photo can
    // reach here — the real 3 MB photo rule is enforced in the controller, once
    // the byte count is actually known.
    fileSize: 15 * 1024 * 1024,
    files: 2,
    // ~28 text fields PLUS one per skill: multipart has no array type, so the
    // client sends `skills[]` repeated, and the validator allows 50 of them.
    // A cap of 40 therefore rejected any applicant who listed more than a dozen
    // skills — with LIMIT_FIELD_COUNT, which says nothing they could act on.
    // 100 leaves headroom above the 50-skill ceiling the schema already enforces.
    // The limit still exists because the default (Infinity) lets an anonymous
    // request tie up the parser with junk no schema would have accepted.
    fields: 100,
    fieldSize: 16 * 1024,
  },
  fileFilter: applicationFileFilter,
}).fields([
  { name: 'resume', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]);

/**
 * multer's own failures are MulterError, which carries a `code` ('LIMIT_FILE_SIZE')
 * but no `statusCode` — so errorHandler defaults them to 500 and an applicant who
 * picked a 20 MB scan is told the server broke, is paged as an Unhandled error, and
 * is billed to Sentry. Translated here into the 400s they are.
 */
const receiveFiles = (req, res, next) =>
  uploadApplicationFiles(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'That file is too large. Resumes must be under 15 MB and photos under 3 MB.'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Unexpected file field "${err.field}". Attach one resume and one photo.`
            : 'We could not read the files you attached. Please try again.';
      return next(ApiError.badRequest(message, { code: err.code }));
    }
    return next(err); // an ApiError from the fileFilter — already the right shape
  });

/**
 * Turn away a closed form BEFORE multer allocates anything.
 *
 * createApplication() checks this too, and that check is the real rule — but it
 * runs after the body is already buffered in RAM. Ordering matters here for the
 * same reason it does on the interview room's upload routes: multer reads the
 * entire request the moment it runs, so gating afterwards means an internet-facing
 * endpoint will happily buffer 30 MB per request for a form that is switched off.
 * The config read is Redis-cached, so this costs approximately nothing.
 */
const ensureApplicationsOpen = asyncHandler(async (_req, _res, next) => {
  const { enabled } = await applicationConfig();
  if (!enabled) {
    throw ApiError.forbidden('Applications are closed at the moment. Please check back soon.', { code: 'APPLICATIONS_CLOSED' });
  }
  next();
});

/* ── Routes ───────────────────────────────────────────────────────────────── */

router.get('/config', application.getConfig);

/**
 * Order is load-bearing:
 *   limiter → open? → files → validate → handler
 * The two cheap gates run before multer buffers up to 30 MB of attacker-controlled
 * bytes; validate runs after it, because until multer has parsed the multipart
 * body there is no req.body for a schema to see.
 */
router.post('/', contactLimiter, ensureApplicationsOpen, receiveFiles, validate(applySchema), application.submit);

/**
 * Resume/retry the fee payment for an application awaiting it. Rate-limited like
 * submit because it reaches the payment gateway on every call.
 */
router.post('/checkout/:code', contactLimiter, validate(verifyCodeSchema, 'params'), application.checkout);

/** The return-from-gateway status page reads (and reconciles) payment here. */
router.get('/status/:code', validate(verifyCodeSchema, 'params'), application.status);

router.get('/verify/:code', validate(verifyCodeSchema, 'params'), application.verify);

export default router;
