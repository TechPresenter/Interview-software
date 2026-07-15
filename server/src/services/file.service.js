import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

/**
 * Local-disk file storage + text extraction for resumes and knowledge bases.
 *
 * NOTE: local disk is fine for dev / single-node. In production swap `saveBuffer`
 * for an S3/GCS upload (return the object URL) — the rest of the code only cares
 * about the returned { url, filename }.
 */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Files that must NOT be reachable without a login.
 *
 * `uploads/` is mounted with express.static at app.js:69 — no auth, no expiry —
 * so anything written there is fetchable forever by whoever ends up holding the
 * link, and links travel (browser history, a forwarded PDF, a proxy log, a
 * Referer header). That is an acceptable trade for a company logo. It is not one
 * for a job applicant's passport photo and CV, submitted by a stranger who never
 * agreed to publish them.
 *
 * A sibling directory outside the static mount is the whole mechanism: nothing
 * serves this path, so the only way out is a route that checks who is asking.
 */
const PRIVATE_DIR = path.resolve(process.cwd(), 'private-uploads');

async function ensureDir(dir = UPLOAD_DIR) {
  await fs.mkdir(dir, { recursive: true });
}

const storedName = (originalName) =>
  `${crypto.randomBytes(12).toString('hex')}${path.extname(originalName || '').toLowerCase()}`;

/** Persist a buffer and return a public-ish path + stored filename. */
export async function saveBuffer(buffer, originalName) {
  await ensureDir();
  const filename = storedName(originalName);
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, filename };
}

/**
 * Persist a buffer somewhere nothing serves.
 *
 * Returns no url on purpose: there is no address for this file, and a caller
 * that wants one has to go through a route that authenticates first. Storing a
 * url would be the bug — see Application's fileSchema, which omits it for the
 * same reason.
 */
export async function savePrivateBuffer(buffer, originalName) {
  await ensureDir(PRIVATE_DIR);
  const filename = storedName(originalName);
  await fs.writeFile(path.join(PRIVATE_DIR, filename), buffer);
  return { filename };
}

/**
 * Resolve a stored private filename to a real path, or null.
 *
 * The name comes from our own database, but this still refuses anything that
 * escapes the directory: "it came from the DB" is an argument about today's
 * writers, and the check has to hold for tomorrow's. `..%2f..%2fetc/passwd`
 * arriving through some future import path must read a file it is not allowed to
 * read, and the containment test is what makes that structurally impossible
 * rather than merely unlikely.
 */
export function privateFilePath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  // path.resolve collapses '..' and absolutises BEFORE the comparison, so a
  // stored '../../../.env' and an absolute '/etc/passwd' both land outside and
  // return null. The trailing separator is load-bearing: without it a sibling
  // '/app/private-uploads-backup/x' passes a bare startsWith(). Containment
  // rather than a basename test, so a future layout that files uploads under a
  // subdirectory keeps working — containment is the property that matters.
  const resolved = path.resolve(PRIVATE_DIR, filename);
  return resolved.startsWith(PRIVATE_DIR + path.sep) ? resolved : null;
}

/** Remove a private file. Never throws — a missing file is already the goal. */
export async function deletePrivateFile(filename) {
  const p = privateFilePath(filename);
  if (!p) return false;
  try {
    await fs.unlink(p);
    return true;
  } catch {
    return false;
  }
}

export { PRIVATE_DIR };

/**
 * A file we could not read, with a reason worth showing the person who uploaded it.
 * `code` lets callers distinguish "give us a different file" from "try again".
 */
export class ExtractionError extends Error {
  constructor(message, code = 'unreadable') {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

/** A PDF's bytes are only a PDF if they say so; multipart mishaps land here first. */
const looksLikePdf = (buf) => buf?.length > 4 && buf.slice(0, 5).toString('latin1') === '%PDF-';

/** Photographed or scanned documents; readable only by OCR. */
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];

/** Legacy Word (.doc) is an OLE compound file, not a zip — mammoth cannot read it. */
const looksLikeLegacyDoc = (buf) =>
  buf?.length > 8 && buf.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

/**
 * Pull the text layer out of a PDF.
 *
 * Uses pdfjs-dist rather than pdf-parse: pdf-parse (1.1.4) returns a DIFFERENT
 * answer for the same bytes on repeated calls — measured at 3 successes in 6 on
 * one valid file, failing with "bad XRef entry" / "Invalid number: =". Because
 * extractText swallowed that into '', a resume simply refused to auto-fill about
 * half the time, and knowledge bases silently ingested nothing. pdfjs-dist is
 * Mozilla's own parser and returned 8/8 on the same fixture.
 *
 * `new Uint8Array(buffer)` is deliberate: pdf.js takes ownership of the array it
 * is handed, so passing multer's pooled Buffer view would let it read (and
 * detach) memory that is not ours.
 */
async function extractPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      // A password-protected file should say so, not hang waiting for input.
      password: '',
    }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new ExtractionError('This PDF is password-protected. Remove the password and upload it again.', 'password_protected');
    }
    throw new ExtractionError('This PDF could not be read — it may be corrupted. Try re-exporting or saving it again.', 'corrupt');
  }
  try {
    let out = '';
    for (let i = 1; i <= doc.numPages; i += 1) {
      // Pages are read in order; the parser holds per-document state.
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out += `${content.items.map((it) => it.str).join(' ')}\n`;
      page.cleanup();
    }
    return out.trim();
  } finally {
    await doc.destroy();
  }
}

