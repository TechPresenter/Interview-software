'use client';

import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { marketingApi } from '@/lib/marketing.api';

const fieldCls =
  'h-11 w-full rounded-xl border border-input bg-card/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

const SUBJECTS = ['Sales', 'Support', 'Partnerships', 'Media & Press', 'Careers', 'Other'] as const;

type Form = {
  name: string;
  email: string;
  company: string;
  phone: string;
  jobTitle: string;
  subject: string;
  message: string;
  company_website: string; // honeypot
};

const empty = (subject: string): Form => ({
  name: '', email: '', company: '', phone: '', jobTitle: '', subject, message: '', company_website: '',
});

/** Backend-integrated public contact form with validation and toast feedback. */
export function ContactForm({ defaultSubject = 'Sales' }: { defaultSubject?: string }) {
  const [form, setForm] = useState<Form>(() => empty(defaultSubject));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid work email.';
    if (form.phone && !/^[+()\d\s-]{6,}$/.test(form.phone)) next.phone = 'Enter a valid phone number.';
    if (form.message.trim().length < 10) next.message = 'Tell us a little more (10+ characters).';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await marketingApi.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        subject: form.subject,
        message: form.message.trim(),
        company_website: form.company_website,
      });
      toast.success('Message sent — we will get back to you shortly.');
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong. Please try again or email us directly.';
      toast.error(msg);
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
        <Button className="mt-6" variant="glass" magnetic={false} onClick={() => { setForm(empty(defaultSubject)); setSent(false); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-border bg-card/40 p-6 md:p-8">
      {/* Honeypot (hidden from users, catches bots) */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={form.company_website}
        onChange={set('company_website')}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="cf-name" label="Full name" required error={errors.name}>
          <input id="cf-name" className={fieldCls} value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        <Field id="cf-email" label="Work email" required error={errors.email}>
          <input id="cf-email" type="email" className={fieldCls} value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field id="cf-company" label="Company">
          <input id="cf-company" className={fieldCls} value={form.company} onChange={set('company')} autoComplete="organization" />
        </Field>
        <Field id="cf-phone" label="Phone" error={errors.phone}>
          <input id="cf-phone" type="tel" className={fieldCls} value={form.phone} onChange={set('phone')} autoComplete="tel" aria-invalid={!!errors.phone} />
        </Field>
        <Field id="cf-jobtitle" label="Job title">
          <input id="cf-jobtitle" className={fieldCls} value={form.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" />
        </Field>
        <Field id="cf-subject" label="Subject">
          <select id="cf-subject" className={fieldCls} value={form.subject} onChange={set('subject')}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <Field id="cf-message" label="Message" required error={errors.message}>
          <textarea
            id="cf-message"
            rows={5}
            className="w-full rounded-xl border border-input bg-card/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            value={form.message}
            onChange={set('message')}
            aria-invalid={!!errors.message}
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">We respect your privacy. No spam, ever.</p>
        <Button type="submit" loading={submitting} magnetic={false}>
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
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default ContactForm;
