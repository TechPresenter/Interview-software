'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, Image as ImageIcon, Palette, LayoutTemplate, Share2, Phone, Megaphone, Search, Code2 } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { useBranding } from '@/store/branding.store';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
const TABS = [
  { key: 'identity', label: 'Identity', icon: ImageIcon },
  { key: 'theme', label: 'Theme', icon: Palette },
  { key: 'login', label: 'Login page', icon: LayoutTemplate },
  { key: 'social', label: 'Social', icon: Share2 },
  { key: 'contact', label: 'Contact', icon: Phone },
  { key: 'announcement', label: 'Announcement', icon: Megaphone },
  { key: 'seo', label: 'SEO', icon: Search },
  { key: 'css', label: 'Custom CSS', icon: Code2 },
];

export default function BrandingPage() {
  const qc = useQueryClient();
  const reloadBranding = useBranding((s) => s.load);
  const { data } = useQuery({ queryKey: ['admin-branding'], queryFn: adminApi.getBranding });
  const [tab, setTab] = useState('identity');
  const [f, setF] = useState<any>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (data) setF(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: () => adminApi.updateBranding({
      platformName: f.platformName, tagline: f.tagline, footerText: f.footerText, customCss: f.customCss,
      theme: f.theme, login: f.login, social: f.social, contact: f.contact, announcement: f.announcement, seo: f.seo,
    }),
    onSuccess: () => { toast.success('Branding saved'); qc.invalidateQueries({ queryKey: ['admin-branding'] }); reloadBranding(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const upload = useMutation({
    mutationFn: ({ field, file }: { field: string; file: File }) => adminApi.uploadBrandingAsset(field, file),
    onSuccess: () => { toast.success('Image uploaded'); qc.invalidateQueries({ queryKey: ['admin-branding'] }); reloadBranding(); },
    onError: () => toast.error('Upload failed'),
  });

  if (!f) return <div className="grid min-h-[40vh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setIn = (group: string, k: string, v: any) => setF((p: any) => ({ ...p, [group]: { ...p[group], [k]: v } }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="White Label"
        description="Brand the entire platform — applied live across login, dashboard, and emails."
        action={<Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save changes</Button>}
      />

      <div className="flex flex-wrap gap-1 rounded-xl border border-border p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition', tab === t.key ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white shadow-glow' : 'text-muted-foreground hover:text-foreground')}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <GlassCard className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform name" value={f.platformName ?? ''} onChange={(v) => set('platformName', v)} />
            <Field label="Tagline" value={f.tagline ?? ''} onChange={(v) => set('tagline', v)} />
          </div>
          <Field label="Footer text  (use {year})" value={f.footerText ?? ''} onChange={(v) => set('footerText', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <AssetField label="Logo" url={f.logoUrl} onPick={() => logoRef.current?.click()} />
            <AssetField label="Favicon" url={f.faviconUrl} onPick={() => faviconRef.current?.click()} />
          </div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate({ field: 'logoUrl', file }); e.target.value = ''; }} />
          <input ref={faviconRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate({ field: 'faviconUrl', file }); e.target.value = ''; }} />
        </GlassCard>
      )}

      {tab === 'theme' && (
        <GlassCard className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField label="Primary color" value={f.theme?.primary ?? '#7c5cff'} onChange={(v) => setIn('theme', 'primary', v)} />
            <ColorField label="Accent color" value={f.theme?.accent ?? '#22d3ee'} onChange={(v) => setIn('theme', 'accent', v)} />
            <Select label="Display font" value={f.theme?.font ?? 'Sora'} onChange={(v) => setIn('theme', 'font', v)} options={['Sora', 'Inter', 'Space Grotesk', 'Poppins'].map((x) => ({ label: x, value: x }))} />
            <Select label="Default mode" value={f.theme?.defaultMode ?? 'dark'} onChange={(v) => setIn('theme', 'defaultMode', v)} options={[{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }]} />
          </div>
          <p className="text-xs text-muted-foreground">Colors apply instantly across the platform after saving.</p>
        </GlassCard>
      )}

      {tab === 'login' && (
        <GlassCard className="space-y-4">
          <Field label="Headline" value={f.login?.headline ?? ''} onChange={(v) => setIn('login', 'headline', v)} />
          <Field label="Subtext" value={f.login?.subtext ?? ''} onChange={(v) => setIn('login', 'subtext', v)} />
        </GlassCard>
      )}

      {tab === 'social' && (
        <GlassCard className="grid gap-4 sm:grid-cols-2">
          {['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'whatsapp', 'telegram'].map((s) => (
            <Field key={s} label={s[0].toUpperCase() + s.slice(1)} value={f.social?.[s] ?? ''} onChange={(v) => setIn('social', s, v)} placeholder="https://…" />
          ))}
        </GlassCard>
      )}

      {tab === 'contact' && (
        <GlassCard className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" value={f.contact?.email ?? ''} onChange={(v) => setIn('contact', 'email', v)} />
            <Field label="Phone" value={f.contact?.phone ?? ''} onChange={(v) => setIn('contact', 'phone', v)} />
          </div>
          <Textarea label="Address" value={f.contact?.address ?? ''} onChange={(v) => setIn('contact', 'address', v)} />
        </GlassCard>
      )}

      {tab === 'announcement' && (
        <GlassCard className="space-y-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.announcement?.enabled} onChange={(e) => setIn('announcement', 'enabled', e.target.checked)} className="accent-[hsl(var(--primary))]" /> Show announcement bar</label>
          <Field label="Text" value={f.announcement?.text ?? ''} onChange={(v) => setIn('announcement', 'text', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type" value={f.announcement?.type ?? 'info'} onChange={(v) => setIn('announcement', 'type', v)} options={['info', 'success', 'warning'].map((x) => ({ label: x, value: x }))} />
            <Field label="Link (optional)" value={f.announcement?.link ?? ''} onChange={(v) => setIn('announcement', 'link', v)} />
          </div>
        </GlassCard>
      )}

      {tab === 'seo' && (
        <GlassCard className="space-y-4">
          <Field label="Meta title" value={f.seo?.title ?? ''} onChange={(v) => setIn('seo', 'title', v)} />
          <Textarea label="Meta description" value={f.seo?.description ?? ''} onChange={(v) => setIn('seo', 'description', v)} />
          <Field label="Keywords (comma-separated)" value={(f.seo?.keywords ?? []).join(', ')} onChange={(v) => setIn('seo', 'keywords', v.split(',').map((s) => s.trim()).filter(Boolean))} />
        </GlassCard>
      )}

      {tab === 'css' && (
        <GlassCard className="space-y-3">
          <Textarea label="Custom CSS (injected globally)" value={f.customCss ?? ''} onChange={(v) => set('customCss', v)} rows={12} />
          <p className="text-xs text-muted-foreground">Advanced: target classes/CSS variables. Applied site-wide after saving.</p>
        </GlassCard>
      )}
    </div>
  );
}

function AssetField({ label, url, onPick }: { label: string; url?: string; onPick: () => void }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-muted/50">
          {url ? <img src={`${API_ORIGIN}${url}`} alt={label} className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <Button size="sm" variant="glass" magnetic={false} onClick={onPick}><Upload className="h-4 w-4" /> Upload</Button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-input bg-transparent" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-32 rounded-xl border border-input bg-background/60 px-3 py-2.5 font-mono text-sm outline-none focus:border-primary" />
      </div>
    </label>
  );
}