/**
 * Extract plaintext from a document buffer. Supports PDF, DOCX, TXT/MD, CSV,
 * XLSX, PPTX, and ZIP (recurses into supported members). Heavy parsers are
 * imported lazily.
 *
 * Throws ExtractionError when a file cannot be read. It used to return '' for
 * every failure, which made a corrupt upload indistinguishable from an empty one
 * — the user saw "could not read enough text" with no idea whether the fault was
 * theirs or ours.
 *
 * @returns {Promise<string>}
 * @throws {ExtractionError}
 */
export async function extractText(buffer, mimetype = '', originalName = '') {
  const ext = path.extname(originalName).toLowerCase();
  const mt = mimetype || '';
  if (!buffer?.length) throw new ExtractionError('That file is empty.', 'empty_file');

  try {
    if (mt.includes('pdf') || ext === '.pdf') {
      if (!looksLikePdf(buffer)) {
        throw new ExtractionError('That file is named .pdf but is not a PDF. Re-save it and try again.', 'not_a_pdf');
      }
      const text = await extractPdf(buffer);
      if (text) return text;

      // No text layer: the file is pictures of words (a scan or a phone photo).
      // Reading it costs seconds per page, which is why it is the fallback and
      // never the first attempt.
      logger.info({ originalName }, 'PDF has no text layer; falling back to OCR');
      const { ocrPdf } = await import('./ocr.service.js');
      const ocr = await ocrPdf(buffer).catch((err) => {
        logger.warn({ err: err.message, originalName }, 'OCR failed');
        return null;
      });
      if (ocr?.text) {
        logger.info({ originalName, pages: ocr.pages, confidence: ocr.confidence }, 'OCR extracted text from a scanned PDF');
        return ocr.text;
      }
      throw new ExtractionError(
        'This PDF looks like a scan, and no text could be read from it even with OCR. Try a clearer scan, a text-based PDF, or paste the text instead.',
        'ocr_failed',
      );
    }
    if (IMAGE_EXTS.includes(ext) || mt.startsWith('image/')) {
      // A photographed or scanned resume arrives as a plain image.
      const { ocrImage } = await import('./ocr.service.js');
      const { text } = await ocrImage(buffer).catch(() => ({ text: '' }));
      if (text) return text;
      throw new ExtractionError(
        'No text could be read from that image. A sharper, straight-on photo or scan usually works.',
        'ocr_failed',
      );
    }
    if (ext === '.doc' || looksLikeLegacyDoc(buffer)) {
      // mammoth reads OOXML (.docx) only; handed a .doc it throws "is this a zip
      // file?", which the old catch turned into a silent empty result.
      throw new ExtractionError(
        'Legacy .doc files are not supported. Open it and "Save As" .docx or PDF, then upload again.',
        'legacy_doc',
      );
    }
    if (ext === '.docx' || mt.includes('wordprocessingml') || mt.includes('msword')) {
      const { default: mammoth } = await import('mammoth');
      return ((await mammoth.extractRawText({ buffer })).value || '').trim();
    }
    if (ext === '.csv' || mt.includes('csv')) {
      return buffer.toString('utf8').trim();
    }
    if (ext === '.xlsx' || ext === '.xls' || mt.includes('spreadsheetml') || mt.includes('ms-excel')) {
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      let out = '';
      wb.eachSheet((sheet) => {
        out += `# ${sheet.name}\n`;
        sheet.eachRow((row) => {
          const cells = (row.values || []).slice(1).map((c) => (c == null ? '' : String(typeof c === 'object' && c.text ? c.text : c)));
          out += `${cells.join('\t')}\n`;
        });
      });
      return out.trim();
    }
    if (ext === '.pptx' || mt.includes('presentationml')) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(buffer);
      const slides = Object.keys(zip.files).filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
      let out = '';
      for (const name of slides) {
        const xml = await zip.files[name].async('string');
        out += `${(xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(' ')}\n`;
      }
      return out.trim();
    }
    if (ext === '.zip' || mt.includes('zip')) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(buffer);
      const SUPPORTED = ['.pdf', '.docx', '.txt', '.md', '.csv', '.xlsx', '.pptx'];
      let out = '';
      for (const name of Object.keys(zip.files)) {
        const entry = zip.files[name];
        if (entry.dir || !SUPPORTED.includes(path.extname(name).toLowerCase())) continue;
        const buf = await entry.async('nodebuffer');
        try {
          out += `\n# ${name}\n${await extractText(buf, '', name)}\n`;
        } catch (err) {
          // One unreadable member must not cost the archive: note it and continue.
          logger.warn({ err: err.message, member: name }, 'Skipped an unreadable file inside the archive');
          out += `\n# ${name}\n(could not be read: ${err.message})\n`;
        }
      }
      return out.trim();
    }
    // Plain text / markdown / fallback
    return buffer.toString('utf8').trim();
  } catch (err) {
    // Already diagnosed — pass it to the caller intact.
    if (err instanceof ExtractionError) throw err;
    logger.warn({ err: err.message, originalName }, 'Text extraction failed');
    throw new ExtractionError(
      `Could not read "${originalName || 'that file'}". It may be corrupted or in an unsupported format.`,
      'unreadable',
    );
  }
}

/** Fetch a URL and strip it down to readable text (scripts/styles/tags removed). */
export async function fetchUrlText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HireSenseBot/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (err) {
    logger.warn({ err: err.message, url }, 'URL fetch failed');
    return '';
  }
}

export default { saveBuffer, extractText, fetchUrlText };
