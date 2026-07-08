'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, DatabaseBackup, ShieldCheck, Activity, Mail, Trash2, Volume2, Play, ShieldAlert } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { dateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { playAudios } from '@/lib/voice';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const FEMALE_SPEAKERS = [
  { label: 'Anushka', value: 'anushka' },
  { label: 'Manisha', value: 'manisha' },
  { label: 'Vidya', value: 'vidya' },
  { label: 'Arya', value: 'arya' },
];
const MALE_SPEAKERS = [
  { label: 'Abhilash', value: 'abhilash' },
  { label: 'Karun', value: 'karun' },
  { label: 'Hitesh', value: 'hitesh' },
];

// Suggested keys per group so admins start from a sensible template.
const GROUP_TEMPLATES: Record<string, string[]> = {
  smtp: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password', 'smtp.from'],
  sms: ['sms.provider', 'sms.apiKey', 'sms.sender'],
  payment: ['payment.stripeKey', 'payment.stripeWebhookSecret', 'payment.razorpayKeyId', 'payment.razorpayKeySecret', 'payment.cashfreeAppId', 'payment.cashfreeSecretKey', 'payment.cashfreeEnv'],
  security: ['security.maxLoginAttempts', 'security.sessionTimeoutMinutes', 'security.enforce2faForAdmins'],
};
const GROUPS = Object.keys(GROUP_TEMPLATES);

export default function SystemPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="System" description="Platform configuration, integrations, security, and audit trail." />
      <GeneralSettings />
      <Health />
      <div className="grid gap-6 lg:grid-cols-2">
        <Backup />
        <TestEmail />
      </div>
      <VoiceSettings />
      <SpamProtection />
      <SettingsEditor />
      <AuditLogs />
    </div>
  );
}

const CAPTCHA_PROVIDERS = [
  { label: 'Off (no CAPTCHA)', value: 'none' },
  { label: 'Google reCAPTCHA v2 (checkbox)', value: 'recaptcha_v2' },
  { label: 'Google reCAPTCHA v3 (invisible score)', value: 'recaptcha_v3' },
  { label: 'hCaptcha', value: 'hcaptcha' },
];

