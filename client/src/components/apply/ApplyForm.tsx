'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Copy, ExternalLink, FileText, Image as ImageIcon, Info, Languages,
  Send, ShieldAlert, Upload, X,
} from 'lucide-react';
import { applyApi, parseDuplicate, type ApplyConfig, type ApplyPayload } from '@/lib/apply.api';
import { openCashfreeCheckout } from '@/lib/cashfree';
import { COUNTRIES, DEFAULT_COUNTRY, formatNational } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const fieldCls =
  'h-11 w-full rounded-xl border border-input bg-card/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

/**
 * Client-side upload limits.
 *
 * These mirror middleware/upload.js (uploadResume: 15 MB, uploadImage: 3 MB) so
 * the applicant is told in the same second they pick a file, rather than after
 * pushing 15 MB up a phone connection to earn a 400. That is the ONLY thing this
 * buys — it is not a security control. The form is public and every byte of the
 * request is attacker-controlled; what actually gets stored is decided by
 * multer's fileFilter and the schema, both of which run again on the server with
 * no reference to anything here.
 */
const RESUME_MAX = 15 * 1024 * 1024;
const PHOTO_MAX = 3 * 1024 * 1024;

/**
 * Accept on mimetype OR extension, exactly as the server's resume filter does:
 * browsers and mobile clients send application/octet-stream for .docx often
 * enough that a mimetype-only gate rejects real resumes.
 */
const RESUME_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const RESUME_EXTS = ['.pdf', '.doc', '.docx'];

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

const kb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const extOf = (name: string) => (name.match(/\.[^.]+$/) || [''])[0].toLowerCase();

/** Every input is a string; numbers are parsed at submit, not while typing. */
type Form = {
  fullName: string; email: string; countryCode: string; mobile: string; altMobile: string; dob: string; gender: string;
  address: string; city: string; state: string; country: string; pinCode: string;
  highestQualification: string; college: string; passingYear: string;
  experienceType: 'fresher' | 'experienced';
  totalExperienceYears: string; currentCompany: string; currentJobTitle: string;
  preferredJobRole: string; preferredLanguage: 'en' | 'hi';
  expectedSalary: string; currentSalary: string; noticePeriod: string;
  linkedin: string; portfolio: string;
  paymentReference: string;
};

const EMPTY: Form = {
  fullName: '', email: '', countryCode: DEFAULT_COUNTRY.code, mobile: '', altMobile: '', dob: '', gender: '',
  address: '', city: '', state: '', country: DEFAULT_COUNTRY.name, pinCode: '',
  highestQualification: '', college: '', passingYear: '',
  experienceType: 'fresher',
  totalExperienceYears: '', currentCompany: '', currentJobTitle: '',
  preferredJobRole: '', preferredLanguage: 'en',
  expectedSalary: '', currentSalary: '', noticePeriod: '',
  linkedin: '', portfolio: '',
  paymentReference: '',
};

/**
 * Render a 400 from the API.
 *
 * The validator returns `details` keyed by the full dotted path, so a failure
 * inside `declaration` arrives as 'declaration.accepted'. Showing only `message`
 * is what turned every one of these into an unactionable "Validation failed".
 * Keyed by path, `details` maps cleanly onto the inputs — except for the paths
 * this form does not own a field for, which fall back to a toast rather than
 * being swallowed.
 */
function fieldErrors(e: any): { mapped: Partial<Record<keyof Form, string>>; rest: string[] } {
  const details = e?.response?.data?.details as Record<string, string> | undefined;
  const mapped: Partial<Record<keyof Form, string>> = {};
  const rest: string[] = [];
  if (!details || typeof details !== 'object') return { mapped, rest };
  for (const [path, msg] of Object.entries(details)) {
    // 'declaration.accepted' → 'declaration'; a top-level path is already a key.
    const text = Array.isArray(msg) ? String(msg[0]) : String(msg);
    if (path in EMPTY) mapped[path as keyof Form] = text;
    else rest.push(`${path}: ${text}`);
  }
  return { mapped, rest };
}

const genericMessage = (e: any) => e?.response?.data?.message || 'Something went wrong. Please try again.';

