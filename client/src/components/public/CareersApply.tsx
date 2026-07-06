'use client';

import { useRef, useState } from 'react';
import { MapPin, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { marketingApi } from '@/lib/marketing.api';

export interface Role {
  title: string;
  team: string;
  location: string;
  type: string;
}

const fieldCls =
  'h-11 w-full rounded-xl border border-input bg-card/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

/** Open-roles list + application form sharing the selected role. */
export function CareersApply({ roles }: { roles: Role[] }) {
  const formRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState('General application');
  const [form, setForm] = useState({ name: '', email: '', links: '', message: '', company_website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const roleOptions = ['General application', ...roles.map((r) => r.title)];

  const apply = (title: string) => {
    setRole(title);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email.';
    if (form.message.trim().length < 10) next.message = 'Tell us why you would be a great fit (10+ characters).';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await marketingApi.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: 'Careers',
        jobTitle: role,
        message: `Applying for: ${role}\nLinks: ${form.links || '—'}\n\n${form.message.trim()}`,
        company_website: form.company_website,
      });
      toast.success('Application received — thank you! We will be in touch.');
      setSent(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Open roles */}
      <div className="space-y-4">
        {roles.map((r) => (
          <GlassCard key={r.title} interactive className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{r.title}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{r.team}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.location}</span>
                <span>{r.type}</span>
              </p>
            </div>
            <button
              onClick={() => apply(r.title)}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted/60"
            >
              Apply <ArrowRight className="h-4 w-4" />
            </button>
          </GlassCard>
        ))}
      </div>

      {/* Application form */}
      <div ref={formRef} id="apply" className="mt-14 scroll-mt-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">Apply now</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
            Tell us about yourself. We read every application.
          </p>

          {sent ? (
            <div className="mt-8 rounded-2xl border border-border bg-card/40 p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
              <h3 className="mt-4 text-lg font-semibold">Application received</h3>
              <p className="mt-2 text-sm text-muted-foreground">Thanks for your interest in joining us. Our team will review and reach out.</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-8 rounded-2xl border border-border bg-card/40 p-6 md:p-8">
              <input type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden value={form.company_website} onChange={set('company_website')} className="absolute left-[-9999px] h-0 w-0 opacity-0" />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="ap-name" className="mb-1.5 block text-sm font-medium">Full name <span className="text-destructive">*</span></label>
                  <input id="ap-name" className={fieldCls} value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} />
                  {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="ap-email" className="mb-1.5 block text-sm font-medium">Email <span className="text-destructive">*</span></label>
                  <input id="ap-email" type="email" className={fieldCls} value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} />
                  {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="ap-role" className="mb-1.5 block text-sm font-medium">Role</label>
                  <select id="ap-role" className={fieldCls} value={role} onChange={(e) => setRole(e.target.value)}>
                    {roleOptions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ap-links" className="mb-1.5 block text-sm font-medium">Portfolio / résumé link</label>
                  <input id="ap-links" className={fieldCls} value={form.links} onChange={set('links')} placeholder="LinkedIn, GitHub, or CV URL" />
                </div>
              </div>
              <div className="mt-5">
                <label htmlFor="ap-message" className="mb-1.5 block text-sm font-medium">Why you? <span className="text-destructive">*</span></label>
                <textarea id="ap-message" rows={5} className="w-full rounded-xl border border-input bg-card/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40" value={form.message} onChange={set('message')} aria-invalid={!!errors.message} />
                {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
              </div>
              <div className="mt-6 flex justify-end">
                <Button type="submit" loading={submitting} magnetic={false}>Submit application <Send className="h-4 w-4" /></Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export default CareersApply;
