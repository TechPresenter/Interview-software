import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Public (no-auth) endpoints behind the "Apply for Interview" form.
 *
 * A bare instance rather than the shared one in lib/api.ts, for the same reason
 * marketing.api.ts has one: that instance attaches a bearer token and, on a 401,
 * refreshes and then fires the unauthorized handler — which would bounce an
 * applicant who has no account, and never will have one, towards a login screen.
 */
/**
 * The timeout is load-bearing, not tidiness.
 *
 * axios defaults to NO timeout, and a request that hangs never rejects — so the
 * form's `isError` branch is unreachable and the page sits on "Loading the
 * application form…" for as long as the tab is open, with no error and no retry.
 * Seen exactly that against a stalled API. A timeout is what turns a hang into
 * something the UI can respond to.
 *
 * 60s because the submit posts the resume and photo together (up to ~18MB) and a
 * phone on mobile data is slow; the config read overrides this with something
 * far shorter, since it is a settings lookup and has no excuse to be slow.
 */
const http = axios.create({ baseURL: BASE, timeout: 60_000 });

/** The admin-editable config. Mirrors the server's applicationConfig(). */
export interface ApplyConfig {
  /** Applications can be switched off; the form must not pretend otherwise. */
  enabled: boolean;
  /**
   * How the fee is collected: `cashfree` gates submission behind an online
   * payment, `link` shows the legacy pay-then-paste-reference flow, `off` records
   * the fee without gating. The server downgrades `cashfree` to `link` in its
   * response when the gateway has no credentials, so the form can trust this.
   */
  paymentMode: 'cashfree' | 'link' | 'off';
  /** Whether the gateway can actually take money right now. */
  gatewayReady: boolean;
  paymentUrl: string;
  fee: number;
  currency: string;
  declarationText: string;
  paymentInstructions: string;
}

/** A Cashfree checkout session for an application fee. */
export interface ApplyCheckout {
  paymentSessionId: string;
  orderId: string;
  mode: 'sandbox' | 'production';
  amount: number;
  currency: string;
}

/** The public payment/review state for the return-from-gateway status page. */
export interface ApplyStatus {
  applicationId: string;
  name: string;
  status: string;
  payment: { status: string; amount?: number; currency?: string };
  submittedAt?: string;
}

/**
 * What the applicant fills in.
 *
 * The public subset of the Application schema plus `paymentReference`, which is
 * not a schema field — the service reads it and derives payment.status from it.
 * Everything the server decides (status, payment.status, applicationId,
 * verificationCode, the fee) is deliberately absent: createApplication would
 * overwrite them anyway, and sending them is a claim this form has no business
 * making.
 */
export interface ApplyPayload {
  /* Personal */
  fullName: string;
  email: string;
  mobile: string;
  altMobile?: string;
  /** 'YYYY-MM-DD' straight from the date input — see toFormData(). */
  dob?: string;
  gender?: string;

  /* Address */
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;

  /* Education */
  highestQualification?: string;
  college?: string;
  passingYear?: number;

  /* Professional */
  skills?: string[];
  experienceType?: 'fresher' | 'experienced';
  totalExperienceYears?: number;
  currentCompany?: string;
  currentJobTitle?: string;
  preferredJobRole?: string;
  preferredLanguage?: 'en' | 'hi';
  expectedSalary?: string;
  currentSalary?: string;
  noticePeriod?: string;

  /* Links */
  linkedin?: string;
  portfolio?: string;

  /** The applicant's claim (a UTR / transaction id), never a proof of payment. */
  paymentReference?: string;

  /**
   * Sent as the applicant's own state, not hardcoded to true here. A false tick
   * that reaches the server and is refused is correct; an api layer that quietly
   * upgrades it to `true` would forge the one field whose whole purpose is to
   * record what a person agreed to.
   */
  declarationAccepted: boolean;
}

/**
 * The receipt for a created application — not the document.
 *
 * The endpoint deliberately returns four facts and nothing else: no files, no
 * declaration, no fee. Only `applicationId` is load-bearing here, being the
 * number the applicant quotes over the phone; the rest is typed because it is
 * genuinely sent, and left optional so a missing field renders as nothing rather
 * than as "undefined" at a stranger.
 *
 * `verificationCode` is the QR target on the PDF, not a display value — it is
 * unguessable precisely so that it, and not the quotable id, is what gates
 * /apply/verify. Nothing here should render it.
 */
export interface ApplyResult {
  applicationId: string;
  status?: string;
  payment?: { status?: string };
  /** True when the applicant must pay at the gateway before this is submitted. */
  requiresPayment?: boolean;
  /** Present with `requiresPayment` — the session to open Cashfree Checkout with. */
  checkout?: ApplyCheckout;
  verificationCode?: string;
}

