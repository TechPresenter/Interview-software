import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { savePrivateBuffer, extractText, ExtractionError } from '../services/file.service.js';
import { safeSendTemplated } from '../services/email.service.js';
import { applicationConfig, createApplication } from '../services/application.service.js';
import { Application } from '../models/Application.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * The public "Apply for Interview" surface. No authentication, by design.
 *
 * The business rules live in services/application.service.js. What this layer
 * owns is the boundary: turning multipart buffers into stored files, and deciding
 * — for every response — exactly which fields a stranger is allowed to read back.
 * Both endpoints below build their payload field by field rather than handing out
 * a document, because the alternative is that the next field added to the model
 * becomes world-readable by default and nobody notices.
 */

/**
 * Where new applications are announced.
 *
 * config/index.js has NO admin/support address: the closest things are
 * `config.mail.from` (an envelope sender, not an inbox) and CONTACT_TO, which
 * isn't in the zod env schema at all — controllers/contact.controller.js reads it
 * straight off process.env. This mirrors that idiom exactly rather than inventing
 * a second convention. APPLICATIONS_TO is offered first so applications can be
 * routed away from the sales inbox; the chain then degrades to the same defaults
 * the contact form already uses, so the notification always has somewhere to go.
 */
const APPLICATIONS_TO =
  process.env.APPLICATIONS_TO || process.env.CONTACT_TO || config.mail.from || 'support@aipl.online';

/** A photo is a headshot, not a document. Rejected here because multer's size cap is per-instance, not per-field. */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * Matches application.pdf.js's `dateOnly` deliberately: the email and the PDF
 * describe the same submission, and a reader comparing the two should not have to
 * work out whether "15 Jul 2026" and "7/15/2026" are the same day. A raw Date
 * interpolates as "Wed Jul 15 2026 22:31:07 GMT+0530 (India Standard Time)".
 */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/**
 * Store one upload the way the model wants it described.
 *
 * saveBuffer() also returns a `url`, and it is dropped on purpose — fileSchema has
 * no url field because an applicant's CV and passport photo are served only
 * through the admin-authenticated route. Spreading the return value here would
 * quietly undo that whole decision, so the fields are listed one by one.
 *
 * `size` comes from multer's own count of the bytes it buffered, not from
 * anything the client claimed.
 */
/**
 * savePrivateBuffer, NOT saveBuffer.
 *
 * saveBuffer writes into `uploads/`, which app.js:69 hands to express.static
 * with no auth — so a resume and a passport photo stored there are fetchable by
 * anyone who ever sees the filename, forever, and the model's careful omission
 * of a `url` field buys nothing. These go somewhere nothing serves; the only way
 * back out is the admin file route, which checks who is asking.
 */
