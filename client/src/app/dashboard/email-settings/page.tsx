'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Save, Send, RefreshCw, Server, Plug, CheckCircle2, AlertTriangle } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { dateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

export default function EmailSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['email-config'], queryFn: companyApi.emailConfig });
  const { data: logs } = useQuery({ queryKey: ['email-logs'], queryFn: () => companyApi.emailLogs({ limit: 15 }) });

  const [f, setF] = useState<Record<string, any>>({});
  const [pass, setPass] = useState('');
  const [testTo, setTestTo] = useState('');

  useEffect(() => { if (data) setF(data); }, [data]);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  // Handle the Gmail OAuth redirect result (?gmail=connected|error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('gmail');
    if (!status) return;
    if (status === 'connected') toast.success(`Gmail connected${params.get('email') ? `: ${params.get('email')}` : ''}`);
    else if (status === 'error') toast.error(`Gmail connection failed${params.get('reason') ? ` (${params.get('reason')})` : ''}`);
    qc.invalidateQueries({ queryKey: ['email-config'] });
    window.history.replaceState({}, '', '/dashboard/email-settings');
  }, [qc]);

  const save = useMutation({
    mutationFn: () => companyApi.updateEmailConfig({ ...f, pass: pass || undefined }),
    onSuccess: () => { toast.success('Email settings saved'); setPass(''); qc.invalidateQueries({ queryKey: ['email-config'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const test = useMutation({
    mutationFn: () => companyApi.testEmailConfig(testTo.trim() || undefined),
    onSuccess: (r: any) => {
      if (r?.delivered) toast.success(`Test email sent to ${r.to}`);
      else if (r?.mocked) toast.info(r?.message || 'No SMTP configured yet.');
      else toast.error(r?.message || 'Send failed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  const retry = useMutation({
    mutationFn: (id: string) => companyApi.retryEmail(id),
    onSuccess: () => { toast.success('Retry queued'); qc.invalidateQueries({ queryKey: ['email-logs'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Retry failed'),
  });

  const connectGmail = useMutation({
    mutationFn: () => companyApi.gmailAuthorizeUrl(),
    onSuccess: (r: any) => { if (r?.url) window.location.href = r.url; },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not start Gmail connection'),
  });

  const disconnectGmail = useMutation({
    mutationFn: () => companyApi.disconnectGmail(),
    onSuccess: () => { toast.success('Gmail disconnected'); qc.invalidateQueries({ queryKey: ['email-config'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Disconnect failed'),
  });

  const gmail = f.gmail || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Email settings" description="Connect Gmail or your own SMTP — all outgoing email is sent from your account." />

      {/* Connect Gmail (OAuth 2.0) */}
      <GlassCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                Gmail
                {gmail.connected && <Badge tone="success">Connected</Badge>}
              </h2>
              {gmail.connected ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Sending as <span className="font-medium text-foreground">{gmail.email}</span> — used for all outgoing email.
                </p>
              ) : gmail.available ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Authenticate with Google to send email on behalf of your Gmail account (secure OAuth 2.0).
                </p>
              ) : (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-yellow-500">
                  <AlertTriangle className="h-4 w-4" /> Gmail integration isn’t configured on the server yet.
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {gmail.connected ? (
              <>
                <Button variant="glass" magnetic={false} loading={connectGmail.isPending} onClick={() => connectGmail.mutate()}>
                  <RefreshCw className="h-4 w-4" /> Reconnect
                </Button>
                <Button variant="ghost" magnetic={false} loading={disconnectGmail.isPending} onClick={() => disconnectGmail.mutate()}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button magnetic={false} disabled={!gmail.available} loading={connectGmail.isPending} onClick={() => connectGmail.mutate()}>
                <CheckCircle2 className="h-4 w-4" /> Connect Gmail
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">SMTP configuration</h2>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Use my company SMTP
          </label>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          When enabled, all emails to your candidates and team are sent from your server. Leave off to use the platform default.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SMTP host" value={f.host ?? ''} onChange={(v) => set('host', v)} placeholder="smtp.yourdomain.com" />
          <Field label="Port" type="number" value={String(f.port ?? 587)} onChange={(v) => set('port', Number(v) || 587)} placeholder="587" />
          <Select label="Encryption" value={f.secure ? 'ssl' : 'tls'} onChange={(v) => set('secure', v === 'ssl')} options={[{ label: 'TLS / STARTTLS (587)', value: 'tls' }, { label: 'SSL (465)', value: 'ssl' }]} />
          <Field label="Username" value={f.user ?? ''} onChange={(v) => set('user', v)} placeholder="apikey / user@domain" autoComplete="off" />
          <Field label="Password" type="password" value={pass} onChange={setPass} placeholder={f.passSet ? '•••• (leave blank to keep)' : 'SMTP password'} autoComplete="off" />
          <div />
          <Field label="Sender name" value={f.fromName ?? ''} onChange={(v) => set('fromName', v)} placeholder="Acme Talent" />
          <Field label="Sender email" type="email" value={f.fromEmail ?? ''} onChange={(v) => set('fromEmail', v)} placeholder="careers@yourdomain.com" />
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Email signature (HTML allowed)</span>
          <textarea
            value={f.signature ?? ''}
            onChange={(e) => set('signature', e.target.value)}
            rows={3}
            placeholder="— The Acme Talent Team"
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save settings</Button>
          <span className="hidden h-9 w-px self-center bg-border sm:block" aria-hidden />
          <div className="w-56"><Field label="Test recipient" type="email" value={testTo} onChange={setTestTo} placeholder="you@email.com (defaults to you)" /></div>
          <Button variant="glass" magnetic={false} loading={test.isPending} onClick={() => test.mutate()}><Send className="h-4 w-4" /> Send test</Button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Email logs</h2>
        </div>
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-3">To</th>
              <th className="pb-3">Subject</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Sent</th>
              <th className="pb-3 text-right">Retry</th>
            </tr>
          </thead>
          <tbody>
            {(logs?.items ?? []).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No emails sent yet.</td></tr>}
            {(logs?.items ?? []).map((l: any) => (
              <tr key={l._id} className="border-b border-border/50 last:border-0">
                <td className="py-3">{l.to}</td>
                <td className="py-3 max-w-[240px] truncate">{l.subject}</td>
                <td className="py-3"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                <td className="py-3 text-muted-foreground">{dateTime(l.sentAt || l.createdAt)}</td>
                <td className="py-3 text-right">
                  {['failed', 'mocked'].includes(l.status) && l.templateKey && (
                    <button onClick={() => retry.mutate(l._id)} title="Retry" className="text-primary hover:text-primary/80">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
