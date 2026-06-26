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
 * Extract plaintext from a document buffer. Supports PDF, DOCX, TXT/MD, CSV,
 * XLSX, PPTX, and ZIP (recurses into supported members). Heavy parsers are
 * imported lazily; any failure degrades gracefully to empty text.
 * @returns {Promise<string>}
 */
export async function extractText(buffer, mimetype = '', originalName = '') {
  const ext = path.extname(originalName).toLowerCase();
  const mt = mimetype || '';
  try {
    if (mt.includes('pdf') || ext === '.pdf') {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
      return ((await pdfParse(buffer)).text || '').trim();
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
        out += `\n# ${name}\n${await extractText(buf, '', name)}\n`;
      }
      return out.trim();
    }
    // Plain text / markdown / fallback
    return buffer.toString('utf8').trim();
  } catch (err) {
    logger.warn({ err: err.message, originalName }, 'Text extraction failed');
    return '';
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