function SpamProtection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['captcha-config'], queryFn: adminApi.captchaConfig });
  const [f, setF] = useState<Record<string, any>>({ enabled: false, provider: 'none', siteKey: '', secretKey: '', minScore: 0.5, forms: ['contact', 'newsletter'], secretKeySet: false });

  useEffect(() => {
    if (data) setF({ ...data, secretKey: '' });
  }, [data]);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const toggleForm = (name: string) =>
    setF((p) => {
      const forms: string[] = p.forms || [];
      return { ...p, forms: forms.includes(name) ? forms.filter((x) => x !== name) : [...forms, name] };
    });

  const save = useMutation({
    mutationFn: () =>
      adminApi.updateCaptcha({
        enabled: !!f.enabled,
        provider: f.provider,
        siteKey: f.siteKey,
        secretKey: f.secretKey || undefined, // omit when blank so the stored secret is kept
        minScore: Number(f.minScore) || 0.5,
        forms: f.forms,
      }),
    onSuccess: () => { toast.success('Spam protection saved'); qc.invalidateQueries({ queryKey: ['captcha-config'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const isRecaptcha = f.provider === 'recaptcha_v2' || f.provider === 'recaptcha_v3';
  const keysUrl = f.provider === 'hcaptcha' ? 'https://dashboard.hcaptcha.com' : 'https://www.google.com/recaptcha/admin';

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Spam protection (CAPTCHA)</h2>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!f.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Enabled
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Protect the public contact &amp; newsletter forms from bots. Add your CAPTCHA keys from{' '}
        <a href={keysUrl} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-4">{f.provider === 'hcaptcha' ? 'hCaptcha' : 'Google reCAPTCHA'} admin</a>.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Select label="Provider" value={f.provider ?? 'none'} onChange={(v) => set('provider', v)} options={CAPTCHA_PROVIDERS} />
        {f.provider === 'recaptcha_v3' && (
          <Field label="Min score (0–1, e.g. 0.5)" value={String(f.minScore ?? 0.5)} onChange={(v) => set('minScore', v)} />
        )}
        {f.provider !== 'none' && (
          <>
            <Field label="Site key (public)" value={f.siteKey ?? ''} onChange={(v) => set('siteKey', v)} placeholder={isRecaptcha ? '6Lc…' : '10000000-ffff-…'} autoComplete="off" />
            <Field label="Secret key" type="password" value={f.secretKey ?? ''} onChange={(v) => set('secretKey', v)} placeholder={f.secretKeySet ? '•••• (saved — leave blank to keep)' : 'Secret key'} autoComplete="off" />
          </>
        )}
      </div>

      {f.provider !== 'none' && (
        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Protect these forms</span>
          <div className="flex flex-wrap gap-4 text-sm">
            {['contact', 'newsletter'].map((name) => (
              <label key={name} className="flex items-center gap-2 capitalize">
                <input type="checkbox" checked={(f.forms || []).includes(name)} onChange={() => toggleForm(name)} className="accent-[hsl(var(--primary))]" /> {name}
              </label>
            ))}
          </div>
        </div>
      )}

      <Button className="mt-5" magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>
        <Save className="h-4 w-4" /> Save spam protection
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">The secret key is stored encrypted and shown masked. The site key is public and safe to display.</p>
    </GlassCard>
  );
}

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Dubai', 'Asia/Singapore'];
const CURRENCIES = [['USD', '$ US Dollar'], ['INR', '₹ Indian Rupee'], ['EUR', '€ Euro'], ['GBP', '£ Pound']];
const DATE_FORMATS = ['MMM D, YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

function GeneralSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings', 'general'], queryFn: () => adminApi.settingsGroup('general') });
  const [f, setF] = useState<Record<string, any>>({});

  useEffect(() => {
    const map: Record<string, any> = {
      appName: 'AIPL Hire', appUrl: 'https://aipl.online', tagline: 'AI-Powered Interview Platform',
      email: 'support@aipl.online', timezone: 'Asia/Kolkata', currency: 'INR', dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h', defaultLanguage: 'en', langEn: true, langHi: true, maintenance: false,
    };
    for (const s of data ?? []) {
      const key = s.key.replace('general.', '');
      map[key] = s.value;
    }
    setF(map);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      adminApi.updateSettingsGroup('general', Object.entries(f).map(([k, value]) => ({ key: `general.${k}`, value }))),
    onSuccess: () => { toast.success('General settings saved'); qc.invalidateQueries({ queryKey: ['settings', 'general'] }); },
    onError: () => toast.error('Save failed'),
  });

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  return (
    <GlassCard>
      <h2 className="text-lg font-semibold">General settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">Platform identity, locale, language, and format defaults.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="App name" value={f.appName ?? ''} onChange={(v) => set('appName', v)} />
        <Field label="App URL" value={f.appUrl ?? ''} onChange={(v) => set('appUrl', v)} />
        <Field label="Tagline" value={f.tagline ?? ''} onChange={(v) => set('tagline', v)} />
        <Field label="Support email" type="email" value={f.email ?? ''} onChange={(v) => set('email', v)} />
        <Select label="Default time zone" value={f.timezone ?? 'UTC'} onChange={(v) => set('timezone', v)} options={TIMEZONES.map((t) => ({ label: t, value: t }))} />
        <Select label="Default currency" value={f.currency ?? 'USD'} onChange={(v) => set('currency', v)} options={CURRENCIES.map(([v, l]) => ({ label: l, value: v }))} />
        <Select label="Date format" value={f.dateFormat ?? 'MMM D, YYYY'} onChange={(v) => set('dateFormat', v)} options={DATE_FORMATS.map((d) => ({ label: d, value: d }))} />
        <Select label="Time format" value={f.timeFormat ?? '12h'} onChange={(v) => set('timeFormat', v)} options={[{ label: '12-hour', value: '12h' }, { label: '24-hour', value: '24h' }]} />
        <Select label="Default language" value={f.defaultLanguage ?? 'en'} onChange={(v) => set('defaultLanguage', v)} options={[{ label: 'English', value: 'en' }, { label: 'हिन्दी (Hindi)', value: 'hi' }]} />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Interview languages enabled</span>
          <div className="flex items-center gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.langEn} onChange={(e) => set('langEn', e.target.checked)} className="accent-[hsl(var(--primary))]" /> English</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.langHi} onChange={(e) => set('langHi', e.target.checked)} className="accent-[hsl(var(--primary))]" /> हिन्दी (Hindi)</label>
          </div>
        </div>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!f.maintenance} onChange={(e) => set('maintenance', e.target.checked)} className="accent-[hsl(var(--primary))]" /> Enable maintenance mode
      </label>
      <Button className="mt-5" magnetic={false} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save general settings</Button>
    </GlassCard>
  );
}

function Health() {
  const { data } = useQuery({ queryKey: ['health'], queryFn: adminApi.health, refetchInterval: 15000 });
  return (
    <GlassCard className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">System health</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <HealthItem label="Database" value={data?.db} ok={data?.db === 'up'} />
        <HealthItem label="Cache" value={data?.redis} ok={data?.redis === 'up'} />
        <HealthItem label="Uptime" value={data ? `${Math.round((data.uptimeSeconds ?? 0) / 60)}m` : '—'} ok />
        <HealthItem label="Memory" value={data ? `${data.memory?.rssMb}MB` : '—'} ok />
      </div>
    </GlassCard>
  );
}

function HealthItem({ label, value, ok }: { label: string; value?: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold capitalize', ok ? 'text-accent' : 'text-destructive')}>{value ?? '—'}</p>
    </div>
  );
}

function Backup() {
  const run = useMutation({
    mutationFn: () => adminApi.runBackup(),
    onSuccess: () => toast.success('Backup requested'),
    onError: () => toast.error('Backup request failed'),
  });
  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <DatabaseBackup className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Backups</h2>
      </div>
      <p className="text-sm text-muted-foreground">Trigger a logical snapshot. Scheduled backups run via the ops job.</p>
      <Button className="mt-4" magnetic={false} loading={run.isPending} onClick={() => run.mutate()}>
        Request backup
      </Button>
    </GlassCard>
  );
}

function TestEmail() {
  const [to, setTo] = useState('');
  const send = useMutation({
    mutationFn: () => adminApi.testEmail(to.trim() || undefined),
    onSuccess: (r: any) => {
      if (r?.delivered) toast.success(`Test email sent to ${r.to}`);
      else if (r?.mocked)
        toast.info('SMTP is not configured — the email was logged on the server, not delivered. Add SMTP keys to send for real.');
      else toast.error(`Send failed${r?.error ? `: ${r.error}` : ''}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to send test email'),
  });
  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Test email</h2>
      </div>
      <p className="text-sm text-muted-foreground">Send a test message to verify your SMTP / email configuration.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@email.com (defaults to you)"
          className="h-10 flex-1 rounded-xl border border-input bg-card/60 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        <Button magnetic={false} loading={send.isPending} onClick={() => send.mutate()}>
          <Mail className="h-4 w-4" /> Send test
        </Button>
      </div>
    </GlassCard>
  );
}

function VoiceSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings', 'voice'], queryFn: () => adminApi.settingsGroup('voice') });
  const [f, setF] = useState<Record<string, string>>({});
  const [testLang, setTestLang] = useState<'en' | 'hi'>('hi');
  const [testGender, setTestGender] = useState<'female' | 'male'>('female');

  useEffect(() => {
    const map: Record<string, string> = {
      provider: 'sarvam', sarvamApiKey: '', model: 'bulbul:v2',
      speakerFemale: 'anushka', speakerMale: 'abhilash', pace: '0.95',
    };
    for (const s of data ?? []) {
      const key = s.key.replace('voice.', '');
      map[key] = typeof s.value === 'string' ? s.value : String(s.value ?? '');
    }
    setF(map);
  }, [data]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      adminApi.updateSettingsGroup(
        'voice',
        Object.entries(f)
          .filter(([, v]) => v !== '' && !String(v).includes('•'))
          .map(([k, value]) => ({ key: `voice.${k}`, value })),
      ),
    onSuccess: () => { toast.success('Voice settings saved'); qc.invalidateQueries({ queryKey: ['settings', 'voice'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const test = useMutation({
    mutationFn: () => adminApi.testVoice({ lang: testLang, gender: testGender }),
    onSuccess: async (r: any) => {
      if (r?.audios?.length) {
        toast.success('Playing voice sample…');
        await playAudios(r.audios, r.mime || 'audio/wav');
      } else if (r?.enabled === false) {
        toast.info('Sarvam voice is not configured — add your API key and Save first.');
      } else {
        toast.error('Voice generation failed — check the API key or server logs.');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Volume2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Voice &amp; TTS (Sarvam AI)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Natural Indian Hindi/English voice for the live AI interview. Leave the provider on “Browser” or the API key blank to use the built-in browser voice.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Select label="Provider" value={f.provider ?? 'sarvam'} onChange={(v) => set('provider', v)} options={[{ label: 'Sarvam AI (Indian voice)', value: 'sarvam' }, { label: 'Browser (built-in)', value: 'browser' }]} />
        <Field label="Sarvam API key" type="password" value={f.sarvamApiKey ?? ''} onChange={(v) => set('sarvamApiKey', v)} placeholder="•••• (hidden — leave blank to keep current)" autoComplete="off" />
        <Select label="Model" value={f.model ?? 'bulbul:v2'} onChange={(v) => set('model', v)} options={[{ label: 'bulbul:v2 (recommended)', value: 'bulbul:v2' }, { label: 'bulbul:v1', value: 'bulbul:v1' }]} />
        <Field label="Speaking pace (0.5–2)" value={f.pace ?? '0.95'} onChange={(v) => set('pace', v)} placeholder="0.95" />
        <Select label="Female voice" value={f.speakerFemale ?? 'anushka'} onChange={(v) => set('speakerFemale', v)} options={FEMALE_SPEAKERS} />
        <Select label="Male voice" value={f.speakerMale ?? 'abhilash'} onChange={(v) => set('speakerMale', v)} options={MALE_SPEAKERS} />
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Save voice settings
        </Button>
        <span className="hidden h-9 w-px self-center bg-border sm:block" aria-hidden />
        <div className="w-32"><Select label="Preview language" value={testLang} onChange={(v) => setTestLang(v as 'en' | 'hi')} options={[{ label: 'Hindi', value: 'hi' }, { label: 'English', value: 'en' }]} /></div>
        <div className="w-32"><Select label="Voice" value={testGender} onChange={(v) => setTestGender(v as 'female' | 'male')} options={[{ label: 'Female', value: 'female' }, { label: 'Male', value: 'male' }]} /></div>
        <Button variant="glass" magnetic={false} loading={test.isPending} onClick={() => test.mutate()}>
          <Play className="h-4 w-4" /> Preview voice
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        The API key is stored encrypted and shown masked. Get a key at{' '}
        <a href="https://dashboard.sarvam.ai" target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-4">dashboard.sarvam.ai</a>.
      </p>
    </GlassCard>
  );
}

function SettingsEditor() {
  const qc = useQueryClient();
  const [group, setGroup] = useState('smtp');
  const { data } = useQuery({ queryKey: ['settings', group], queryFn: () => adminApi.settingsGroup(group) });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const key of GROUP_TEMPLATES[group]) next[key] = '';
    for (const s of data ?? []) next[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value ?? '');
    setValues(next);
  }, [data, group]);

  const save = useMutation({
    mutationFn: () =>
      adminApi.updateSettingsGroup(
        group,
        Object.entries(values)
          .filter(([, v]) => v !== '' && !v.startsWith('••••'))
          .map(([key, value]) => ({ key, value })),
      ),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['settings', group] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Integrations & settings</h2>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm capitalize transition',
              group === g ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {GROUP_TEMPLATES[group].map((key) => (
          <Field
            key={key}
            label={titleCase(key.split('.')[1] ?? key)}
            value={values[key] ?? ''}
            onChange={(v) => setValues((p) => ({ ...p, [key]: v }))}
            placeholder={/secret|password|key/i.test(key) ? '•••• (hidden)' : ''}
          />
        ))}
      </div>
      <Button className="mt-5" magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>
        <Save className="h-4 w-4" /> Save {group}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">Secret values are stored encrypted and shown masked.</p>
    </GlassCard>
  );
}

function AuditLogs() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => adminApi.auditLogs({ page, limit: 12 }),
  });
  const clear = useMutation({
    mutationFn: () => adminApi.clearAuditLogs(),
    onSuccess: (r: any) => {
      toast.success(r?.message || 'Audit logs cleared');
      setPage(1);
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to clear logs'),
  });

  const columns: Column<any>[] = [
    { key: 'action', header: 'Action', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: 'actor', header: 'Actor', render: (r) => r.actor?.email ?? 'system' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'ip', header: 'IP', render: (r) => r.ip ?? '—' },
    { key: 'createdAt', header: 'When', render: (r) => dateTime(r.createdAt) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audit logs</h2>
        <Button
          size="sm"
          variant="ghost"
          magnetic={false}
          loading={clear.isPending}
          onClick={() => {
            if (window.confirm('Clear ALL audit logs? This cannot be undone. The clear action itself will be recorded.')) clear.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" /> Clear logs
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        emptyText="No audit events yet"
        rowKey={(r) => r._id}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />
    </div>
  );
}
