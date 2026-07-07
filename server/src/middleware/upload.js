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

/** Rich-text editor image upload (CKEditor SimpleUploadAdapter uses field "upload"). */
export const uploadEditorImage = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(ApiError.badRequest('Only image files are allowed'));
  },
}).single('upload');

/** Interview recording (webm/mp4 audio or video) captured via MediaRecorder. */
export const uploadMedia = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) return cb(null, true);
    cb(ApiError.badRequest('Only audio or video recordings are allowed'));
  },
}).single('recording');

/** Knowledge-base documents (multiple). PDF/DOCX/TXT/MD/CSV/XLSX/PPTX/ZIP. */
const KB_EXTS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.xlsx', '.xls', '.pptx', '.ppt', '.zip'];
export const uploadKnowledge = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25 MB each, up to 10
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (KB_EXTS.includes(ext)) return cb(null, true);
    cb(ApiError.badRequest(`Unsupported file type. Allowed: ${KB_EXTS.join(', ')}`));
  },
}).array('files', 10);
