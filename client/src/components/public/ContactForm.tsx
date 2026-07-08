'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { marketingApi, type CaptchaConfig } from '@/lib/marketing.api';
import { Captcha, type CaptchaHandle } from '@/components/public/Captcha';
import { COUNTRIES, DEFAULT_COUNTRY, formatNational } from '@/lib/countries';

const fieldCls =
  'h-11 w-full rounded-xl border border-input bg-card/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

const SUBJECTS = ['Sales', 'Support', 'Partnerships', 'Media & Press', 'Careers', 'Other'] as const;

type Form = {
  name: string;
  email: string;
  countryCode: string; // ISO alpha-2
  phone: string; // national digits (formatted for display)
  company: string;
  jobTitle: string;
  subject: string;
  message: string;
  company_website: string; // honeypot
};

const empty = (subject: string): Form => ({
  name: '', email: '', countryCode: DEFAULT_COUNTRY.code, phone: '', company: '', jobTitle: '',
  subject, message: '', company_website: '',
});

/** Backend-integrated public contact form: mandatory fields, international mobile, validation. */
export function ContactForm({ defaultSubject = 'Sales' }: { defaultSubject?: string }) {
  const [form, setForm] = useState<Form>(() => empty(defaultSubject));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Spam protection (loaded from the admin config).
  const [captchaCfg, setCaptchaCfg] = useState<CaptchaConfig | null>(null);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const captchaRef = useRef<CaptchaHandle>(null);
  useEffect(() => {
    marketingApi.captcha().then(setCaptchaCfg).catch(() => setCaptchaCfg(null));
  }, []);
  const captchaOn = !!captchaCfg?.enabled && captchaCfg.provider !== 'none' && (captchaCfg.forms?.includes('contact') ?? true);
  const needsInteractiveCaptcha = captchaOn && captchaCfg?.provider !== 'recaptcha_v3';

  const country = useMemo(() => COUNTRIES.find((c) => c.code === form.countryCode) || DEFAULT_COUNTRY, [form.countryCode]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, phone: formatNational(e.target.value, f.countryCode) }));

  const validate = () => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) next.name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.';
    const digits = form.phone.replace(/\D/g, '');
    if (!digits) next.phone = 'Mobile number is required.';
    else if (digits.length < country.min || digits.length > country.max) next.phone = `Enter a valid ${country.name} mobile number.`;
    if (!form.subject) next.subject = 'Please choose a subject.';
    if (form.message.trim().length < 10) next.message = 'Tell us a little more (10+ characters).';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (needsInteractiveCaptcha && !captchaSolved) {
      toast.error('Please complete the CAPTCHA to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const captchaToken = captchaOn ? await captchaRef.current?.getToken() : undefined;
      const digits = form.phone.replace(/\D/g, '');
      await marketingApi.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: `${country.dial} ${digits}`,
        country: country.name,
        company: form.company.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        subject: form.subject,
        message: form.message.trim(),
        company_website: form.company_website,
        captchaToken: captchaToken || undefined,
      });
      toast.success('Message sent — we will get back to you shortly.');
      setSent(true);
    } catch (err: any) {
      // Surface field-specific validation errors from the server, not just a generic message.
      const details = err?.response?.data?.details as Record<string, string[]> | undefined;
      if (details && typeof details === 'object') {
        const mapped: Partial<Record<keyof Form, string>> = {};
        for (const [field, msgs] of Object.entries(details)) {
          if (field in form) mapped[field as keyof Form] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        }
        setErrors((prev) => ({ ...prev, ...mapped }));
        const first = Object.values(mapped)[0];
        toast.error(first || err?.response?.data?.message || 'Please check the highlighted fields.');
      } else {
        toast.error(err?.response?.data?.message || 'Something went wrong. Please try again or email us directly.');
      }
      captchaRef.current?.reset();
      setCaptchaSolved(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
        <h3 className="mt-4 text-lg font-semibold">Thanks — we&apos;ll be in touch</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your message has been received. We typically reply within one business day.
        </p>
        <Button className="mt-6" variant="glass" magnetic={false} onClick={() => { setForm(empty(defaultSubject)); setSent(false); setErrors({}); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-border bg-card/40 p-6 md:p-8">
      {/* Honeypot (hidden from users, catches bots) */}
      <input
        type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden
        value={form.company_website} onChange={set('company_website')}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="cf-name" label="Full name" required error={errors.name}>
          <input id="cf-name" className={fieldCls} value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        <Field id="cf-email" label="Email address" required error={errors.email}>
          <input id="cf-email" type="email" className={fieldCls} value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} />
        </Field>

        <Field id="cf-country" label="Country" required>
          <select id="cf-country" className={fieldCls} value={form.countryCode} onChange={set('countryCode')} aria-label="Country">
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>)}
          </select>
        </Field>
        <Field id="cf-phone" label="Mobile number" required error={errors.phone}>
          <div className={`flex items-center gap-2 ${errors.phone ? 'rounded-xl ring-2 ring-destructive/40' : ''}`}>
            <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-input bg-muted/40 px-3 text-sm" aria-hidden>
              <span className="text-base leading-none">{country.flag}</span> {country.dial}
            </span>
            <input
              id="cf-phone" type="tel" inputMode="tel" className={fieldCls} value={form.phone} onChange={setPhone}
              autoComplete="tel-national" placeholder="Mobile number" aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'cf-phone-err' : undefined}
            />
          </div>
        </Field>

        <Field id="cf-company" label="Company">
          <input id="cf-company" className={fieldCls} value={form.company} onChange={set('company')} autoComplete="organization" />
        </Field>
        <Field id="cf-jobtitle" label="Job title">
          <input id="cf-jobtitle" className={fieldCls} value={form.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" />
        </Field>
      </div>

      <div className="mt-5">
        <Field id="cf-subject" label="Subject" required error={errors.subject}>
          <select id="cf-subject" className={fieldCls} value={form.subject} onChange={set('subject')} aria-invalid={!!errors.subject}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <Field id="cf-message" label="Message" required error={errors.message}>
          <textarea
            id="cf-message" rows={5}
            className="w-full rounded-xl border border-input bg-card/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            value={form.message} onChange={set('message')} aria-invalid={!!errors.message}
          />
        </Field>
      </div>

      {captchaOn && captchaCfg && (
        <div className="mt-5">
          <Captcha
            ref={captchaRef}
            provider={captchaCfg.provider}
            siteKey={captchaCfg.siteKey}
            onSolvedChange={setCaptchaSolved}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">We respect your privacy. No spam, ever.</p>
        <Button type="submit" loading={submitting} magnetic={false} disabled={needsInteractiveCaptcha && !captchaSolved}>
          Send message <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function Field({
  id, label, required, error, children,
}: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
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

export default ContactForm;
