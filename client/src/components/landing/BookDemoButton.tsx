'use client';

import { useMemo, useState } from 'react';
import { PlayCircle, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { PhoneField, joinPhone } from '@/components/ui/ProfileFields';
import { toast } from '@/components/ui/toast';
import { marketingApi } from '@/lib/marketing.api';
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries';

const TIME_SLOTS = ['09:00 – 10:00', '10:00 – 11:00', '11:00 – 12:00', '12:00 – 13:00', '14:00 – 15:00', '15:00 – 16:00', '16:00 – 17:00', '17:00 – 18:00'];
const EMPLOYEES = ['', '1–10', '11–50', '51–200', '201–500', '501–1000', '1000+'];
const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];

const empty = () => ({
  name: '', company: '', email: '', code: DEFAULT_COUNTRY.code, phone: '',
  preferredDate: '', timeSlot: TIME_SLOTS[1], timezone: '', employees: '', message: '', company_website: '',
});

export function BookDemoButton({ label = 'Book a demo', className }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const browserTz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } }, []);
  const tzOptions = useMemo(() => Array.from(new Set([browserTz, ...TIMEZONES])).map((t) => ({ label: t, value: t })), [browserTz]);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const today = new Date().toISOString().slice(0, 10);

  const openModal = () => { setForm({ ...empty(), timezone: browserTz }); setErrors({}); setDone(false); setOpen(true); };

  const submit = async () => {
    const country = COUNTRIES.find((c) => c.code === form.code) || DEFAULT_COUNTRY;
    const digits = form.phone.replace(/\D/g, '');
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email.';
    if (digits.length < country.min || digits.length > country.max) next.phone = `Enter a valid ${country.name} mobile number.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await marketingApi.demo({
        name: form.name.trim(), company: form.company.trim() || undefined, email: form.email.trim(),
        phone: joinPhone(form.code, form.phone), country: country.name,
        preferredDate: form.preferredDate || undefined, timeSlot: form.timeSlot, timezone: form.timezone || browserTz,
        employees: form.employees || undefined, message: form.message.trim() || undefined,
        company_website: form.company_website,
      });
      setDone(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button size="lg" variant="glass" magnetic={false} className={className} onClick={openModal}>
        <PlayCircle className="h-5 w-5" /> {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="2xl"
        title={done ? undefined : 'Book a demo'}
        description={done ? undefined : 'Tell us a bit about you and pick a time — we’ll confirm your slot by email.'}
        footer={done ? (
          <Button magnetic={false} onClick={() => setOpen(false)}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button magnetic={false} loading={submitting} onClick={submit}><CalendarCheck className="h-4 w-4" /> Request demo</Button>
          </>
        )}
      >
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Demo request received 🎉</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Thanks! Your booking status is <span className="font-medium text-yellow-500">Pending</span>. Our team will confirm your slot by email shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Honeypot */}
            <input type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden value={form.company_website} onChange={(e) => set('company_website')(e.target.value)} className="absolute left-[-9999px] h-0 w-0 opacity-0" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Field label="Full name *" value={form.name} onChange={set('name')} />{errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}</div>
              <Field label="Company name" value={form.company} onChange={set('company')} />
              <div><Field label="Email address *" type="email" value={form.email} onChange={set('email')} />{errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}</div>
              <PhoneField label="Mobile number *" code={form.code} national={form.phone} onCode={set('code')} onNational={set('phone')} error={errors.phone} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Preferred demo date</span>
                <input type="date" min={today} value={form.preferredDate} onChange={(e) => set('preferredDate')(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40" />
              </label>
              <Select label="Preferred time slot" value={form.timeSlot} onChange={set('timeSlot')} options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} />
              <Select label="Time zone" value={form.timezone || browserTz} onChange={set('timezone')} options={tzOptions} />
              <Select label="Number of employees (optional)" value={form.employees} onChange={set('employees')} options={EMPLOYEES.map((e) => ({ label: e || '—', value: e }))} />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Message / requirements (optional)</span>
              <textarea rows={3} value={form.message} onChange={(e) => set('message')(e.target.value)}
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40" />
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

export default BookDemoButton;
