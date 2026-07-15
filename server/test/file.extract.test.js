import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The routing around extraction, not the parsers themselves.
 *
 * Real OCR costs seconds and a 5MB model download, so ocr.service is stubbed:
 * what matters here is WHEN we fall back to it and what we tell the user when
 * everything fails. Those are the parts that regress silently — the old
 * extractor returned '' for every failure, so a corrupt upload and an empty one
 * were indistinguishable.
 */

const { ocrPdf, ocrImage } = vi.hoisted(() => ({ ocrPdf: vi.fn(), ocrImage: vi.fn() }));
vi.mock('../src/services/ocr.service.js', () => ({ ocrPdf, ocrImage }));

const { extractText, ExtractionError } = await import('../src/services/file.service.js');

/** A PDF with a real text layer, built the way an exported resume is. */
async function textPdf(lines) {
  const { default: PDFDocument } = await import('pdfkit');
  return new Promise((res) => {
    const d = new PDFDocument();
    const chunks = [];
    d.on('data', (c) => chunks.push(c));
    d.on('end', () => res(Buffer.concat(chunks)));
    for (const l of lines) d.fontSize(12).text(l);
    d.end();
  });
}

describe('extractText · plain formats', () => {
  it('reads a txt buffer', async () => {
    expect(await extractText(Buffer.from('Asha Menon'), 'text/plain', 'cv.txt')).toBe('Asha Menon');
  });

  it('rejects an empty file with a reason', async () => {
    await expect(extractText(Buffer.alloc(0), 'application/pdf', 'x.pdf')).rejects.toThrow(ExtractionError);
  });

  it('rejects a file that claims .pdf but is not one', async () => {
    const err = await extractText(Buffer.from('just some text'), 'application/pdf', 'fake.pdf').catch((e) => e);
    expect(err).toBeInstanceOf(ExtractionError);
    expect(err.code).toBe('not_a_pdf');
  });

  it('rejects legacy .doc with an actionable message rather than silence', async () => {
    // OLE compound-file magic — a real .doc. mammoth reads OOXML only.
    const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64)]);
    const err = await extractText(ole, 'application/msword', 'old.doc').catch((e) => e);
    expect(err.code).toBe('legacy_doc');
    expect(err.message).toMatch(/docx|Save As/i);
  });
});

describe('extractText · PDFs', () => {
  beforeEach(() => {
    ocrPdf.mockReset();
    ocrImage.mockReset();
  });

  // The bug that started all this: pdf-parse returned different text for the
  // same bytes. Reading one buffer repeatedly must give one answer.
  // Five real parses; the default 5s budget is tight once vitest runs files in
  // parallel and they contend for CPU, and a timeout here would read as a
  // determinism failure rather than a slow machine.
  it('reads the same PDF identically every time', async () => {
    const pdf = await textPdf(['Asha Menon asha@example.com Node.js']);
    const runs = [];
    for (let i = 0; i < 5; i += 1) runs.push(await extractText(pdf, 'application/pdf', 'a.pdf'));
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toContain('Asha Menon');
    // A readable text layer must never reach the slow path.
    expect(ocrPdf).not.toHaveBeenCalled();
  }, 30_000);

  it('falls back to OCR only when there is no text layer', async () => {
    ocrPdf.mockResolvedValue({ text: 'Asha Menon (scanned)', confidence: 91, pages: 1, truncated: false });
    // A valid PDF with no drawn text: nothing for pdf.js to find.
    const blank = await textPdf([]);
    expect(await extractText(blank, 'application/pdf', 'scan.pdf')).toBe('Asha Menon (scanned)');
    expect(ocrPdf).toHaveBeenCalledOnce();
  });

  it('says so plainly when OCR also finds nothing', async () => {
    ocrPdf.mockResolvedValue({ text: '', confidence: 0, pages: 1, truncated: false });
    const blank = await textPdf([]);
    const err = await extractText(blank, 'application/pdf', 'scan.pdf').catch((e) => e);
    expect(err.code).toBe('ocr_failed');
    expect(err.message).toMatch(/scan/i);
  });

  it('does not fail the upload when OCR itself throws', async () => {
    ocrPdf.mockRejectedValue(new Error('tesseract exploded'));
    const blank = await textPdf([]);
    const err = await extractText(blank, 'application/pdf', 'scan.pdf').catch((e) => e);
    // A broken OCR engine is still an ExtractionError the caller can show, not a 500.
    expect(err).toBeInstanceOf(ExtractionError);
    expect(err.code).toBe('ocr_failed');
  });
});

describe('extractText · images', () => {
  beforeEach(() => ocrImage.mockReset());

  it('OCRs a photographed resume', async () => {
    ocrImage.mockResolvedValue({ text: 'Asha Menon', confidence: 88 });
    expect(await extractText(Buffer.from('fake-png-bytes'), 'image/png', 'cv.png')).toBe('Asha Menon');
    expect(ocrImage).toHaveBeenCalledOnce();
  });

  it('explains an unreadable photo', async () => {
    ocrImage.mockResolvedValue({ text: '', confidence: 0 });
    const err = await extractText(Buffer.from('blur'), 'image/jpeg', 'cv.jpg').catch((e) => e);
    expect(err.code).toBe('ocr_failed');
  });
});
