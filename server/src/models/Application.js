import mongoose from 'mongoose';
import { APPLICATION_STATUS, APPLICATION_PAYMENT_STATUS, EXPERIENCE_TYPE } from '../constants/enums.js';

const { Schema } = mongoose;

/**
 * A public interview application.
 *
 * NOT a Candidate. A Candidate belongs to a company's hiring pipeline and is
 * created by a recruiter; an Application is submitted from the open internet by
 * someone with no account, who pays a fee to be interviewed by the platform
 * itself. So it is platform-level (`company` is absent by design) and carries
 * things a Candidate never has: a payment claim, a declaration, an audit trail
 * of who reviewed it. A Candidate record is what an application BECOMES if the
 * super admin selects it — that conversion is a deliberate act, not this model's
 * job.
 *
 * Everything here arrives from an unauthenticated stranger, which shapes the
 * schema: no field is trusted, `select: false` hides what the public must never
 * read back, and the file paths are opaque ids resolved through an admin-only
 * route rather than URLs anyone can fetch.
 */

/** A reviewer's private note. Never leaves the admin panel. */
const noteSchema = new Schema(
  {
    body: { type: String, required: true, maxlength: 4000 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String }, // denormalised: the note outlives the account
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * An uploaded file.
 *
 * `url` is deliberately absent. Applicant resumes and passport photos are served
 * through an authenticated admin route keyed by this document's id, NOT from the
 * public /uploads path the rest of the app uses — a URL that leaks (browser
 * history, a forwarded PDF, a proxy log) would otherwise expose a stranger's
 * photo and CV forever, with no login and no expiry.
 */
const fileSchema = new Schema(
  {
    filename: { type: String, required: true }, // the opaque on-disk name
    originalName: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    /**
     * The human-readable id on the PDF and in the confirmation email
     * (AIPL-2026-000123). Generated in the service; unique so a racing double
     * submit fails at the database rather than issuing the same id twice.
     */
    applicationId: { type: String, required: true, unique: true }, // unique implies the index

    /* ── Personal ─────────────────────────────────────── */
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    mobile: { type: String, required: true, trim: true, index: true },
    altMobile: { type: String, trim: true },
    dob: { type: Date },
    // Free-form on purpose: an enum here is a UI artifact hardening into the
    // data model, and this list is not ours to close (see the Candidate.gender
    // field, whose enum had to grow an '' member to accommodate a dropdown).
    gender: { type: String, trim: true, maxlength: 40 },

    /* ── Address ──────────────────────────────────────── */
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    country: { type: String, trim: true, maxlength: 120 },
    pinCode: { type: String, trim: true, maxlength: 20 },

    /* ── Education ────────────────────────────────────── */
    highestQualification: { type: String, trim: true, maxlength: 160 },
    college: { type: String, trim: true, maxlength: 200 },
    passingYear: { type: Number, min: 1950, max: 2100 },

    /* ── Professional ─────────────────────────────────── */
    skills: [{ type: String, trim: true, maxlength: 60 }],
    experienceType: { type: String, enum: EXPERIENCE_TYPE, default: 'fresher' },
    totalExperienceYears: { type: Number, min: 0, max: 60 },
    currentCompany: { type: String, trim: true, maxlength: 200 },
    currentJobTitle: { type: String, trim: true, maxlength: 160 },
    preferredJobRole: { type: String, trim: true, maxlength: 160 },
    // Which language the interview itself should run in — the room supports
    // en/hi, so this is the same axis as Interview.config.language.
    preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
    expectedSalary: { type: String, trim: true, maxlength: 60 },
    currentSalary: { type: String, trim: true, maxlength: 60 },
    noticePeriod: { type: String, trim: true, maxlength: 60 },
    linkedin: { type: String, trim: true, maxlength: 300 },
    portfolio: { type: String, trim: true, maxlength: 300 },

    /* ── Files ────────────────────────────────────────── */
    resume: { type: fileSchema },
    photo: { type: fileSchema },
    // Extracted resume text, for search. Hidden by default: it is the full
    // contents of a stranger's CV and has no business in a list response.
    resumeText: { type: String, select: false },

    /* ── Declaration ──────────────────────────────────── */
    declaration: {
      accepted: { type: Boolean, required: true },
      acceptedAt: { type: Date },
      // What they actually agreed to, frozen at submission. If the wording
      // changes later, an old application must still show the text its
      // applicant ticked — otherwise the record misrepresents them.
      text: { type: String },
    },

    /* ── Payment ──────────────────────────────────────── */
    payment: {
      status: { type: String, enum: APPLICATION_PAYMENT_STATUS, default: 'unpaid', index: true },
      // The applicant's claim (UTR / transaction id). Untrusted until verified.
      reference: { type: String, trim: true, maxlength: 120 },
      amount: { type: Number },
      currency: { type: String, default: 'INR' },
      // What the fee was when they applied. The admin can change the configured
      // fee tomorrow; this application must still say what it charged.
      claimedAt: { type: Date },
      verifiedAt: { type: Date },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      note: { type: String, maxlength: 500 }, // why it was rejected/waived

      /* ── Gateway (Cashfree) ─────────────────────────── */
      provider: { type: String, trim: true }, // 'cashfree' when the gateway route was used
      // Our order id, sent to Cashfree and echoed back on the webhook. Indexed
      // because the webhook arrives knowing only this and must find the row.
      orderId: { type: String, trim: true, index: true, sparse: true },
      // The gateway's own payment id. Unique-per-payment, so it is what makes
      // applying a webhook idempotent when Cashfree retries a delivery.
      providerPaymentId: { type: String, trim: true },
      paidAt: { type: Date },
    },

    /* ── Review ───────────────────────────────────────── */
    status: { type: String, enum: APPLICATION_STATUS, default: 'pending', index: true },
    statusHistory: [
      {
        from: String,
        to: String,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        byName: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    notes: [noteSchema],

    /**
     * The QR code on the PDF points at /verify/<code>. Unguessable, and NOT the
     * applicationId: the id appears in emails and on paper, so anyone who saw a
     * printed application could otherwise pull up its record.
     */
    verificationCode: { type: String, required: true, unique: true },

    /* ── Submission trail ─────────────────────────────── */
    // Hidden from every default read: this is the applicant's network identity,
    // kept for abuse investigation, not for browsing.
    submittedIp: { type: String, select: false },
    submittedUserAgent: { type: String, select: false },
    submittedAt: { type: Date, default: Date.now, index: true },

    /** Set when the super admin converts a selected application into a real Candidate. */
    convertedCandidate: { type: Schema.Types.ObjectId, ref: 'Candidate', default: null },
  },
  { timestamps: true },
);

/**
 * One live application per person.
 *
 * A partial index rather than a plain unique one: a rejected applicant is
 * allowed to apply again, so uniqueness only holds over applications still in
 * play. Enforced in the database as well as in the service because two
 * simultaneous submits both pass a findOne() check and only the index stops the
 * second.
 */
const LIVE = { status: { $in: ['pending', 'under_review', 'shortlisted', 'selected'] } };
applicationSchema.index({ email: 1 }, { unique: true, partialFilterExpression: LIVE, name: 'one_live_per_email' });
applicationSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: LIVE, name: 'one_live_per_mobile' });

// The admin table's default view: newest first, filtered by status/payment.
applicationSchema.index({ status: 1, submittedAt: -1 });
applicationSchema.index({ 'payment.status': 1, submittedAt: -1 });

/**
 * Free-text search across the fields an admin actually types into a search box.
 * `default_language: 'english'` with no language_override: this model has no
 * `language` field, but pinning it is cheap insurance — a text index silently
 * reads a document's `language` field as its own and rejects the row if it
 * doesn't recognise the value, which made every Hindi question in this codebase
 * unsavable until it was found. Not repeating that.
 */
applicationSchema.index(
  { fullName: 'text', email: 'text', skills: 'text', preferredJobRole: 'text', currentCompany: 'text' },
  { default_language: 'english', language_override: 'textSearchLanguage', name: 'application_search' },
);

/** True once a human has confirmed the money actually arrived. */
applicationSchema.virtual('isPaid').get(function isPaid() {
  return this.payment?.status === 'verified' || this.payment?.status === 'waived';
});

export const Application = mongoose.model('Application', applicationSchema);
export default Application;
