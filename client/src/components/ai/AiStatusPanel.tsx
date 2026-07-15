'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle, AlertTriangle, Plug, Zap } from 'lucide-react';
import { aiStatusApi, STATE_LABELS, STATE_TONES, type ConnectionTest } from '@/lib/prompts.api';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

/**
 * What the AI stack is actually configured with, and whether it works.
 *
 * Exists because "AI is not configured" used to be a lie: the flag behind it only
 * asked whether ANTHROPIC_API_KEY was set, so a working OpenAI provider read as
 * unconfigured with nothing on screen to explain why. This answers the whole
 * question — key, base URL, provider, model, env, database — in one place.
 */
export function AiStatusPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ai-status'], queryFn: aiStatusApi.status });
  const [results, setResults] = useState<Record<string, ConnectionTest>>({});

  const testOne = useMutation({
    mutationFn: (id: string) => aiStatusApi.test({ id }),
    onSuccess: (r, id) => {
      setResults((s) => ({ ...s, [id]: r }));
      (r.ok ? toast.success : toast.error)(r.message || STATE_LABELS[r.status] || 'Tested');
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  const testAll = useMutation({
    mutationFn: () => aiStatusApi.testAll(),
    onSuccess: (r) => {
      setResults(Object.fromEntries((r.results ?? []).map((x) => [x.id, x])));
      const ok = (r.results ?? []).filter((x) => x.ok).length;
      toast.success(`${ok} of ${r.results?.length ?? 0} providers responded`);
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  if (isLoading) return <GlassCard><div className="skeleton h-40 rounded-xl" /></GlassCard>;

  const configured = data?.configured;

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI connection</h2>
        {configured
          ? <Badge tone="success"><CheckCircle2 className="mr-1 inline h-3 w-3" />Configured</Badge>
          : <Badge tone="danger"><XCircle className="mr-1 inline h-3 w-3" />Not configured</Badge>}
        {data?.providers.length ? (
          <Button size="sm" variant="ghost" magnetic={false} className="ml-auto" loading={testAll.isPending} onClick={() => testAll.mutate()}>
            <Zap className="h-4 w-4" /> Test all
          </Button>
        ) : null}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Fact label="Serving from" value={data?.source === 'provider' ? 'Configured provider' : data?.source === 'env' ? 'Environment key' : 'Nothing'} />
        <Fact label="Default model" value={data?.defaultModel || '—'} />
        <Fact
          label="Environment keys"
          value={[
            data?.envKeyPresent ? `Anthropic ····${data.envKeyLast4}` : null,
            data?.envOpenAiPresent ? `OpenAI ····${data.envOpenAiLast4}` : null,
          ].filter(Boolean).join(' · ') || 'None set'}
        />
      </div>

      {(data?.issues ?? []).map((issue) => (
        <p key={issue.code} className={`mb-2 flex items-start gap-1.5 text-xs ${issue.level === 'error' ? 'text-destructive' : 'text-yellow-500'}`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{issue.message}</span>
        </p>
      ))}

      {!data?.providers.length && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          No providers registered. Add one on the <strong>AI Providers</strong> page, or set
          {' '}<code className="text-accent">ANTHROPIC_API_KEY</code> / <code className="text-accent">OPENAI_API_KEY</code>{' '}
          in the server environment.
        </p>
      )}

      <div className="space-y-2">
        {(data?.providers ?? []).map((p) => {
          const r = results[p.id];
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <Plug className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium">{p.name}</p>
                  <Badge tone="muted">{p.type}</Badge>
                  {p.isDefault && <Badge tone="default">default</Badge>}
                  {p.isEnv && <Badge tone="muted">from env</Badge>}
                  {!p.isActive && <Badge tone="muted">inactive</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.model || '(default model)'}
                  {p.baseUrl ? ` · ${p.baseUrl}` : ''}
                  {p.hasKey ? ` · key ····${p.keyLast4}` : ' · no usable key'}
                  {p.modules.length ? ` · ${p.modules.join(', ')}` : ''}
                </p>
                {p.lastError && <p className="mt-0.5 truncate text-xs text-destructive" title={p.lastError}>{p.lastError}</p>}
              </div>
              {r && <Badge tone={STATE_TONES[r.status] ?? 'muted'}>{STATE_LABELS[r.status] ?? r.status}{r.latencyMs != null ? ` · ${r.latencyMs}ms` : ''}</Badge>}
              {!p.isEnv && (
                <Button size="sm" variant="ghost" magnetic={false} loading={testOne.isPending && testOne.variables === p.id} onClick={() => testOne.mutate(p.id)}>
                  Test
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium" title={value}>{value}</p>
    </div>
  );
}
