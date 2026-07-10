'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Save, Sliders, FileText, Coins, DollarSign, Activity, AlertTriangle, Plug, ArrowRight,
} from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { titleCase, number } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatTile } from '@/components/ui/StatTile';
import { AreaChart, BarList } from '@/components/ui/Charts';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

export default function AiManagementPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Management"
        description="Models, scoring weightage, prompt templates, and usage. Provider connections live on the AI Providers page."
        action={
          <Link href="/dashboard/ai-providers">
            <Button size="sm" variant="glass" magnetic={false}>
              <Plug className="h-4 w-4" /> Manage providers
            </Button>
          </Link>
        }
      />
      <UsageSummary />
      <ProvidersPointer />
      <div className="grid gap-6 lg:grid-cols-2">
        <Settings />
        <Weightage />
      </div>
      <Prompts />
    </div>
  );
}

/** Compact summary that links through to the dedicated AI Providers configurator. */
function ProvidersPointer() {
  const { data } = useQuery({ queryKey: ['ai-providers'], queryFn: adminApi.aiProviders });
  const providers: any[] = data?.providers ?? [];
  const total = providers.length;
  const active = providers.filter((p) => p.isActive).length;
  const def = providers.find((p) => p.isDefault);
  const issues = providers.filter((p) => p.health === 'down' || p.health === 'degraded').length;

  return (
    <GlassCard className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Plug className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">AI providers</h2>
          {issues > 0 && <Badge tone="danger">{issues} need attention</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? 'No providers configured — the built-in environment key is used. Add one to route or switch models.'
            : `${total} configured · ${active} active${def ? ` · default ${def.label}` : ' · no default set'}.`}
        </p>
      </div>
      <Link href="/dashboard/ai-providers" className="shrink-0">
        <Button variant="glass" magnetic={false}>
          Open AI Providers <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </GlassCard>
  );
}

function UsageSummary() {
  const { data, isLoading } = useQuery({ queryKey: ['ai-analytics'], queryFn: () => adminApi.aiAnalytics(30) });
  const t = data?.totals;
  const daily = (data?.daily ?? []).map((d: any) => ({ label: d._id, value: d.tokens }));
  const byFeature = (data?.byFeature ?? []).map((f: any) => ({ label: f._id, value: f.tokens, hint: number(f.tokens) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tokens (30d)" value={t?.tokens ?? 0} icon={Coins} color="violet" compact loading={isLoading} delay={0} />
        <StatTile label="Cost (30d)" value={Number((t?.cost ?? 0).toFixed(2))} icon={DollarSign} color="green" prefix="$" loading={isLoading} delay={0.05} />
        <StatTile label="API calls" value={t?.calls ?? 0} icon={Activity} color="blue" compact loading={isLoading} delay={0.1} />
        <StatTile label="Failures" value={t?.failures ?? 0} icon={AlertTriangle} color="orange" loading={isLoading} delay={0.15} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Token usage</h2>
            <span className="text-xs text-muted-foreground">last 30 days</span>
          </div>
          <AreaChart data={daily} />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 text-lg font-semibold">By feature</h2>
          <BarList data={byFeature} />
        </GlassCard>
      </div>
    </div>
  );
}

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ai-settings'], queryFn: adminApi.aiSettings });
  const [form, setForm] = useState({ model: '', modelFast: '', maxTokens: 4096, temperature: 0.4 });
  useEffect(() => {
    if (data) setForm({ model: data.model, modelFast: data.modelFast, maxTokens: data.maxTokens, temperature: data.temperature });
  }, [data]);

  const save = useMutation({
    mutationFn: () => adminApi.updateAiSettings({ ...form, maxTokens: Number(form.maxTokens), temperature: Number(form.temperature) }),
    onSuccess: () => {
      toast.success('AI settings saved');
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const test = useMutation({
    mutationFn: () => adminApi.testAi(),
    onSuccess: (res: any) => {
      if (res?.ok) toast.success(`Connection OK · ${res.model} · ${res.latencyMs}ms`);
      else toast.error(`Connection failed: ${res?.error || 'unknown'}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Model configuration</h2>
        {data && <Badge tone={data.enabled ? 'success' : 'danger'} className="ml-auto">{data.enabled ? 'connected' : 'no key'}</Badge>}
      </div>
      <div className="space-y-4">
        <Field label="Primary model" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} />
        <Field label="Fast model" value={form.modelFast} onChange={(v) => setForm((f) => ({ ...f, modelFast: v }))} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Max tokens" type="number" value={String(form.maxTokens)} onChange={(v) => setForm((f) => ({ ...f, maxTokens: Number(v) }))} />
          <Field label="Temperature" type="number" value={String(form.temperature)} onChange={(v) => setForm((f) => ({ ...f, temperature: Number(v) }))} />
        </div>
        <div className="flex gap-2">
          <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>
            <Save className="h-4 w-4" /> Save
          </Button>
          <Button variant="glass" magnetic={false} loading={test.isPending} onClick={() => test.mutate()}>
            Test connection
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function Weightage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ai-weightage'], queryFn: adminApi.aiWeightage });
  const [w, setW] = useState<Record<string, number>>({});
  useEffect(() => {
    if (data?.weightage) setW(data.weightage);
  }, [data]);

  const sum = Object.values(w).reduce((a, b) => a + Number(b || 0), 0);
  const balanced = Math.abs(sum - 1) <= 0.01;

  const save = useMutation({
    mutationFn: () => adminApi.updateAiWeightage(w),
    onSuccess: () => {
      toast.success('Weightage saved');
      qc.invalidateQueries({ queryKey: ['ai-weightage'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Sliders className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Scoring weightage</h2>
        <Badge tone={balanced ? 'success' : 'warning'} className="ml-auto">
          Σ {sum.toFixed(2)}
        </Badge>
      </div>
      <div className="space-y-3">
        {Object.entries(w).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-32 text-sm text-muted-foreground">{titleCase(k)}</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.025}
              value={v}
              onChange={(e) => setW((p) => ({ ...p, [k]: Number(e.target.value) }))}
              className="flex-1 accent-[hsl(var(--primary))]"
            />
            <span className="w-10 text-right text-sm tabular-nums">{Number(v).toFixed(2)}</span>
          </div>
        ))}
        <Button magnetic={false} disabled={!balanced} loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Save weightage
        </Button>
        {!balanced && <p className="text-xs text-yellow-400">Weights must sum to 1.00 to save.</p>}
      </div>
    </GlassCard>
  );
}

function Prompts() {
  const { data, isLoading } = useQuery({ queryKey: ['ai-prompts'], queryFn: adminApi.aiPrompts });
  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Prompt templates</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        {(data ?? []).map((p: any) => (
          <div key={p.key} className={cn('rounded-xl border p-4', p.isOverridden ? 'border-primary/40' : 'border-border')}>
            <div className="flex items-center justify-between">
              <p className="font-medium">{titleCase(p.key)}</p>
              <Badge tone={p.isOverridden ? 'default' : 'muted'}>{p.isOverridden ? 'custom' : 'default'}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{p.system}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Override editor (PUT <code className="text-accent">/admin/ai/prompts</code>) ships with the prompt-editing UI;
        templates currently resolve to the built-in versions in <code>services/ai/prompts</code>.
      </p>
    </GlassCard>
  );
}
