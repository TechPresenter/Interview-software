import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { Branding } from '../models/Branding.js';

/**
 * The applicant's record as a PDF.
 *
 * This is the artefact an applicant keeps and an admin prints, so it is held to
 * a stricter standard than a dashboard: it must not overstate what we know. The
 * two rules that shape everything below are (1) a payment the applicant merely
 * *claims* must never read as "Paid", and (2) a value we cannot draw must say so
 * rather than print something else — a PDF that quietly misrepresents a stranger
 * is worse than one that admits a gap.
 *
 * Follows services/export.service.js's pdfkit idiom: A4, collect 'data' chunks,
 * resolve a single Buffer on 'end', same palette. It does not live there because
 * that file is report/invoice exports for companies; this is platform-level and
 * needs branding + QR + font machinery none of those want.
 */

/* ── palette (matches export.service.js) ───────────────── */
const BRAND = '#6366f1';
const INK = '#111';
const SUB = '#666';
const FOOT = '#999';
const RULE = '#e5e7eb';

const MARGIN = 50;
/**
 * A deeper bottom margin than export.service.js's flat `margin: 50`: the footer
 * is drawn *into* the bottom margin on every page, so the content area has to
 * stop short of it or the last row of a section would sit on top of the footer.
 */
const BOTTOM = 76;
const LABEL_W = 132;
const GAP = 12;

/** Mirrors the Branding schema default; only used when branding is unreachable. */
const BRAND_FALLBACK = 'AIPL Hire';

/** Where file.service.js puts uploads — a relative logoUrl resolves against it. */
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/* ── payment: the honest labels ────────────────────────── */

/**
 * How each payment state prints.
 *
 * `claimed` is the whole reason this table exists. It means "a stranger typed a
 * reference into a form"; nothing has confirmed the money arrived, because the
 * Pay Now button is an admin-configured redirect and nothing comes back from it.
 * Only `verified` (a human checked) and `waived` (a human excused it) are money
 * questions we have actually answered, and they are the only two that may print
 * as settled. Keyed off payment.status rather than the `isPaid` virtual on
 * purpose: paginateQuery().lean() strips virtuals, so a lean document would
 * silently report every application as unpaid.
 */
const PAYMENT_STATES = {
  unpaid: { label: 'Unpaid', detail: 'No payment reference was submitted.', tone: SUB },
  claimed: {
    label: 'Claimed by applicant — NOT verified',
    detail: 'The applicant supplied this reference. It has not been checked against the account.',
    tone: '#b45309',
  },
  verified: { label: 'Verified', detail: 'An administrator confirmed this payment was received.', tone: '#15803d' },
  failed: { label: 'Failed', detail: 'This payment was recorded as failed.', tone: '#b91c1c' },
  waived: { label: 'Waived', detail: 'An administrator waived the fee for this application.', tone: '#15803d' },
};
const UNKNOWN_PAYMENT = { label: 'Unknown', detail: 'This application has no recognised payment state.', tone: SUB };

/* ── text safety ───────────────────────────────────────── */

/**
 * What pdfkit's built-in Helvetica can actually draw.
 *
 * Helvetica is a standard-14 AFM font encoded as WinAnsi: it has no glyph for
 * anything outside Latin-1 plus a handful of typographic extras. Handed
 * Devanagari it does NOT throw and does NOT skip — measured on pdfkit 0.15.2, it
 * emits mojibake AND corrupts the run around it ("नमस्ते Kushwaha" came back out
 * of the parser as "’©M“ 6“é ’B °ushwaha" — note the eaten K). widthOfString()
 * returning 0 is the tell for an unencodable codepoint, which is how this set was
 * derived rather than guessed: every cp in 0x20–0xFF measured non-zero except the
 * C1 controls, and ₹ / Devanagari / CJK / Arabic / emoji all measured 0.
 *
 * Application.preferredLanguage allows 'hi', so Hindi in a name or address is
 * expected, not hypothetical. See unicodeFont() for the fix; this is the floor.
 */
const WINANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const UNRENDERABLE = new RegExp(`[^\\n\\t\\x20-\\x7E\\u00A0-\\u00FF${WINANSI_EXTRAS}]+`, 'g');
const LOST = '[non-Latin text]';

