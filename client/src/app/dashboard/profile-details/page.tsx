'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Save, Shield, KeyRound } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { accountApi } from '@/lib/account.api';
import { date } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

const GENDERS: [string, string][] = [
  ['', 'Select…'],
  ['male', 'Male'],
  ['female', 'Female'],
  ['other', 'Other'],
  ['prefer_not_to_say', 'Prefer not to say'],
];

const EMPTY = { name: '', email: '', phone: '', dob: '', gender: '', address: '', city: '', state: '', country: '', postalCode: '' };

export default function ProfileDetailsPage() {
  const hydrate = useAuth((s) => s.hydrate);
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: accountApi.me });
  const u = me?.user;

  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!u) return;
    const p = u.meta?.profile || {};
    setForm({
      name: u.name || '', email: u.email || '', phone: u.phone || '',
      dob: p.dob || '', gender: p.gender || '', address: p.address || '',
      city: p.city || '', state: p.state || '', country: p.country || '', postalCode: p.postalCode || '',
    });
  }, [u]);

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (form.name.trim().length < 2) { toast.error('Enter your full name.'); return; }
    setSaving(true);
    try {
      await accountApi.updateProfile(form);
      await hydrate();
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return; }
    setUploading(true);
    try {
      await accountApi.uploadAvatar(file);
      await hydrate();
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile photo updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const initial = (u?.name?.[0] || 'U').toUpperCase();
  const avatarUrl = u?.avatar ? `${API_ORIGIN}${u.avatar}` : null;
  const emailChanged = !!form.email && !!u?.email && form.email !== u.email;

  return (
    <div className="space-y-8">
      <PageHeader title="Profile" description="Manage your personal details and profile photo." />

      <GlassCard>
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt={u?.name} className="h-24 w-24 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-2xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-3xl font-bold text-white">{initial}</span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl border border-border bg-card shadow-lg transition hover:bg-muted/60"
              aria-label="Change photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold">{u?.name}</h2>
            <p className="text-sm text-muted-foreground">{u?.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge tone="default" className="capitalize">{u?.role?.replace('_', ' ')}</Badge>
              {u?.twoFactor?.enabled && <Badge tone="success">2FA on</Badge>}
              {u?.createdAt && <span className="text-xs text-muted-foreground">Member since {date(u.createdAt)}</span>}
            </div>
            <Button size="sm" variant="glass" magnetic={false} className="mt-3" loading={uploading} onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> {avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold">Personal details</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
          <Field label="Email address" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          <Field label="Mobile number" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          <Field label="Date of birth" type="date" value={form.dob} onChange={set('dob')} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => set('gender')(e.target.value)}
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            >
              {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <Field label="Postal / ZIP code" value={form.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
          <div className="sm:col-span-2">
            <Field label="Address" value={form.address} onChange={set('address')} autoComplete="street-address" />
          </div>
          <Field label="City" value={form.city} onChange={set('city')} autoComplete="address-level2" />
          <Field label="State / Province" value={form.state} onChange={set('state')} autoComplete="address-level1" />
          <Field label="Country" value={form.country} onChange={set('country')} autoComplete="country-name" />
        </div>

        {emailChanged && (
          <p className="mt-3 text-xs text-amber-500">Changing your email will require you to verify the new address.</p>
        )}

        <div className="mt-6">
          <Button magnetic={false} loading={saving} onClick={save}><Save className="h-4 w-4" /> Save changes</Button>
        </div>
      </GlassCard>

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
