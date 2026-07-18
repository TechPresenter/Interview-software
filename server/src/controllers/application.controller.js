import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { savePrivateBuffer, extractText, ExtractionError } from '../services/file.service.js';
import {
  applicationConfig,
  createApplication,
  notifyApplicationReceived,
  startApplicationCheckout,
  reconcileApplicationPayment,
} from '../services/application.service.js';
import { Application } from '../models/Application.js';
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

/** A photo is a headshot, not a document. Rejected here because multer's size cap is per-instance, not per-field. */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

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
    paymentMode: cfg.paymentMode,
    // The gateway is offered to the form only when it can actually take money.
    // If the mode is `cashfree` but no credentials are set, fall the public form
    // back to the manual link rather than dead-ending the applicant.
    gatewayReady: cfg.gatewayReady,
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
 * The resume is required; the photo is not. Each error names its own file — "one
 * or more files are missing" makes the applicant re-pick both attachments to find
 * out which one the browser dropped.
 *
 * A missing photo costs nothing downstream: the model never marked it required,
 * the PDF prints an empty reference for it, and the admin panel renders an empty
 * row. Turning away a qualified applicant because they had no passport photo to
 * hand is a worse outcome than a review panel with a blank avatar.
 */
export const submit = asyncHandler(async (req, res) => {
  const resumeFile = req.files?.resume?.[0];
  const photoFile = req.files?.photo?.[0];

  if (!resumeFile) {
    throw ApiError.badRequest('Please attach your resume.', { code: 'RESUME_REQUIRED', details: { resume: 'Attach your resume (PDF, DOCX, or a clear photo of it).' } });
  }
  // Only when one was actually sent: the cap applies to the photo, not to its absence.
  if (photoFile && photoFile.size > MAX_PHOTO_BYTES) {
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

  // The photo is optional, so it may genuinely be absent — storeFile would read
  // .buffer off undefined. `undefined` rather than null: mongoose omits the
  // subdocument entirely instead of storing an empty one.
  const [resume, photo] = await Promise.all([
    storeFile(resumeFile),
    photoFile ? storeFile(photoFile) : undefined,
  ]);

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
  /**
   * Two outcomes, decided by the payment route the service chose:
   *
   *  - Gateway (`payment.status === 'pending'`): the application is filed but is
   *    NOT yet a submission. Open a Cashfree order and hand the browser the
   *    session to pay with; the "received" emails wait until the webhook confirms
   *    the money (see markApplicationPaid). If opening the order fails, the row
   *    is left pending — the applicant can retry from the status page rather than
   *    losing everything they typed.
   *  - Everything else (free / manual link / off): this already counts as a
   *    submission, so notify now and return the receipt.
   *
   * `verificationCode` is returned in both cases on purpose: it unlocks
   * GET /apply/verify/:code, which discloses only this person's own name, status,
   * submission time and payment state — facts they just typed. Over their own TLS
   * response that reveals nothing, and it is what lets an account-less applicant
   * check on themselves, print the QR code, and (gateway route) resume payment.
   * It is NOT the applicationId, which is quoted aloud and printed on paper.
   */
  if (application.payment.status === 'pending') {
    const cfg = await applicationConfig();
    const session = await startApplicationCheckout(application, cfg);
    return created(
      res,
      {
        applicationId: application.applicationId,
        status: application.status,
        payment: { status: 'pending' },
        requiresPayment: true,
        checkout: {
          paymentSessionId: session.paymentSessionId,
          orderId: session.orderId,
          mode: session.mode,
          amount: session.amount,
          currency: session.currency,
        },
        verificationCode: application.verificationCode,
      },
      'Complete the payment to submit your application.',
    );
  }

  await notifyApplicationReceived(application);
  return created(
    res,
    {
      applicationId: application.applicationId,
      status: application.status,
      payment: { status: application.payment.status },
      requiresPayment: false,
      verificationCode: application.verificationCode,
    },
    'Your application has been received.',
  );
});

/**
 * POST /apply/checkout/:code — mint a fresh checkout session for an application
 * that is still awaiting payment. This is the resume/retry path: an applicant
 * who closed the Cashfree tab comes back and pays without re-filling the form.
 */
export const checkout = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ verificationCode: req.params.code });
  if (!application) throw ApiError.notFound('We could not find that application.');
  if (application.payment.status === 'verified' || application.payment.status === 'waived') {
    return ok(res, { paid: true }, 'This application is already paid.');
  }
  if (application.payment.provider !== 'cashfree' && application.payment.status !== 'pending') {
    throw ApiError.badRequest('This application does not use online payment.');
  }
  const cfg = await applicationConfig();
  const session = await startApplicationCheckout(application, cfg);
  return ok(res, {
    paymentSessionId: session.paymentSessionId,
    orderId: session.orderId,
    mode: session.mode,
    amount: session.amount,
    currency: session.currency,
  });
});

/**
 * GET /apply/status/:code — the page the applicant lands on returning from
 * Cashfree. Reconciles a still-pending payment against the gateway directly, so
 * a paid application shows as paid even if its webhook is late or lost.
 */
export const status = asyncHandler(async (req, res) => {
  const found = await Application.findOne({ verificationCode: req.params.code });
  if (!found) throw ApiError.notFound('We could not find that application.');
  const application = await reconcileApplicationPayment(found);
  return ok(res, {
    applicationId: application.applicationId,
    name: application.fullName,
    status: application.status,
    payment: {
      status: application.payment.status,
      amount: application.payment.amount,
      currency: application.payment.currency,
    },
    submittedAt: application.submittedAt,
  });
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