/**
 * Optional drop-in font, resolved once per process.
 *
 * Registering a Devanagari TTF here is the entire fix for the above: pdfkit
 * delegates to fontkit, which shapes the script properly (verified — an embedded
 * Devanagari TTF measures non-zero and carries Latin glyphs too, so one font
 * covers a mixed "प्रशांत Kushwaha" line). Nothing ships one today, so this
 * resolves to null and the sanitiser takes over. Deliberately a filesystem probe
 * and not config: adding the asset is then the whole change, no deploy of code.
 */
const FONT_DIR = path.resolve(process.cwd(), 'assets', 'fonts');
const FONT_CANDIDATES = [
  { regular: 'NotoSansDevanagari-Regular.ttf', bold: 'NotoSansDevanagari-Bold.ttf' },
  { regular: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf' },
];
let _fontProbe;

async function unicodeFont() {
  if (_fontProbe !== undefined) return _fontProbe;
  _fontProbe = null;
  for (const candidate of FONT_CANDIDATES) {
    const regular = path.join(FONT_DIR, candidate.regular);
    try {
      await fs.access(regular);
    } catch {
      continue; // not installed — try the next name
    }
    const bold = path.join(FONT_DIR, candidate.bold);
    // A missing bold weight must not cost us the regular one: headings simply
    // reuse the regular face rather than falling back to unrenderable Helvetica.
    const hasBold = await fs.access(bold).then(() => true, () => false);
    _fontProbe = { regular, bold: hasBold ? bold : regular };
    break;
  }
  return _fontProbe;
}

/**
 * Strip what the active font cannot draw, and remember that we did.
 *
 * Only meaningful for the Helvetica path; once a Unicode font is registered
 * every codepoint is drawable and this becomes a no-op. `ctx.lossy` drives the
 * notice at the end of the document — dropping a stranger's name without telling
 * the reader is the failure mode this exists to prevent.
 */
function draw(ctx, value) {
  const str = String(value ?? '');
  if (ctx.unicode) return str;
  const clean = str.replace(UNRENDERABLE, LOST);
  if (clean !== str) ctx.lossy = true;
  return clean;
}

/* ── branding ──────────────────────────────────────────── */

/**
 * Branding, or enough of it to keep going.
 *
 * A local copy of email.service.js's safeBranding() because that one is private
 * to the mail path. Same contract: never throw — a PDF that a database blip can
 * turn into a 500 is a worse product than one with a plain-text wordmark.
 */
async function safeBranding() {
  try {
    const b = (await Branding.getGlobal()).toObject();
    return { ...b, platformName: b.platformName || BRAND_FALLBACK };
  } catch {
    return { platformName: BRAND_FALLBACK };
  }
}

/* ── logo ──────────────────────────────────────────────── */

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TTL = 5 * 60 * 1000;
const _logoCache = new Map(); // url -> { buf, at }

/** pdfkit's doc.image() speaks PNG and JPEG only — an SVG or WebP logo throws. */
function embeddable(buf) {
  if (!buf || buf.length < 4) return false;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return png || jpeg;
}

/**
 * Read a logo the admin uploaded to us.
 *
 * basename() before resolve(): logoUrl is a free-text Branding field, and even
 * though only a super admin can set it, "../../etc/passwd" should fail on the
 * path handling rather than on our trust in the role.
 */
async function localLogo(url) {
  const name = path.basename(url.split(/[?#]/)[0]);
  const file = path.resolve(UPLOAD_DIR, name);
  if (file !== path.join(UPLOAD_DIR, name)) return null;
  return fs.readFile(file);
}

/**
 * Fetch a logo hosted elsewhere.
 *
 * Worth it: a white-label deployment usually points logoUrl at a CDN, and a
 * wordmark-only PDF looks broken next to the branded email the same submission
 * sends. Safe enough, with the guards below: the URL is super-admin-configured
 * (not applicant-supplied), so this is not an open redirect for the public form.
 * Constrained anyway — http/https only, so `file://` can't read the disk; a 3s
 * timeout, because a hung CDN must not hold the applicant's request open; a size
 * cap; and a magic-byte check before it reaches pdfkit. Residual risk, stated
 * plainly: a compromised super-admin account could point this at an internal
 * address and learn whether it answers. That account can already rewrite settings
 * and mail templates, so this is not the weakest door — but it is not zero.
 */
async function remoteLogo(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(3000) });
  if (!res.ok) return null;
  if (Number(res.headers.get('content-length')) > LOGO_MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > LOGO_MAX_BYTES ? null : buf;
}

/**
 * The logo, or null. Never throws.
 *
 * Cached because this runs per generated PDF and the logo changes about never;
 * negative results are cached too, so a dead CDN costs one 3s timeout per five
 * minutes rather than one per applicant.
 *
 * Exported: export.service.js's invoice reuses this rather than growing its own
 * copy of the fetch/magic-byte/cache machinery.
 */
export async function loadLogo(branding) {
  const url = branding?.logoUrl;
  if (!url) return null;

  const hit = _logoCache.get(url);
  if (hit && Date.now() - hit.at < LOGO_TTL) return hit.buf;

  let buf = null;
  try {
    if (/^https?:\/\//i.test(url)) buf = await remoteLogo(url);
    else if (url.startsWith('/')) buf = await localLogo(url);
    if (buf && !embeddable(buf)) {
      logger.warn({ url }, 'branding logo is not a PNG/JPEG — the application PDF will use the wordmark');
      buf = null;
    }
  } catch (err) {
    logger.warn({ err: err.message, url }, 'branding logo unavailable — the application PDF will use the wordmark');
    buf = null;
  }
  _logoCache.set(url, { buf, at: Date.now() });
  return buf;
}

/* ── formatting ────────────────────────────────────────── */

const titleCase = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

function fileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Money, as a code and never a symbol.
 *
 * "INR 500.00", not "₹500.00" — Helvetica has no rupee glyph (measured 0 wide),
 * so the symbol would print as a mojibake smudge on the one line of this
 * document nobody may misread. export.service.js's invoice reached the same
 * shape; this is that idiom, not a coincidence.
 */
function money(amount, currency) {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return `${currency || 'INR'} ${Number(amount).toFixed(2)}`;
}

/* ── layout primitives ─────────────────────────────────── */

const contentBottom = (doc) => doc.page.height - doc.page.margins.bottom;
const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

/** Start a new page unless `need` points still fit under the current one. */
function ensure(ctx, need) {
  if (ctx.doc.y + need > contentBottom(ctx.doc)) ctx.doc.addPage();
}

/**
 * A section heading.
 *
 * Reserves the heading *plus* a row before committing to the page, so a heading
 * can never be orphaned at the foot of one page with its fields on the next.
 */
function heading(ctx, title) {
  const { doc } = ctx;
  ensure(ctx, 44);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.font(ctx.bold).fontSize(11).fillColor(BRAND).text(draw(ctx, title.toUpperCase()), doc.page.margins.left, y);
  doc.moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .lineWidth(0.5)
    .strokeColor(RULE)
    .stroke();
  doc.y += 8;
}

/**
 * One label/value row.
 *
 * Missing optional fields are skipped rather than printed as "—": on a record
 * this long, twenty empty dashes bury the fields that were actually filled in.
 *
 * Both columns are measured before either is drawn, because pdfkit leaves doc.y
 * wherever the *last* text() call ended — with a wrapping label and a one-line
 * value that is the label's start, and the next row would overwrite it. A value
 * taller than the page (a 500-char address is allowed by the schema) is handed
 * to text() whole and left to pdfkit's own flow, which breaks it across pages
 * correctly; the ensure() below only decides whether to *start* it here.
 */
function row(ctx, label, value) {
  const text = value == null ? '' : String(value).trim();
  if (!text) return;

  const { doc } = ctx;
  const safe = draw(ctx, text);
  const valueW = contentWidth(doc) - LABEL_W - GAP;

  doc.font(ctx.bold).fontSize(9);
  const labelH = doc.heightOfString(draw(ctx, label), { width: LABEL_W });
  doc.font(ctx.regular).fontSize(10);
  const valueH = doc.heightOfString(safe, { width: valueW });

  // Only demand room for the first line: a long value is allowed to flow on.
  ensure(ctx, Math.min(Math.max(labelH, valueH), 28));

  const top = doc.y;
  const left = doc.page.margins.left;
  doc.font(ctx.bold).fontSize(9).fillColor(SUB).text(draw(ctx, label), left, top, { width: LABEL_W });
  const afterLabel = doc.y;
  doc.font(ctx.regular).fontSize(10).fillColor(INK).text(safe, left + LABEL_W + GAP, top, { width: valueW });

  doc.y = Math.max(doc.y, afterLabel) + 5;
}

/** A section that renders nothing if every one of its fields is empty. */
function section(ctx, title, rows) {
  const present = rows.filter(([, v]) => v != null && String(v).trim() !== '');
  if (!present.length) return;
  heading(ctx, title);
  for (const [label, value] of present) row(ctx, label, value);
}

/* ── the document ──────────────────────────────────────── */

function header(ctx, branding, application) {
  const { doc } = ctx;
  const left = doc.page.margins.left;
  const name = branding.platformName || BRAND_FALLBACK;
  const top = doc.y;

  let textLeft = left;
  if (ctx.logo) {
    try {
      // fit, not scale: a wordmark and a square badge both have to land inside
      // the same box without stretching.
      doc.image(ctx.logo, left, top, { fit: [120, 40], align: 'left', valign: 'top' });
      textLeft = left + 132;
    } catch (err) {
      // Decoded far enough to pass the magic-byte check but not far enough to
      // embed (a truncated upload). The wordmark still has to appear.
      logger.warn({ err: err.message }, 'branding logo could not be embedded in the application PDF');
    }
  }

  doc.font(ctx.bold).fontSize(16).fillColor(INK).text(draw(ctx, name), textLeft, top, { width: contentWidth(doc) - (textLeft - left) });
  doc.font(ctx.regular).fontSize(9).fillColor(SUB).text(draw(ctx, branding.tagline || 'Interview Application'), { width: contentWidth(doc) - (textLeft - left) });

  doc.y = Math.max(doc.y, top + (ctx.logo ? 44 : 0)) + 10;
  doc.moveTo(left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).lineWidth(1).strokeColor(BRAND).stroke();
  doc.y += 14;

  doc.font(ctx.bold).fontSize(18).fillColor(INK).text(draw(ctx, application.applicationId || 'Application'), left, doc.y);
  doc.font(ctx.regular).fontSize(9).fillColor(SUB).text(`Submitted ${dateTime(application.submittedAt || application.createdAt)}`);
  doc.text(`Application status: ${titleCase(application.status || 'pending')}`);
  doc.y += 4;
}

/**
 * The money block.
 *
 * Printed as its own bordered panel rather than another row, because this is the
 * one thing on the page a reader is likely to skim for and get wrong. The status
 * line carries its own sentence of context (PAYMENT_STATES.detail) so the panel
 * cannot be misread on its own — "Claimed by applicant — NOT verified" beside a
 * reference number is the only honest rendering of a claim.
 */
function payment(ctx, application) {
  const { doc } = ctx;
  const pay = application.payment || {};
  const state = PAYMENT_STATES[pay.status] || UNKNOWN_PAYMENT;

  heading(ctx, 'Payment');

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const detail = draw(ctx, state.detail);
  doc.font(ctx.regular).fontSize(9);
  const detailH = doc.heightOfString(detail, { width: width - 24 });
  const boxH = 46 + detailH;
  ensure(ctx, boxH + 8);

  const top = doc.y;
  doc.roundedRect(left, top, width, boxH, 4).lineWidth(0.5).strokeColor(RULE).stroke();

  doc.font(ctx.bold).fontSize(12).fillColor(state.tone).text(draw(ctx, state.label), left + 12, top + 12, { width: width - 24 });
  doc.font(ctx.regular).fontSize(9).fillColor(SUB).text(detail, left + 12, doc.y + 2, { width: width - 24 });
  doc.y = top + boxH + 8;

  row(ctx, 'Fee at submission', money(pay.amount, pay.currency));
  row(ctx, 'Reference given', pay.reference);
  row(ctx, 'Claimed at', dateTime(pay.claimedAt));
  row(ctx, 'Verified at', dateTime(pay.verifiedAt));
  row(ctx, 'Administrator note', pay.note);
}

/**
 * The declaration exactly as the applicant agreed to it.
 *
 * application.declaration.text is frozen on the record at submission for the
 * reason the model spells out — the configured wording may have changed since.
 * So this prints the stored text and never applicationConfig().declarationText,
 * which would put words in the applicant's mouth.
 */
function declaration(ctx, application) {
  const decl = application.declaration || {};
  if (!decl.text && !decl.accepted) return;

  const { doc } = ctx;
  heading(ctx, 'Declaration');

  if (decl.text) {
    ensure(ctx, 30);
    doc.font(ctx.regular).fontSize(9).fillColor(INK).text(draw(ctx, decl.text), doc.page.margins.left, doc.y, {
      width: contentWidth(doc),
      align: 'left',
    });
    doc.y += 6;
  }
  row(ctx, 'Accepted', decl.accepted ? 'Yes' : 'No');
  row(ctx, 'Accepted at', dateTime(decl.acceptedAt));
}

/**
 * QR + verification code.
 *
 * Encodes /verify/<verificationCode> and never /verify/<applicationId>: the id
 * is quoted in emails and printed at the top of this page, so keying the lookup
 * on it would mean anyone who glanced at a printed application could pull up the
 * record. The code is the unguessable half, which is the point of it existing.
 */
async function verification(ctx, application) {
  const { doc } = ctx;
  const code = application.verificationCode;
  if (!code) return;

  const url = `${config.clientUrl}/verify/${encodeURIComponent(code)}`;
  let qr = null;
  try {
    qr = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 240, errorCorrectionLevel: 'M' });
  } catch (err) {
    // The URL still prints; a missing QR costs convenience, not the document.
    logger.warn({ err: err.message }, 'application QR could not be generated');
  }

  const size = 96;
  heading(ctx, 'Verification');
  ensure(ctx, size + 10);

  const left = doc.page.margins.left;
  const top = doc.y;
  if (qr) doc.image(qr, left, top, { fit: [size, size] });

  const textLeft = left + (qr ? size + 16 : 0);
  const width = contentWidth(doc) - (textLeft - left);
  doc.font(ctx.regular).fontSize(9).fillColor(SUB).text('Scan to verify this application is genuine, or open:', textLeft, top + 6, { width });
  doc.font(ctx.bold).fontSize(9).fillColor(BRAND).text(draw(ctx, url), textLeft, doc.y + 2, { width });
  doc.font(ctx.regular).fontSize(8).fillColor(SUB).text(`Verification code: ${draw(ctx, code)}`, textLeft, doc.y + 4, { width });

  doc.y = Math.max(doc.y, top + size) + 8;
}

/**
 * The notice that this document is incomplete.
 *
 * Fires only when draw() actually dropped something. Silence here means nothing
 * was lost, which is what makes the notice worth trusting when it does appear.
 */
function lossNotice(ctx) {
  if (!ctx.lossy) return;
  const { doc } = ctx;
  ensure(ctx, 40);
  doc.moveDown(0.5);
  doc.font(ctx.regular).fontSize(8).fillColor('#b45309').text(
    `Note: some values on this application use characters this document's font cannot display (for example Hindi/Devanagari) and are shown as "${LOST}". Open the application in the admin panel to read the original text.`,
    doc.page.margins.left,
    doc.y,
    { width: contentWidth(doc) },
  );
}

/**
 * Footers, stamped once at the end across every buffered page.
 *
 * Written after the body (bufferPages) because "Page 1 of 4" cannot be known
 * while page 1 is being laid out. margins.bottom is zeroed for the duration:
 * text() drawn below the margin would otherwise trigger pdfkit's auto-paginate
 * and append a blank page per footer, forever.
 */
function footers(ctx, branding, application) {
  const { doc } = ctx;
  const contact = branding.contact || {};
  const name = branding.platformName || BRAND_FALLBACK;

  const org = [name, contact.address, contact.email, contact.phone].filter(Boolean).join('  ·  ');
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    let y = doc.page.height - saved + 12;

    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(RULE).stroke();
    y += 6;

    doc.font(ctx.regular).fontSize(7).fillColor(FOOT).text(draw(ctx, org), left, y, { width, align: 'center', lineBreak: false });
    doc.font(ctx.regular).fontSize(7).fillColor(FOOT).text(
      `${draw(ctx, application.applicationId || '')}  ·  Generated ${dateTime(new Date())}  ·  Page ${i - range.start + 1} of ${range.count}`,
      left,
      y + 10,
      { width, align: 'center', lineBreak: false },
    );

    doc.page.margins.bottom = saved;
  }
  doc.flushPages();
}

/**
 * Render a public interview application as a PDF buffer.
 *
 * Returns the Buffer alone (not export.service.js's {buffer, filename, contentType}
 * triple) because that is this stream's agreed signature; the controller sets the
 * headers. Never prints submittedIp / submittedUserAgent / resumeText — they are
 * `select: false` on the model for a reason and a PDF is a thing that gets
 * forwarded.
 *
 * @param {object} application  an Application document (or a lean object)
 * @returns {Promise<Buffer>}
 */
export async function applicationPdf(application) {
  if (!application) throw new TypeError('applicationPdf() needs an application');

  const branding = await safeBranding();
  const [logo, font] = await Promise.all([loadLogo(branding), unicodeFont()]);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: BOTTOM },
    bufferPages: true, // footers need the total page count, known only at the end
    info: {
      Title: `Application ${application.applicationId || ''}`.trim(),
      Author: branding.platformName || BRAND_FALLBACK,
      Subject: 'Interview application',
    },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const ctx = { doc, logo, unicode: false, lossy: false, regular: 'Helvetica', bold: 'Helvetica-Bold' };
  if (font) {
    try {
      doc.registerFont('body', font.regular);
      doc.registerFont('body-bold', font.bold);
      Object.assign(ctx, { regular: 'body', bold: 'body-bold', unicode: true });
    } catch (err) {
      // A corrupt font must not cost us the document — Helvetica + sanitiser.
      logger.warn({ err: err.message, font: font.regular }, 'unicode font could not be registered for the application PDF');
    }
  }
  doc.font(ctx.regular);

  header(ctx, branding, application);

  section(ctx, 'Personal', [
    ['Full name', application.fullName],
    ['Email', application.email],
    ['Mobile', application.mobile],
    ['Alternate mobile', application.altMobile],
    ['Date of birth', dateOnly(application.dob)],
    ['Gender', application.gender],
  ]);

  section(ctx, 'Address', [
    ['Address', application.address],
    ['City', application.city],
    ['State', application.state],
    ['Country', application.country],
    ['PIN code', application.pinCode],
  ]);

  section(ctx, 'Education', [
    ['Highest qualification', application.highestQualification],
    ['College / University', application.college],
    ['Year of passing', application.passingYear],
  ]);

  section(ctx, 'Professional', [
    ['Preferred job role', application.preferredJobRole],
    ['Experience', titleCase(application.experienceType)],
    ['Total experience', application.totalExperienceYears != null ? `${application.totalExperienceYears} year(s)` : ''],
    ['Current company', application.currentCompany],
    ['Current job title', application.currentJobTitle],
    ['Skills', (application.skills || []).join(', ')],
    ['Interview language', application.preferredLanguage === 'hi' ? 'Hindi' : 'English'],
    ['Current salary', application.currentSalary],
    ['Expected salary', application.expectedSalary],
    ['Notice period', application.noticePeriod],
  ]);

  section(ctx, 'Links', [
    ['LinkedIn', application.linkedin],
    ['Portfolio', application.portfolio],
  ]);

  /**
   * Files are described, never linked.
   *
   * fileSchema carries no `url` by design: these are served through an
   * admin-authenticated route, not the public /uploads path, so the honest thing
   * to print is what was uploaded — not a link that either leaks or 404s. The
   * opaque stored filename is omitted too; it is an access token in all but name.
   */
  section(ctx, 'Attachments', [
    [
      'Resume',
      application.resume
        ? [application.resume.originalName || 'resume', fileSize(application.resume.sizeBytes)].filter(Boolean).join('  ·  ')
        : 'Not provided',
    ],
    [
      'Photograph',
      application.photo ? [application.photo.originalName || 'photo', fileSize(application.photo.sizeBytes)].filter(Boolean).join('  ·  ') : '',
    ],
  ]);

  payment(ctx, application);
  declaration(ctx, application);
  await verification(ctx, application);
  lossNotice(ctx);
  footers(ctx, branding, application);

  doc.end();
  return done;
}

export default { applicationPdf };