async function storeFile(file) {
  const { filename } = await savePrivateBuffer(file.buffer, file.originalname);
  return {
    filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

/**
 * GET /apply/config — what the public form needs in order to render itself.
 *
 * Picked field by field, not spread. applicationConfig() happens to return
 * exactly these six keys today; the day someone adds a seventh — an API key, an
 * internal toggle, an accounting reference — a spread would publish it to the
 * open internet on the same commit, with no diff on this file to review.
 */
export const getConfig = asyncHandler(async (_req, res) => {
  const cfg = await applicationConfig();
  return ok(res, {
    enabled: cfg.enabled,
    paymentUrl: cfg.paymentUrl,
    fee: cfg.fee,
    currency: cfg.currency,
    declarationText: cfg.declarationText,
    paymentInstructions: cfg.paymentInstructions,
  });
});

/**
 * POST /apply — submit an application.
 *
 * Both files are required per the spec, and each is named in its own error: "one
 * or more files are missing" makes the applicant re-pick both attachments to find
 * out which one the browser dropped.
 */
export const submit = asyncHandler(async (req, res) => {
  const resumeFile = req.files?.resume?.[0];
  const photoFile = req.files?.photo?.[0];

  if (!resumeFile) {
    throw ApiError.badRequest('Please attach your resume.', { code: 'RESUME_REQUIRED', details: { resume: 'Attach your resume (PDF, DOCX, or a clear photo of it).' } });
  }
  if (!photoFile) {
    throw ApiError.badRequest('Please attach a passport-size photo.', { code: 'PHOTO_REQUIRED', details: { photo: 'Attach a recent passport-size photo (JPG or PNG).' } });
  }
  if (photoFile.size > MAX_PHOTO_BYTES) {
    throw ApiError.badRequest('That photo is too large — please upload one under 3 MB.', { code: 'PHOTO_TOO_LARGE', details: { photo: 'Maximum photo size is 3 MB.' } });
  }

  /**
   * Read the CV's text for the admin's search box.
   *
   * extractText throws ExtractionError on a password-protected, corrupt, or
   * unreadable-scan file, and that must NOT cost the applicant their application:
   * the text is a convenience for whoever searches the admin table later, while
   * the submission is the applicant's one shot at a job. The file itself is stored
   * either way, so a reviewer can always open the original and read it with their
   * eyes — which is the fallback that makes filing without the text safe.
   *
   * A failure is therefore recorded and swallowed, and only ExtractionError is:
   * anything else (out of disk, a bug in the parser) is a real fault and belongs
   * in the error handler, not silently absorbed into an empty string.
   *
   * The reason is logged; the extracted text never is. resumeText is select:false
   * because it is the full contents of a stranger's CV, and a log line is exactly
   * the sort of place that promise gets broken.
   */
  let resumeText = '';
  try {
    resumeText = await extractText(resumeFile.buffer, resumeFile.mimetype, resumeFile.originalname);
  } catch (err) {
    if (!(err instanceof ExtractionError)) throw err;
    logger.info({ reason: err.code }, 'application resume text unreadable — filing the application without it');
  }

  const [resume, photo] = await Promise.all([storeFile(resumeFile), storeFile(photoFile)]);

  const application = await createApplication(
    { ...req.body, resumeText },
    { resume, photo },
    // The audit trail. Both land on select:false fields and are never read back.
    { ip: req.ip, userAgent: req.get('user-agent') },
  );

  /**
   * The application is saved before a single email is attempted, and
   * safeSendTemplated swallows its own failures — so a dead SMTP host cannot cost
   * an applicant their submission. Awaited (rather than left dangling) to match
   * the house idiom and to guarantee the EmailLog row exists before we answer;
   * the cost is that a slow SMTP server slows the confirmation screen, never the
   * record.
   *
   * Both var sets are the `variables` list each template declares, exactly.
   * interpolate() renders an unknown placeholder as '' and says nothing, so a var
   * this side forgets is not an error anywhere — it is a blank in a stranger's
   * email, or a button that links to nothing.
   *
   * Note what is NOT passed: verificationCode. Neither template asks for it, and
   * sendTemplated persists every var into EmailLog.meta.vars — so passing it would
   * copy the capability that unlocks /apply/verify into a second collection for no
   * one's benefit. The QR code on the PDF is what carries it.
   */
  const { payment } = application;
  const common = {
    applicationId: application.applicationId,
    name: application.fullName,
    submittedAt: fmtDate(application.submittedAt),
    preferredJobRole: application.preferredJobRole || 'Not specified',
    paymentStatus: payment.status,
    paymentReference: payment.reference || 'None given',
    // The fee frozen onto the document, not the live config: this email must still
    // be true after an admin edits the configured fee tomorrow.
    currency: payment.currency,
    fee: payment.amount,
  };

  await Promise.all([
    safeSendTemplated('application.received', { to: application.email, vars: common }),
    safeSendTemplated('application.admin.new', {
      to: APPLICATIONS_TO,
      vars: {
        ...common,
        email: application.email,
        mobile: application.mobile,
        // The super admin's review queue. /dashboard/applications, not
        // /admin/applications — the admin panel is mounted under /dashboard
        // (see the client's nav.config.ts).
        adminUrl: `${config.clientUrl}/dashboard/applications`,
      },
    }),
  ]);

  /**
   * What the applicant gets back.
   *
   * `verificationCode` is included deliberately. It is a capability, so the
   * question is what it grants and to whom: it unlocks GET /apply/verify/:code,
   * which returns this person's own name, status, submission time and payment
   * state — four facts the person who just typed them already knows. Handing it to
   * the submitter over their own TLS response therefore discloses nothing, while
   * withholding it means the only copy travels by email, which is the weaker
   * channel and the one that bounces. It is what lets an applicant with no account
   * check on themselves and print the QR code, which is the feature.
   *
   * The code is NOT the applicationId for the reason the model gives: the id is
   * quoted over the phone and printed on paper, so anyone who saw a printed
   * application could otherwise look up its record.
   *
   * Everything else stays behind: no files, no declaration, no fee, no id — the
   * response is a receipt, not the document.
   */
  return created(
    res,
    {
      applicationId: application.applicationId,
      status: application.status,
      payment: { status: application.payment.status },
      verificationCode: application.verificationCode,
    },
    'Your application has been received.',
  );
});

/**
 * GET /apply/verify/:code — the QR target.
 *
 * World-readable by design, guarded only by the unguessable code, so this is the
 * one handler where "return the document" is a data breach. It returns four facts
 * and reshapes them by hand: .lean() would still carry _id, and any field added to
 * the model later — a reviewer's note, an internal score — would join this payload
 * on its own, with no change to this file to notice.
 *
 * payment.status is passed through raw, including 'claimed'. Deciding what that
 * word looks like is the client's job; what matters here is that this endpoint
 * never invents 'paid' out of an applicant's own claim.
 */
export const verify = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ verificationCode: req.params.code })
    // Explicit, though resumeText / submittedIp / submittedUserAgent are already
    // select:false — this endpoint is the one place where relying on a default set
    // somewhere else is not good enough.
    .select('applicationId fullName status submittedAt payment.status')
    .lean();

  if (!application) {
    throw ApiError.notFound('No application matches this code.', { code: 'APPLICATION_NOT_FOUND' });
  }

  return ok(res, {
    applicationId: application.applicationId,
    fullName: application.fullName,
    status: application.status,
    submittedAt: application.submittedAt,
    payment: { status: application.payment?.status || 'unpaid' },
  });
});

export default { getConfig, submit, verify };
