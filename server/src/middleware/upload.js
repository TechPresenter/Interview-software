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

/** Scans and phone photos of a CV — read by OCR (services/ocr.service.js). */
const RESUME_EXTS = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'];

const extOf = (name) => (String(name).match(/\.[^.]+$/) || [''])[0].toLowerCase();

export const uploadResume = multer({
  storage,
  // Scans are heavier than exported PDFs; 5 MB rejected ordinary phone photos.
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept on EITHER mimetype or extension. Browsers and mobile clients send
    // application/octet-stream for .docx often enough that a mimetype-only gate
    // rejected real resumes — the knowledge-base filter has always keyed off the
    // extension for exactly this reason.
    if (RESUME_TYPES.has(file.mimetype) || file.mimetype.startsWith('image/')) return cb(null, true);
    if (RESUME_EXTS.includes(extOf(file.originalname))) return cb(null, true);
    cb(ApiError.badRequest('Upload a PDF, DOCX, TXT, or an image of the resume (PNG/JPG).'));
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

/** Full interview recording (webm/mp4) — fallback single upload. */
export const uploadMedia = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB (full 1080p interview)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') return cb(null, true);
    cb(ApiError.badRequest('Only audio or video recordings are allowed'));
  },
}).single('recording');

/**
 * A single MediaRecorder chunk (streamed to the server during the interview and
 * appended to the recording file). Small per chunk, so it never trips a size cap
 * and the full-length 1080p recording is captured incrementally.
 */
export const uploadRecordingChunk = multer({
  storage,
  limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB per chunk (generous)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') return cb(null, true);
    cb(ApiError.badRequest('Only recording chunks are allowed'));
  },
}).single('chunk');

/** Knowledge-base documents (multiple). PDF/DOCX/TXT/MD/CSV/XLSX/PPTX/ZIP. */
const KB_EXTS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.xlsx', '.xls', '.pptx', '.ppt', '.zip',
  // Scanned pages and photos, read via OCR.
  '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'];
export const uploadKnowledge = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25 MB each, up to 10
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (KB_EXTS.includes(ext)) return cb(null, true);
    cb(ApiError.badRequest(`Unsupported file type. Allowed: ${KB_EXTS.join(', ')}`));
  },
}).array('files', 10);
