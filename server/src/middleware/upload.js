import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

/**
 * In-memory multipart handling. Buffers are passed to file.service for storage +
 * text extraction, so we don't depend on a particular disk layout here.
 */
const storage = multer.memoryStorage();

const RESUME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);

export const uploadResume = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (RESUME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Only PDF, DOCX, or TXT resumes are allowed'));
  },
}).single('resume');

export const uploadCsv = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes('csv') || file.originalname.endsWith('.csv')) return cb(null, true);
    cb(ApiError.badRequest('Only CSV files are allowed'));
  },
}).single('file');

/** Branding images (logo, favicon, login/OG images). */
export const uploadImage = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(ApiError.badRequest('Only image files are allowed'));
  },
}).single('image');

/** Interview recording (webm/mp4 audio or video) captured via MediaRecorder. */
export const uploadMedia = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) return cb(null, true);
    cb(ApiError.badRequest('Only audio or video recordings are allowed'));
  },
}).single('recording');
