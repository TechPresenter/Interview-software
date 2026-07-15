import path from 'node:path';
import fs from 'node:fs/promises';
import { logger } from '../config/logger.js';

/**
 * Optical character recognition for documents that are pictures of words —
 * scanned resumes, phone photos of a CV, image-only PDFs.
 *
 * This is the slow path and exists only as a fallback: a PDF with a real text
 * layer is read directly by file.service (milliseconds, perfectly accurate).
 * OCR is seconds per page and never perfect, so we reach for it only when there
 * is nothing else to read.
 *
 * Tesseract downloads its ~5MB language model on first use. Left alone it writes
 * that into process.cwd(), which puts an untracked 5MB blob in the repo and
 * depends on the working directory being writable. We pin it to a known cache
 * directory instead, created on demand.
 */

const CACHE_DIR = path.resolve(process.cwd(), '.tesseract');

/** OCR is CPU-bound; a page of dense text costs roughly a second. */
const DEFAULT_MAX_PAGES = 8;

/** Rendering at 1x is unreadable to Tesseract; ~2x is the accuracy/cost knee. */
const RENDER_SCALE = 2;

let workerPromise = null;

/**
 * One shared worker, created on demand.
 *
 * Spinning one up costs ~600ms and a language model load, so a worker per upload
 * would dominate the request. Tesseract workers are single-threaded, so calls are
 * serialised through `queue` below rather than run in parallel — concurrent OCR
 * on one core is slower than sequential and risks exhausting memory.
 */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, { cachePath: CACHE_DIR, gzip: true });
    })().catch((err) => {
      // Let the next call retry rather than caching a permanent failure.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Serialises OCR work; see getWorker. */
let queue = Promise.resolve();
function enqueue(job) {
  const run = queue.then(job, job);
  // Keep the chain alive regardless of this job's outcome.
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/** Whether OCR can run at all. Never throws — callers degrade to "no text". */
export async function ocrAvailable() {
  try {
    await getWorker();
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'OCR is unavailable (language model could not be loaded)');
    return false;
  }
}

/**
 * Read text out of an image buffer (png/jpg/webp/tiff/bmp).
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function ocrImage(buffer) {
  return enqueue(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    return { text: (data.text || '').trim(), confidence: data.confidence ?? 0 };
  });
}

/**
 * Rasterise a PDF and read the words out of the pictures.
 *
 * @param {Buffer} buffer
 * @param {{maxPages?: number}} [opts]
 * @returns {Promise<{text: string, confidence: number, pages: number, truncated: boolean}>}
 */
export async function ocrPdf(buffer, { maxPages = DEFAULT_MAX_PAGES } = {}) {
  const [pdfjs, { createCanvas }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('@napi-rs/canvas'),
  ]);

  // pdf.js takes ownership of the array it is handed; multer's Buffer is a view
  // into a shared pool, so it gets a copy of its own.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  try {
    const pages = Math.min(doc.numPages, maxPages);
    const texts = [];
    const confidences = [];

    for (let i = 1; i <= pages; i += 1) {
      // Sequential by necessity: rendering and OCR both hold real memory, and a
      // long scan rendered all at once will exhaust it.
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      // Scans are white paper; without this the page renders onto transparency
      // and Tesseract sees black-on-black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const { text, confidence } = await ocrImage(canvas.toBuffer('image/png'));
      if (text) {
        texts.push(text);
        confidences.push(confidence);
      }
    }

    return {
      text: texts.join('\n\n').trim(),
      confidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0,
      pages,
      truncated: doc.numPages > pages,
    };
  } finally {
    await doc.destroy();
  }
}

/** Release the worker (tests, graceful shutdown). */
export async function shutdownOcr() {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  if (w) await w.terminate();
}

export default { ocrImage, ocrPdf, ocrAvailable, shutdownOcr };
