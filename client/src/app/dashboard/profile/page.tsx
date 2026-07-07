'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, FileText, Camera, Shield, KeyRound } from 'lucide-react';
import { candidateApi } from '@/lib/candidate.api';
import { accountApi } from '@/lib/account.api';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
const GENDERS: [string, string][] = [
  ['', 'Select…'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['prefer_not_to_say', 'Prefer not to say'],
];

const EMPTY = {
  name: '', phone: '', dob: '', gender: '', address: '', city: '', state: '', country: '', postalCode: '',
  qualification: '', skills: '', totalExperience: '', currentCompany: '', currentDesignation: '',
  currentSalary: '', expectedSalary: '', noticePeriod: '', preferredLocation: '', linkedin: '', portfolio: '', summary: '',
};

export default function ProfilePage() {
  const qc = useQueryClient();
  const hydrate = useAuth((s) => s.hydrate);
  const { data } = useQuery({ queryKey: ['profile'], queryFn: candidateApi.profile });
  const resumeRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!data) return;
    const p = data.profile || {};
    setForm({
      name: data.user?.name || '', phone: data.user?.phone || '',
      dob: p.dob || '', gender: p.gender || '', address: p.address || '', city: p.city || '',
      state: p.state || '', country: p.country || '', postalCode: p.postalCode || '',
      qualification: p.qualification || '', skills: (p.skills || []).join(', '),
      totalExperience: p.totalExperience || '', currentCompany: p.currentCompany || '',
      currentDesignation: p.currentDesignation || '', currentSalary: p.currentSalary || '',
      expectedSalary: p.expectedSalary || '', noticePeriod: p.noticePeriod || '',
      preferredLocation: p.preferredLocation || '', linkedin: p.linkedin || '', portfolio: p.portfolio || '',
      summary: p.summary || '',
    });
  }, [data]);

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      candidateApi.updateProfile({
        name: form.name,
        phone: form.phone || undefined,
        profile: {
          dob: form.dob, gender: form.gender, address: form.address, city: form.city, state: form.state,
          country: form.country, postalCode: form.postalCode, qualification: form.qualification,
          skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          totalExperience: form.totalExperience, currentCompany: form.currentCompany,
          currentDesignation: form.currentDesignation, currentSalary: form.currentSalary,
          expectedSalary: form.expectedSalary, noticePeriod: form.noticePeriod,
          preferredLocation: form.preferredLocation, linkedin: form.linkedin, portfolio: form.portfolio,
          summary: form.summary,
        },
      }),
    onSuccess: () => { toast.success('Profile saved'); qc.invalidateQueries({ queryKey: ['profile'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const uploadResume = useMutation({
    mutationFn: (file: File) => candidateApi.uploadResume(file),
    onSuccess: () => { toast.success('Resume uploaded'); qc.invalidateQueries({ queryKey: ['profile'] }); },
    onError: () => toast.error('Upload failed'),
  });

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => accountApi.uploadAvatar(file),
    onSuccess: async () => { toast.success('Photo updated'); await hydrate(); qc.invalidateQueries({ queryKey: ['profile'] }); },
    onError: () => toast.error('Upload failed'),
  });

  const resume = data?.profile?.resume;
  const avatarUrl = data?.user?.avatar ? `${API_ORIGIN}${data.user.avatar}` : null;
  const initial = (data?.user?.name?.[0] || 'U').toUpperCase();

  return (
    <div className="space-y-8">
      <PageHeader title="My Profile" description="Complete your profile so recruiters and AI matching see the full picture." />

      {/* Photo + account */}
      <GlassCard>
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt={data?.user?.name} className="h-24 w-24 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-2xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-3xl font-bold text-white">{initial}</span>
            )}
            <button onClick={() => photoRef.current?.click()} className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl border border-border bg-card shadow-lg transition hover:bg-muted/60" aria-label="Change photo">
              <Camera className="h-4 w-4" />
            </button>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto.mutate(f); e.target.value = ''; }} />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold">{data?.user?.name}</h2>
            <p className="text-sm text-muted-foreground">{data?.user?.email}</p>
            <Button size="sm" variant="glass" magnetic={false} className="mt-3" loading={uploadPhoto.isPending} onClick={() => photoRef.current?.click()}>
              <Camera className="h-4 w-4" /> {avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Personal */}
      <GlassCard>
        <h2 className="text-lg font-semibold">Personal details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
          <Field label="Email address" value={data?.user?.email || ''} onChange={() => {}} disabled />
          <Field label="Mobile number" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          <Field label="Date of birth" type="date" value={form.dob} onChange={set('dob')} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Gender</label>
            <select value={form.gender} onChange={(e) => set('gender')(e.target.value)} className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40">
              {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <Field label="Postal / ZIP code" value={form.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
          <div className="sm:col-span-2"><Field label="Address" value={form.address} onChange={set('address')} autoComplete="street-address" /></div>
          <Field label="City" value={form.city} onChange={set('city')} autoComplete="address-level2" />
          <Field label="State / Province" value={form.state} onChange={set('state')} autoComplete="address-level1" />
          <Field label="Country" value={form.country} onChange={set('country')} autoComplete="country-name" />
        </div>
      </GlassCard>

      {/* Professional */}
      <GlassCard>
        <h2 className="text-lg font-semibold">Professional details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Highest qualification" value={form.qualification} onChange={set('qualification')} placeholder="e.g. B.Tech, MBA" />
          <Field label="Total experience" value={form.totalExperience} onChange={set('totalExperience')} placeholder="e.g. 5 years" />
          <div className="sm:col-span-2"><Field label="Skills (comma-separated)" value={form.skills} onChange={set('skills')} placeholder="React, Node.js, SQL" /></div>
          <Field label="Current company" value={form.currentCompany} onChange={set('currentCompany')} />
          <Field label="Current designation" value={form.currentDesignation} onChange={set('currentDesignation')} />
          <Field label="Current salary" value={form.currentSalary} onChange={set('currentSalary')} placeholder="e.g. 12 LPA" />
          <Field label="Expected salary" value={form.expectedSalary} onChange={set('expectedSalary')} placeholder="e.g. 18 LPA" />
          <Field label="Notice period" value={form.noticePeriod} onChange={set('noticePeriod')} placeholder="e.g. 30 days" />
          <Field label="Preferred job location" value={form.preferredLocation} onChange={set('preferredLocation')} />
          <Field label="LinkedIn profile" value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/…" />
          <Field label="Portfolio / website (optional)" value={form.portfolio} onChange={set('portfolio')} placeholder="https://…" />
          <div className="sm:col-span-2"><Textarea label="Professional summary" value={form.summary} onChange={set('summary')} /></div>
        </div>
        <Button className="mt-5" magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Save profile
        </Button>
      </GlassCard>

      {/* Resume */}
      <GlassCard>
        <h2 className="text-lg font-semibold">Resume / CV</h2>
        {resume?.filename ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3">
            <FileText className="h-5 w-5 text-primary" />
            <a href={resume.url?.startsWith('http') ? resume.url : `${API_ORIGIN}${resume.url}`} target="_blank" rel="noreferrer" className="truncate text-sm hover:underline">{resume.filename}</a>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No resume uploaded yet.</p>
        )}
        <Button className="mt-4" variant="glass" magnetic={false} loading={uploadResume.isPending} onClick={() => resumeRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload resume
        </Button>
        <input ref={resumeRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResume.mutate(f); e.target.value = ''; }} />
        <p className="mt-3 text-xs text-muted-foreground">PDF, DOCX, or TXT. Used by recruiters and AI matching.</p>
      </GlassCard>

      {/* Security */}
      <GlassCard>
        <h2 className="text-lg font-semibold">Password &amp; security</h2>
        <p className="mt-1 text-sm text-muted-foreground">Change your password and manage two-factor authentication.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard/security"><Button variant="glass" size="sm" magnetic={false}><KeyRound className="h-4 w-4" /> Change password</Button></Link>
          <Link href="/dashboard/security"><Button variant="glass" size="sm" magnetic={false}><Shield className="h-4 w-4" /> Two-factor authentication</Button></Link>
        </div>
      </GlassCard>
    </div>
  );
}
