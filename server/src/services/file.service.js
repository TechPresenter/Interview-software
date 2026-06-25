import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

/**
 * Local-disk file storage + resume text extraction.
 *
 * NOTE: local disk is fine for dev / single-node. In production swap `saveBuffer`
 * for an S3/GCS upload (return the object URL) — the rest of the code only cares
 * about the returned { url, filename }.
 */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/** Persist a buffer and return a public-ish path + stored filename. */
export async function saveBuffer(buffer, originalName) {
  await ensureDir();
  const ext = path.extname(originalName || '').toLowerCase();
  const filename = `${crypto.randomBytes(12).toString('hex')}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, filename };
}

/**
 * Extract plaintext from a resume buffer (PDF, DOCX, or TXT). Heavy parsers are
 * imported lazily so a parsing issue never breaks module load, and failures
 * degrade gracefully to empty text.
 * @returns {Promise<string>}
 */
export async function extractText(buffer, mimetype = '', originalName = '') {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (mimetype.includes('pdf') || ext === '.pdf') {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
      const data = await pdfParse(buffer);
      return (data.text || '').trim();
    }
    if (mimetype.includes('word') || ext === '.docx') {
      const { default: mammoth } = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer });
      return (value || '').trim();
    }
    // Plain text / fallback
    return buffer.toString('utf8').trim();
  } catch (err) {
    logger.warn({ err: err.message }, 'Resume text extraction failed');
    return '';
  }
}

export default { saveBuffer, extractText };