export function ApplyForm() {
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>> & { resume?: string; photo?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ applicationId: string } | null>(null);
  /** Set while we hand the browser to Cashfree, so the whole form is replaced by a
   *  "redirecting" state and a second submit is impossible during the navigation. */
  const [redirecting, setRedirecting] = useState(false);
  /** A 409: this person already has an application in play and must not send another. */
  const [duplicate, setDuplicate] = useState<{ applicationId: string | null; message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  /**
   * The form is blocked on this rather than rendered around it. Without the
   * config there is no declaration text — and the declaration is the exact
   * wording the applicant is agreeing to, frozen onto the record. Guessing it,
   * or letting someone tick an empty box, would misrepresent them. The fee is
   * the same story in reverse: unknown fee means an unknowable payment section,
   * and a form that quietly skips it lets someone submit without paying.
   */
  const { data: config, isLoading: configLoading, isError: configError, refetch } = useQuery({
    queryKey: ['apply-config'],
    queryFn: () => applyApi.config(),
  });

  const country = useMemo(() => COUNTRIES.find((c) => c.code === form.countryCode) || DEFAULT_COUNTRY, [form.countryCode]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setPhone = (k: 'mobile' | 'altMobile') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: formatNational(e.target.value, f.countryCode) }));

  /**
   * Switching back to "fresher" clears the employment answers rather than just
   * hiding them: a field the applicant can no longer see must not still be in
   * the payload, saying they work somewhere they told us they do not.
   */
  const setExperience = (type: 'fresher' | 'experienced') =>
    setForm((f) => ({
      ...f,
      experienceType: type,
      ...(type === 'fresher'
        ? { totalExperienceYears: '', currentCompany: '', currentJobTitle: '', currentSalary: '', noticePeriod: '' }
        : {}),
    }));

  const addSkill = (raw: string) => {
    const value = raw.trim().replace(/,$/, '').slice(0, 60); // schema: maxlength 60
    if (!value || skills.some((s) => s.toLowerCase() === value.toLowerCase())) return setSkillDraft('');
    setSkills((s) => [...s, value]);
    setSkillDraft('');
  };
  const skillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillDraft);
    } else if (e.key === 'Backspace' && !skillDraft) {
      setSkills((s) => s.slice(0, -1));
    }
  };

  const pickResume = (file: File | undefined) => {
    if (!file) return;
    const ok = RESUME_MIMES.has(file.type) || RESUME_EXTS.includes(extOf(file.name));
    if (!ok) return setErrors((p) => ({ ...p, resume: 'Upload a PDF, DOC, or DOCX file.' }));
    if (file.size > RESUME_MAX) return setErrors((p) => ({ ...p, resume: `That file is ${kb(file.size)}. The limit is 15 MB.` }));
    setErrors((p) => ({ ...p, resume: undefined }));
    setResume(file);
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErrors((p) => ({ ...p, photo: 'Upload an image (JPG, PNG, or WebP).' }));
    if (file.size > PHOTO_MAX) return setErrors((p) => ({ ...p, photo: `That image is ${kb(file.size)}. The limit is 3 MB.` }));
    setErrors((p) => ({ ...p, photo: undefined }));
    setPhoto(file);
  };

  // Is there a fee to collect at all?
  const feeDue = !!config && config.fee > 0 && config.paymentMode !== 'off';
  // Gateway: submission is gated behind a Cashfree payment. The server already
  // folds credential-readiness into `gatewayReady`, so this is the single source
  // of truth for "pay online, then it's submitted".
  const gatewayMode = !!config && feeDue && config.paymentMode === 'cashfree' && config.gatewayReady;
  // Legacy manual link: pay externally, paste a reference an admin verifies.
  // Also the fallback when the gateway is selected but not ready and a link exists.
  const linkMode = !!config && feeDue && !gatewayMode && !!config.paymentUrl;
  const fmtFee = (c: ApplyConfig) => `${c.currency} ${c.fee.toLocaleString('en-IN')}`;

  const validate = () => {
    const next: typeof errors = {};
    if (!form.fullName.trim()) next.fullName = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.';

    const digits = form.mobile.replace(/\D/g, '');
    if (!digits) next.mobile = 'Mobile number is required.';
    else if (digits.length < country.min || digits.length > country.max) next.mobile = `Enter a valid ${country.name} mobile number.`;

    const alt = form.altMobile.replace(/\D/g, '');
    if (alt && (alt.length < country.min || alt.length > country.max)) next.altMobile = `Enter a valid ${country.name} mobile number.`;

    if (form.passingYear && !(Number(form.passingYear) >= 1950 && Number(form.passingYear) <= 2100)) {
      next.passingYear = 'Enter a year between 1950 and 2100.';
    }
    if (form.experienceType === 'experienced') {
      if (form.totalExperienceYears) {
        const y = Number(form.totalExperienceYears);
        if (!(y >= 0 && y <= 60)) next.totalExperienceYears = 'Enter your experience in years (0–60).';
      }
      // Mirrors applySchema's superRefine, which refuses "experienced" without
      // these two. Checked here as well so the applicant is told before the
      // round-trip, not after — the server stays the one that decides.
      if (!form.currentCompany.trim()) next.currentCompany = 'Tell us your current (or most recent) employer.';
      if (!form.currentJobTitle.trim()) next.currentJobTitle = 'Tell us your current (or most recent) job title.';
    }
    if (!resume) next.resume = 'Please attach your resume.';
    // The photo is optional — an applicant without one to hand still applies.

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume || !validate()) return;
    setSubmitting(true);
    try {
      const digits = form.mobile.replace(/\D/g, '');
      const alt = form.altMobile.replace(/\D/g, '');
      const payload: ApplyPayload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        // One consistent shape for everyone. The server enforces one live
        // application per mobile with an exact-match index, so a form that let
        // half its applicants type "9876543210" and the other half
        // "+91 9876543210" would quietly let the same person apply twice.
        mobile: `${country.dial} ${digits}`,
        altMobile: alt ? `${country.dial} ${alt}` : undefined,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country || undefined,
        pinCode: form.pinCode.trim() || undefined,
        highestQualification: form.highestQualification.trim() || undefined,
        college: form.college.trim() || undefined,
        passingYear: form.passingYear ? Number(form.passingYear) : undefined,
        skills: skills.length ? skills : undefined,
        experienceType: form.experienceType,
        totalExperienceYears: form.totalExperienceYears ? Number(form.totalExperienceYears) : undefined,
        currentCompany: form.currentCompany.trim() || undefined,
        currentJobTitle: form.currentJobTitle.trim() || undefined,
        preferredJobRole: form.preferredJobRole.trim() || undefined,
        preferredLanguage: form.preferredLanguage,
        expectedSalary: form.expectedSalary.trim() || undefined,
        currentSalary: form.currentSalary.trim() || undefined,
        noticePeriod: form.noticePeriod.trim() || undefined,
        linkedin: form.linkedin.trim() || undefined,
        portfolio: form.portfolio.trim() || undefined,
        // Only meaningful in the manual-link flow; sending a stale reference from
        // a hidden section would file a payment claim nobody made. The gateway
        // flow never carries one — the webhook is the proof.
        paymentReference: linkMode ? form.paymentReference.trim() || undefined : undefined,
        declarationAccepted: accepted,
      };

      const created = await applyApi.submit(payload, { resume, photo });

      // Gateway flow: the application is filed but not submitted until paid. Hand
      // the browser to Cashfree; it returns to /apply/status, which is the only
      // thing that will mark it submitted (via the webhook it reconciles against).
      if (created.requiresPayment && created.checkout) {
        setRedirecting(true);
        try {
          await openCashfreeCheckout(created.checkout.paymentSessionId, created.checkout.mode);
        } catch (err: any) {
          // The SDK failed to load or open. Don't strand them — send them to the
          // status page, which can re-open checkout from the verification code.
          toast.error(err?.message || 'Could not open the payment page. You can retry from the status page.');
          window.location.assign(`/apply/status?code=${encodeURIComponent(created.verificationCode || '')}`);
        }
        return;
      }

      setResult({ applicationId: created.applicationId });
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      const dupe = parseDuplicate(err);
      if (dupe) {
        setDuplicate(dupe);
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const { mapped, rest } = fieldErrors(err);
      if (Object.keys(mapped).length || rest.length) {
        setErrors((p) => ({ ...p, ...mapped }));
        toast.error(rest[0] || Object.values(mapped)[0] || genericMessage(err));
      } else {
        toast.error(genericMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyId = async (id: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(id);
    toast.info('Application ID copied');
  };

  /* ── Terminal states ──────────────────────────────── */

  if (duplicate) {
    return (
      <div ref={topRef} className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 text-center md:p-8">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h2 className="mt-4 text-xl font-semibold">You already have an application under review</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          We only keep one open application per person, so there is nothing more to send. Our team is already looking at yours
          and will email you as soon as there is an update.
        </p>
        {/* The id is not always recoverable — the duplicate raised by the database
            under a race names no application. Better to say nothing than to print
            "undefined" at someone who is already confused. */}
        {duplicate.applicationId && (
          <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5">
            <span className="font-mono text-sm font-semibold tracking-tight">{duplicate.applicationId}</span>
            <button type="button" onClick={() => copyId(duplicate.applicationId!)} title="Copy application ID"
              className="text-muted-foreground transition hover:text-foreground">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="mt-5 text-xs text-muted-foreground">{duplicate.message}</p>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div ref={topRef} className="rounded-2xl border border-border bg-card/40 p-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <h2 className="mt-5 text-xl font-semibold">Taking you to secure payment…</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your details are saved. Complete the payment to submit your application — you&apos;ll be brought right back here
          afterwards. Please don&apos;t close this tab.
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <div ref={topRef} className="rounded-2xl border border-border bg-card/40 p-6 text-center md:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
        <h2 className="mt-4 text-2xl font-bold">Application received</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Thanks, {form.fullName.split(' ')[0] || 'and welcome'}. Keep this number — it is how we and you refer to your
          application.
        </p>

        <div className="mx-auto mt-6 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="font-mono text-lg font-bold tracking-tight text-primary">{result.applicationId}</span>
          <button type="button" onClick={() => copyId(result.applicationId)} title="Copy application ID"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground">
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto mt-8 max-w-md text-left">
          <h3 className="text-sm font-semibold">What happens next</h3>
          <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
            <Step n={1}>We have emailed a confirmation to <strong className="text-foreground">{form.email}</strong>.</Step>
            {linkMode && (
              <Step n={2}>
                {form.paymentReference.trim()
                  ? 'Our team checks your payment reference against the payment account by hand. Nothing is marked paid until a person has confirmed it.'
                  : 'Your application fee has not been paid yet. We will email you with how to pay before your application can be reviewed.'}
              </Step>
            )}
            <Step n={linkMode ? 3 : 2}>A reviewer reads your application and decides whether to shortlist you.</Step>
            <Step n={linkMode ? 4 : 3}>If you are shortlisted, we email you an interview link. There is nothing else to do in the meantime.</Step>
          </ol>
        </div>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="h-11 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/30" />
        <span className="sr-only">Loading the application form…</span>
      </div>
    );
  }

  if (configError || !config) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">We couldn&apos;t load the application form</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Something went wrong at our end, so we are not showing you a form we cannot submit. Please try again.
        </p>
        <Button className="mt-6" variant="glass" magnetic={false} onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  if (!config.enabled) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-8 text-center">
        <Info className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Applications are closed at the moment</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          We are not accepting new applications right now. Please check back soon.
        </p>
      </div>
    );
  }

  /* ── The form ─────────────────────────────────────── */

  return (
    <form ref={topRef as any} onSubmit={submit} noValidate className="space-y-8">
      <Section title="Personal details" subtitle="Who you are and how we reach you.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ap-name" label="Full name" required error={errors.fullName}>
            <input id="ap-name" className={fieldCls} value={form.fullName} onChange={set('fullName')} autoComplete="name" aria-invalid={!!errors.fullName} />
          </Field>
          <Field id="ap-email" label="Email address" required error={errors.email}>
            <input id="ap-email" type="email" className={fieldCls} value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} />
          </Field>

          <Field id="ap-cc" label="Country code" required>
            <select id="ap-cc" className={fieldCls} value={form.countryCode} onChange={set('countryCode')} aria-label="Mobile country code">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>)}
            </select>
          </Field>
          <Field id="ap-mobile" label="Mobile number" required error={errors.mobile}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-input bg-muted/40 px-3 text-sm" aria-hidden>
                <span className="text-base leading-none">{country.flag}</span> {country.dial}
              </span>
              <input id="ap-mobile" type="tel" inputMode="tel" className={fieldCls} value={form.mobile} onChange={setPhone('mobile')} autoComplete="tel-national" aria-invalid={!!errors.mobile} />
            </div>
          </Field>

          <Field id="ap-alt" label="Alternate mobile" error={errors.altMobile}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-input bg-muted/40 px-3 text-sm" aria-hidden>
                <span className="text-base leading-none">{country.flag}</span> {country.dial}
              </span>
              <input id="ap-alt" type="tel" inputMode="tel" className={fieldCls} value={form.altMobile} onChange={setPhone('altMobile')} aria-invalid={!!errors.altMobile} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-5">
            <Field id="ap-dob" label="Date of birth">
              <input id="ap-dob" type="date" className={fieldCls} value={form.dob} onChange={set('dob')} autoComplete="bday" max="2100-12-31" />
            </Field>
            <Field id="ap-gender" label="Gender">
              <select id="ap-gender" className={fieldCls} value={form.gender} onChange={set('gender')}>
                <option value="">Select…</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Address" subtitle="Where you are based.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="ap-address" label="Current address">
              <textarea id="ap-address" rows={2} maxLength={500}
                className="w-full rounded-xl border border-input bg-card/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
                value={form.address} onChange={set('address')} autoComplete="street-address" />
            </Field>
          </div>
          <Field id="ap-city" label="City">
            <input id="ap-city" className={fieldCls} value={form.city} onChange={set('city')} autoComplete="address-level2" />
          </Field>
          <Field id="ap-state" label="State">
            <input id="ap-state" className={fieldCls} value={form.state} onChange={set('state')} autoComplete="address-level1" />
          </Field>
          <Field id="ap-country" label="Country">
            <select id="ap-country" className={fieldCls} value={form.country} onChange={set('country')}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
            </select>
          </Field>
          <Field id="ap-pin" label="PIN / postal code">
            <input id="ap-pin" className={fieldCls} value={form.pinCode} onChange={set('pinCode')} autoComplete="postal-code" inputMode="numeric" maxLength={20} />
          </Field>
        </div>
      </Section>

      <Section title="Education" subtitle="Your highest qualification.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="ap-qual" label="Highest qualification">
            <input id="ap-qual" className={fieldCls} value={form.highestQualification} onChange={set('highestQualification')} placeholder="B.Tech, MCA, B.Com…" maxLength={160} />
          </Field>
          <Field id="ap-college" label="College / university">
            <input id="ap-college" className={fieldCls} value={form.college} onChange={set('college')} maxLength={200} />
          </Field>
          <Field id="ap-year" label="Passing year" error={errors.passingYear}>
            <input id="ap-year" type="number" inputMode="numeric" min={1950} max={2100} className={fieldCls} value={form.passingYear} onChange={set('passingYear')} aria-invalid={!!errors.passingYear} />
          </Field>
        </div>
      </Section>

      <Section title="Professional" subtitle="What you do, and the role you are aiming for.">
        <Field id="ap-skills" label="Skills">
          <div className={cn('flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-input bg-card/60 px-3 py-2 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40')}>
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-medium text-primary">
                {s}
                <button type="button" onClick={() => setSkills((p) => p.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="rounded-full p-0.5 transition hover:bg-primary/20">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input id="ap-skills" className="h-7 min-w-[8rem] flex-1 bg-transparent text-sm outline-none" value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={skillKeyDown} onBlur={() => addSkill(skillDraft)}
              placeholder={skills.length ? 'Add another…' : 'React, Python, SQL…'} maxLength={60} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Press Enter or comma after each skill.</p>
        </Field>

        <div className="mt-5">
          <span className="mb-1.5 block text-sm font-medium">Total experience</span>
          <div className="flex gap-2">
            {([['fresher', 'Fresher'], ['experienced', 'Experienced']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setExperience(v)} aria-pressed={form.experienceType === v}
                className={cn('flex-1 rounded-xl border px-4 py-2.5 text-sm transition sm:flex-none sm:px-8',
                  form.experienceType === v ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {form.experienceType === 'experienced' && (
          <div className="mt-5 grid gap-5 rounded-xl border border-border bg-card/30 p-4 sm:grid-cols-2 md:p-5">
            <Field id="ap-years" label="Years of experience" error={errors.totalExperienceYears}>
              <input id="ap-years" type="number" inputMode="decimal" min={0} max={60} step="0.5" className={fieldCls}
                value={form.totalExperienceYears} onChange={set('totalExperienceYears')} aria-invalid={!!errors.totalExperienceYears} />
            </Field>
            <Field id="ap-cc-company" label="Current company" required error={errors.currentCompany}>
              <input id="ap-cc-company" className={fieldCls} value={form.currentCompany} onChange={set('currentCompany')} autoComplete="organization" maxLength={200} aria-invalid={!!errors.currentCompany} />
            </Field>
            <Field id="ap-title" label="Current job title" required error={errors.currentJobTitle}>
              <input id="ap-title" className={fieldCls} value={form.currentJobTitle} onChange={set('currentJobTitle')} autoComplete="organization-title" maxLength={160} aria-invalid={!!errors.currentJobTitle} />
            </Field>
            <Field id="ap-cursal" label="Current salary">
              <input id="ap-cursal" className={fieldCls} value={form.currentSalary} onChange={set('currentSalary')} placeholder="e.g. 6.5 LPA" maxLength={60} />
            </Field>
            <Field id="ap-notice" label="Notice period">
              <input id="ap-notice" className={fieldCls} value={form.noticePeriod} onChange={set('noticePeriod')} placeholder="e.g. 30 days / Immediate" maxLength={60} />
            </Field>
          </div>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="ap-role" label="Preferred job role">
            <input id="ap-role" className={fieldCls} value={form.preferredJobRole} onChange={set('preferredJobRole')} placeholder="Frontend Engineer, Data Analyst…" maxLength={160} />
          </Field>
          <Field id="ap-expsal" label="Expected salary">
            <input id="ap-expsal" className={fieldCls} value={form.expectedSalary} onChange={set('expectedSalary')} placeholder="e.g. 9 LPA" maxLength={60} />
          </Field>
        </div>

        {/* The language the interview itself runs in — questions, conversation,
            voice, scoring and the report all follow it, so it is a headline
            choice rather than one more dropdown. */}
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium"><Languages className="h-4 w-4 text-primary" /> Preferred interview language</span>
          <div className="flex gap-2">
            {([['en', 'English'], ['hi', 'हिन्दी (Hindi)']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, preferredLanguage: v }))} aria-pressed={form.preferredLanguage === v}
                className={cn('flex-1 rounded-lg border px-4 py-2 text-sm transition',
                  form.preferredLanguage === v ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">If you are shortlisted, your interview runs in this language.</p>
        </div>
      </Section>

      <Section title="Links" subtitle="Optional, but they help.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="ap-linkedin" label="LinkedIn">
            <input id="ap-linkedin" type="url" className={fieldCls} value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/…" maxLength={300} />
          </Field>
          <Field id="ap-portfolio" label="Portfolio / GitHub">
            <input id="ap-portfolio" type="url" className={fieldCls} value={form.portfolio} onChange={set('portfolio')} placeholder="https://github.com/…" maxLength={300} />
          </Field>
        </div>
      </Section>

      <Section title="Uploads" subtitle="Your resume. A photo helps, but is optional.">
        <div className="grid gap-5 sm:grid-cols-2">
          <FilePicker
            id="ap-resume" label="Resume" required icon={FileText} hint="PDF, DOC or DOCX · up to 15 MB"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            file={resume} error={errors.resume} onPick={pickResume} onClear={() => setResume(null)}
          />
          <FilePicker
            id="ap-photo" label="Passport-size photo" icon={ImageIcon} hint="Optional · JPG, PNG or WebP · up to 3 MB"
            accept="image/*" file={photo} error={errors.photo} onPick={pickPhoto} onClear={() => setPhoto(null)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Your resume and photo are private. They are never published on a public link — only the review team can open them.
        </p>
      </Section>

      {gatewayMode && (
        <Section title="Application fee" subtitle="Secure payment — your application is submitted once it's paid.">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Fee</span>
              <span className="text-2xl font-bold">{fmtFee(config)}</span>
            </div>
            {config.paymentInstructions && (
              <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-sm text-muted-foreground">
                {config.paymentInstructions}
              </p>
            )}
            <p className="mt-4 flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-px h-4 w-4 shrink-0 text-primary" />
              <span>
                When you press <strong className="text-foreground">Pay &amp; submit</strong> you&apos;ll be taken to our secure
                payment provider (Cashfree). Your application is confirmed automatically the moment the payment succeeds — no
                reference to copy, nothing to email.
              </span>
            </p>
          </div>
        </Section>
      )}

      {linkMode && (
        <Section title="Application fee" subtitle="Pay first, then tell us the reference.">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Fee</span>
              <span className="text-2xl font-bold">{fmtFee(config)}</span>
            </div>

            {config.paymentInstructions && (
              <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-sm text-muted-foreground">
                {config.paymentInstructions}
              </p>
            )}

            <a href={config.paymentUrl} target="_blank" rel="noreferrer noopener" className="mt-4 block">
              <Button type="button" variant="glass" className="w-full" magnetic={false}>
                Pay now <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
            <p className="mt-2 text-center text-xs text-muted-foreground">Opens the payment page in a new tab. Come back here afterwards.</p>

            <div className="mt-5 border-t border-border pt-5">
              <Field id="ap-ref" label="Payment reference" error={errors.paymentReference}>
                <input id="ap-ref" className={fieldCls} value={form.paymentReference} onChange={set('paymentReference')}
                  placeholder="UTR / transaction ID" maxLength={120} aria-describedby="ap-ref-claim" />
              </Field>
              {/* The whole point of this module: nothing comes back from the
                  payment page, so a reference is a claim and must never read as
                  a receipt. Only an admin can turn it into "verified". */}
              <p id="ap-ref-claim" className="mt-2 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <Info className="mt-px h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  This does <strong className="text-foreground">not</strong> mark your application as paid. It records that you
                  say you have paid; our team checks the reference against the payment account by hand. You will be emailed
                  once it is confirmed.
                </span>
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* Declaration — the wording is the admin's, and the exact text ticked here
          is frozen onto the application, so it is rendered from config and never
          hardcoded. */}
      <Section title="Declaration" subtitle="Please read before submitting.">
        <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition',
          accepted ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40')}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
          <span className="text-muted-foreground">
            {config.declarationText} <span className="text-destructive">*</span>
          </span>
        </label>
      </Section>

      <div className="flex flex-col-reverse items-center gap-4 border-t border-border pt-6 sm:flex-row sm:justify-between">
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        {/* `submitting` matters as much as `accepted`: Button's `loading` only
            swaps the icon for a spinner, it does not disable anything. Without
            it an impatient second click posts the whole 15MB body again, and the
            two requests race the one-live-application index — so the applicant
            gets a "you already applied" error naming their own submission. */}
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={submitting} magnetic={false}
          disabled={!accepted || submitting}>
          {gatewayMode ? <>Pay {fmtFee(config)} &amp; submit <Send className="h-4 w-4" /></> : <>Submit application <Send className="h-4 w-4" /></>}
        </Button>
      </div>
    </form>
  );
}

/* ── Local building blocks ──────────────────────────── */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 md:p-8">
      <header className="mb-5 border-b border-border pb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function FilePicker({
  id, label, required, icon: Icon, hint, accept, file, error, onPick, onClear,
}: {
  id: string; label: string; required?: boolean; icon: typeof FileText; hint: string; accept: string;
  file: File | null; error?: string; onPick: (f: File | undefined) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label} {required && <span className="text-destructive">*</span>}</span>
      <input ref={ref} id={id} type="file" accept={accept} className="sr-only"
        onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} aria-invalid={!!error} />

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>
            <span className="block text-xs text-muted-foreground">{kb(file.size)}</span>
          </span>
          <button type="button" onClick={() => { onClear(); ref.current?.focus(); }} aria-label={`Remove ${file.name}`}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className={cn('flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition hover:border-primary/60 hover:bg-muted/30',
            error ? 'border-destructive/60' : 'border-input')}>
          <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Choose a file</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
        </button>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default ApplyForm;
