'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Save, RotateCcw, Eye, Send, History as HistoryIcon, LayoutTemplate } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { dateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { toast } from '@/components/ui/toast';

export default function EmailPage() {
  const [tab, setTab] = useState<'templates' | 'history'>('templates');
  return (
    <div className="space-y-8">
      <PageHeader title="Email" description="Professional branded templates, delivery history, and open tracking." />
      <div className="flex gap-2">
        {([['templates', 'Templates', LayoutTemplate], ['history', 'History', HistoryIcon]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn('flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition', tab === k ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'templates' ? <Templates /> : <History />}
    </div>
  );
}

function Templates() {
  const qc = useQueryClient();
  const { data: list } = useQuery({ queryKey: ['email-templates'], queryFn: adminApi.emailTemplates });
  const [key, setKey] = useState<string | null>(null);
  const { data: tpl } = useQuery({ queryKey: ['email-template', key], queryFn: () => adminApi.emailTemplate(key as string), enabled: !!key });

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState('');
  const [testTo, setTestTo] = useState('');

  useEffect(() => {
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body); setPreview(''); }
  }, [tpl]);

  const save = useMutation({
    mutationFn: () => adminApi.saveEmailTemplate(key as string, { subject, body, isActive: true }),
    onSuccess: () => { toast.success('Template saved'); qc.invalidateQueries({ queryKey: ['email-templates'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });
  const reset = useMutation({
    mutationFn: () => adminApi.resetEmailTemplate(key as string),
    onSuccess: () => { toast.success('Reverted to default'); qc.invalidateQueries({ queryKey: ['email-template', key] }); qc.invalidateQueries({ queryKey: ['email-templates'] }); },
  });
  const doPreview = useMutation({ mutationFn: () => adminApi.emailPreview(key as string), onSuccess: (d: any) => setPreview(d.html) });
  const test = useMutation({
    mutationFn: () => adminApi.emailTest(key as string, testTo),
    onSuccess: (d: any) => (d?.status === 'mocked' ? toast.info('SMTP not configured — logged, not delivered') : toast.success('Test email sent')),
    onError: () => toast.error('Test failed'),
  });

  const groups = (list ?? []).reduce((acc: Record<string, any[]>, t: any) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <GlassCard className="max-h-[600px] overflow-y-auto">
        {Object.entries(groups).map(([cat, tpls]) => (
          <div key={cat} className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
            <div className="space-y-1">
              {tpls.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setKey(t.key)}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition', key === t.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.isOverridden && <Badge tone="default">custom</Badge>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </GlassCard>

      <GlassCard>
        {!key && <p className="text-sm text-muted-foreground">Select a template to edit its subject and HTML body, preview it, or send a test.</p>}
        {key && tpl && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{tpl.name}</h2>
                <p className="text-xs text-muted-foreground">{tpl.category} · key <code className="text-accent">{tpl.key}</code></p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" magnetic={false} loading={reset.isPending} onClick={() => reset.mutate()}><RotateCcw className="h-4 w-4" /> Reset</Button>
                <Button size="sm" magnetic={false} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save</Button>
              </div>
            </div>

            <Field label="Subject" value={subject} onChange={setSubject} />
            <Textarea label="HTML body" value={body} onChange={setBody} rows={10} />

            <div>
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Available placeholders</span>
              <div className="flex flex-wrap gap-1.5">
                {(tpl.variables ?? []).map((v: string) => (
                  <code key={v} className="cursor-pointer rounded-md bg-muted px-2 py-0.5 text-xs text-foreground/80 transition hover:bg-primary/15 hover:text-primary" onClick={() => setBody((b) => `${b}{{${v}}}`)}>{`{{${v}}}`}</code>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button variant="glass" magnetic={false} loading={doPreview.isPending} onClick={() => doPreview.mutate()}><Eye className="h-4 w-4" /> Preview</Button>
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@email.com" className="h-9 w-48 rounded-xl border border-input bg-card/60 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
              <Button variant="glass" magnetic={false} loading={test.isPending} onClick={() => test.mutate()}><Send className="h-4 w-4" /> Send test</Button>
            </div>

            {preview && <iframe srcDoc={preview} title="Email preview" className="h-[520px] w-full rounded-xl border border-border bg-white" />}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function History() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: stats } = useQuery({ queryKey: ['email-stats'], queryFn: adminApi.emailStats });
  const { data, isLoading } = useQuery({ queryKey: ['email-logs', page], queryFn: () => adminApi.emailLogs({ page, limit: 12 }) });
  const resend = useMutation({
    mutationFn: (id: string) => adminApi.resendEmail(id),
    onSuccess: () => { toast.success('Email resent'); qc.invalidateQueries({ queryKey: ['email-logs'] }); },
    onError: () => toast.error('Resend failed'),
  });

  const columns: Column<any>[] = [
    { key: 'to', header: 'Recipient' },
    { key: 'subject', header: 'Subject', render: (r) => <span className="line-clamp-1">{r.subject}</span> },
    { key: 'templateKey', header: 'Template', render: (r) => <span className="text-xs text-muted-foreground">{titleCase(r.templateKey || '—')}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'openCount', header: 'Opens', render: (r) => <span className="tabular-nums">{r.openCount || 0}</span> },
    { key: 'createdAt', header: 'When', render: (r) => dateTime(r.createdAt) },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="ghost" magnetic={false} loading={resend.isPending && resend.variables === r._id} onClick={() => resend.mutate(r._id)}>Resend</Button> },
  ];

  const tiles = [['total', 'Total'], ['sent', 'Sent'], ['opened', 'Opened'], ['failed', 'Failed'], ['mocked', 'Logged']];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {tiles.map(([k, label]) => (
          <GlassCard key={k} className="py-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{k === 'total' ? stats?.total ?? 0 : stats?.byStatus?.[k] ?? 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </GlassCard>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        emptyText="No emails sent yet"
        rowKey={(r) => r._id}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />
    </div>
  );
}
