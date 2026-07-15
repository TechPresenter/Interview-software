import { api, apiGet, apiPost } from './api';

/**
 * Public interview applications — the super-admin review surface.
 *
 * Applications are platform-level, so unlike the question bank there is no
 * admin/company pair to abstract over: one base path, one audience.
 *
 * The shapes below mirror server/src/models/Application.js. Two of its fields
 * are deliberately missing — `submittedIp`/`submittedUserAgent` (and
 * `resumeText`) are `select: false` on the model and never reach a response, so
 * typing them here would only invite a page to render something that is always
 * undefined.
 */

export type ApplicationStatus = 'pending' | 'under_review' | 'shortlisted' | 'rejected' | 'selected';
export type ApplicationPaymentStatus = 'unpaid' | 'claimed' | 'verified' | 'failed' | 'waived';
export type ExperienceType = 'fresher' | 'experienced';

/**
 * An uploaded file. `url` is absent by design: the bytes are fetched from the
 * authenticated route below, never from the public /uploads path.
 */
export interface ApplicationFile {
  filename: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
}

export interface ApplicationNote {
  _id: string;
  body: string;
  by?: { _id: string; name?: string } | string | null;
  /** Denormalised on the model — the note outlives the account that wrote it. */
  byName?: string;
  at?: string;
}

export interface StatusChange {
  from?: ApplicationStatus;
  to: ApplicationStatus;
  by?: string | null;
  byName?: string;
  at?: string;
}

export interface ApplicationPayment {
  status: ApplicationPaymentStatus;
  /** The applicant's claim (UTR / transaction id). Untrusted until verified. */
  reference?: string;
  /** The fee as it stood when they applied, in whole currency units. */
  amount?: number;
  currency?: string;
  claimedAt?: string;
  verifiedAt?: string;
  verifiedBy?: { _id: string; name?: string } | string | null;
  note?: string;
}

/** A row in the admin list. */
export interface ApplicationRow {
  _id: string;
  applicationId: string;
  fullName: string;
  email: string;
  mobile: string;
  preferredJobRole?: string;
  payment: ApplicationPayment;
  status: ApplicationStatus;
  submittedAt?: string;
  createdAt?: string;
}

export interface Application extends ApplicationRow {
  altMobile?: string;
  dob?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  highestQualification?: string;
  college?: string;
  passingYear?: number;
  skills?: string[];
  experienceType?: ExperienceType;
  totalExperienceYears?: number;
  currentCompany?: string;
  currentJobTitle?: string;
  preferredLanguage?: 'en' | 'hi';
  expectedSalary?: string;
  currentSalary?: string;
  noticePeriod?: string;
  linkedin?: string;
  portfolio?: string;
  resume?: ApplicationFile | null;
  photo?: ApplicationFile | null;
  declaration?: { accepted: boolean; acceptedAt?: string; text?: string };
  statusHistory?: StatusChange[];
  notes?: ApplicationNote[];
  convertedCandidate?: string | null;
  updatedAt?: string;
  /** Model virtual. Present on a single fetch; see `isPaid()` for why lists lack it. */
  isPaid?: boolean;
}

export interface ApplicationListParams {
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  status?: ApplicationStatus | '';
  paymentStatus?: ApplicationPaymentStatus | '';
  /** Inclusive submittedAt bounds, as YYYY-MM-DD. */
  from?: string;
  to?: string;
}

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

const BASE = '/admin/applications';

async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const { data } = await api.get(url, { params });
  return { items: data.data as T[], meta: data.meta };
}

/** Fetch a binary export and trigger a browser download. */
async function download(url: string, params: object, fallbackName: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || fallbackName;
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

/* ── Display metadata ─────────────────────────────────────────────────────── */

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'pending', 'under_review', 'shortlisted', 'rejected', 'selected',
];

export const APPLICATION_PAYMENT_STATUSES: ApplicationPaymentStatus[] = [
  'unpaid', 'claimed', 'verified', 'failed', 'waived',
];