/**
 * The form's state → a multipart body.
 *
 * Multipart, because two files ride along, and that has consequences the JSON
 * endpoints do not have:
 *
 *  - Every value crosses the wire as a string. `passingYear`, the experience
 *    years and the declaration boolean are the validator's to coerce; faking
 *    their types here would only hide which side owns the conversion.
 *  - '' is not "absent". An untouched <select> or a skipped optional input is UI
 *    state, so its key is omitted entirely — the same rule omitEmpty() enforces
 *    in dashboard/interviews/page.tsx, where sending '' made scheduling
 *    impossible until someone traced it.
 *  - Arrays use multer's bracket syntax (it parses fields through `append-field`).
 *    `skills[]` rather than a repeated plain `skills`: repeated plain keys only
 *    collapse into an array from the SECOND value onwards, so an applicant with
 *    exactly one skill would send a bare string — the kind of bug that only
 *    shows up for the least experienced applicants. The validator normalises all
 *    three legal spellings, but this one is an array at every length.
 */
function toFormData(payload: ApplyPayload, files: { resume: File; photo?: File | null }): FormData {
  const fd = new FormData();
  const { skills, declarationAccepted, ...scalars } = payload;

  for (const [key, value] of Object.entries(scalars)) {
    if (value === undefined || value === null || value === '') continue;
    fd.append(key, String(value));
  }

  for (const skill of skills ?? []) fd.append('skills[]', skill);

  // FLAT `declaration`, not `declaration[accepted]`. The model nests it, so the
  // bracket spelling is the tempting one — but applySchema mounts `declaration`
  // as a scalar that only accepts the strings 'true'/'on'/'1'/'yes'. Sending an
  // object walks past its `typeof v === 'string'` preprocess untouched and dies
  // on z.literal(true), i.e. every applicant who DID tick the box is told to
  // tick the box. The service builds the nested declaration itself.
  fd.append('declaration', String(declarationAccepted));

  fd.append('resume', files.resume);
  // Only when there is one: appending an absent photo sends the string
  // "undefined" as a text field, and multer's fileFilter would reject the
  // submission over a file the applicant never chose.
  if (files.photo) fd.append('photo', files.photo);
  return fd;
}

/**
 * A 409 the applicant can act on.
 *
 * The server refuses a second live application. It reports that in two places
 * and, today, the id survives in neither of the machine-readable ones:
 * application.service.js calls ApiError.conflict(msg, { code, applicationId }),
 * but ApiError's constructor destructures only `{ details, code }` — so
 * `applicationId` is dropped before the error handler ever serialises it. The id
 * reaches the browser only inside the human message.
 *
 * So: read it from wherever it may legitimately appear (should the API stream
 * pass it through `details`, which is what that field is for), and otherwise
 * recover it from the sentence. Both may miss — the duplicate raised by the
 * partial unique index under a race names no id at all — so a caller must cope
 * with `applicationId: null` and still refuse to resubmit.
 */
export function parseDuplicate(err: any): { applicationId: string | null; message: string } | null {
  const data = err?.response?.data;
  if (err?.response?.status !== 409 || data?.code !== 'DUPLICATE_APPLICATION') return null;
  const message = String(data?.message || '');
  const fromBody = data?.details?.applicationId ?? data?.applicationId;
  const fromMessage = message.match(/AIPL-\d{4}-\d{6}/)?.[0];
  return { applicationId: fromBody ?? fromMessage ?? null, message };
}

export const applyApi = {
  // 15s: this is a settings read. Failing fast is the point — the form renders a
  // retry once this rejects, and an applicant staring at a spinner learns nothing.
  config: (): Promise<ApplyConfig> => http.get('/apply/config', { timeout: 15_000 }).then((r) => r.data.data),
  submit: (payload: ApplyPayload, files: { resume: File; photo?: File | null }): Promise<ApplyResult> =>
    http.post('/apply', toFormData(payload, files)).then((r) => r.data.data),
  /**
   * Re-open the gateway checkout for an application still awaiting its fee.
   * Returns `{ paid: true }` instead of a session if it was already paid.
   */
  checkout: (code: string): Promise<ApplyCheckout & { paid?: boolean }> =>
    http.post(`/apply/checkout/${encodeURIComponent(code)}`, {}, { timeout: 20_000 }).then((r) => r.data.data),
  /** Read (and reconcile) the payment/review state after returning from Cashfree. */
  status: (code: string): Promise<ApplyStatus> =>
    http.get(`/apply/status/${encodeURIComponent(code)}`, { timeout: 20_000 }).then((r) => r.data.data),
};

export default applyApi;