/** The verdicts an admin may record. `unpaid`/`claimed` are states the applicant causes, not choices. */
export const PAYMENT_VERDICTS: ApplicationPaymentStatus[] = ['verified', 'failed', 'waived'];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  selected: 'Selected',
};

/**
 * Payment labels.
 *
 * `claimed` is spelled out rather than shortened to "Claimed" because the label
 * is the last line of defence: a one-word badge in a dense table is read as a
 * status, and the whole point of this state is that nobody has checked it yet.
 */
export const PAYMENT_LABELS: Record<ApplicationPaymentStatus, string> = {
  unpaid: 'Unpaid',
  claimed: 'Claimed — unverified',
  verified: 'Verified',
  failed: 'Failed',
  waived: 'Waived',
};

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export const STATUS_TONES: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  under_review: 'info',
  shortlisted: 'default',
  rejected: 'danger',
  selected: 'success',
};

/**
 * Payment tones.
 *
 * `claimed` must never be green. Green is the colour an admin scans for when
 * deciding whether the money arrived, and a claim is only the applicant's word.
 * `waived` is paid but not *received*, so it gets its own tone rather than
 * sharing `verified`'s.
 */
export const PAYMENT_TONES: Record<ApplicationPaymentStatus, Tone> = {
  unpaid: 'muted',
  claimed: 'warning',
  verified: 'success',
  failed: 'danger',
  waived: 'info',
};

/**
 * Mirrors the model's `isPaid` virtual.
 *
 * Duplicated on the client because `paginateQuery` returns `.lean()` rows and a
 * virtual does not survive that — so every list row would report `isPaid:
 * undefined`, which reads as "not paid" for the wrong reason.
 */
export const isPaid = (payment?: ApplicationPayment) =>
  payment?.status === 'verified' || payment?.status === 'waived';

/* ── API ──────────────────────────────────────────────────────────────────── */

export const applicationsApi = {
  list: (params?: ApplicationListParams) => getPaged<ApplicationRow>(BASE, params),
  get: (id: string) => apiGet<Application>(`${BASE}/${id}`),

  // PATCH, not POST: these edit an existing application, which is the verb the
  // server declares and the house convention everywhere else. Posting here got a
  // 404 that reads exactly like a missing record.
  setStatus: (id: string, status: ApplicationStatus) =>
    api.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data.data as Application),

  /** Record the admin's verdict on the money. Only this call can make an application paid. */
  setPayment: (id: string, status: ApplicationPaymentStatus, note?: string) =>
    api.patch(`${BASE}/${id}/payment`, { status, note }).then((r) => r.data.data as Application),

  // Both note endpoints answer with the notes ARRAY, not the application — typing
  // them as Application compiles and then reads `.notes` off an array at runtime.
  addNote: (id: string, body: string) => apiPost<ApplicationNote[]>(`${BASE}/${id}/notes`, { body }),
  deleteNote: (id: string, noteId: string) =>
    api.delete(`${BASE}/${id}/notes/${noteId}`).then((r) => r.data.data as ApplicationNote[]),

  remove: (id: string) => api.delete(`${BASE}/${id}`).then((r) => r.data),

  /**
   * The raw bytes of an applicant file.
   *
   * Returned as a Blob rather than a URL because the route is authenticated:
   * see the caller in the detail page for why an <img src> cannot fetch this.
   */
  fileBlob: (id: string, kind: 'resume' | 'photo') =>
    api.get(`${BASE}/${id}/file/${kind}`, { responseType: 'blob' }).then((r) => r.data as Blob),

  /** Same route, but `download=1` makes the server send Content-Disposition: attachment. */
  downloadFile: (id: string, kind: 'resume' | 'photo', fallbackName: string) =>
    download(`${BASE}/${id}/file/${kind}`, { download: 1 }, fallbackName),

  downloadPdf: (id: string, fallbackName: string) => download(`${BASE}/${id}/pdf`, {}, fallbackName),

  exportApplications: (params: ApplicationListParams & { format?: 'csv' | 'xlsx' } = {}) =>
    download(`${BASE}/export`, params, `applications.${params.format || 'csv'}`),
};

export default applicationsApi;
