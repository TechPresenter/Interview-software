'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Save, Sliders, FileText, Plus, Trash2, Star, Plug } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { titleCase, number } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Coins, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatTile } from '@/components/ui/StatTile';
import { AreaChart, BarList } from '@/components/ui/Charts';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

export default function AiManagementPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="AI Management" description="Providers, models, scoring weightage, prompts, and usage." />
      <UsageSummary />
      <Providers />
      <div className="grid gap-6 lg:grid-cols-2">
        <Settings />
        <Weightage />
      </div>
      <Prompts />
    </div>
  );
}

const PROVIDER_TYPES = ['claude', 'gemini', 'openai', 'azure_openai', 'groq', 'openrouter', 'custom'];
const PROVIDER_COLORS: Record<string, string> = {
  claude: 'bg-[#d97757]',
  gemini: 'bg-[#4285f4]',
  openai: 'bg-[#10a37f]',
  azure_openai: 'bg-[#0078d4]',
  groq: 'bg-[#f55036]',
  openrouter: 'bg-[#6566f1]',
  custom: 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))]',
};

function Providers() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ai-providers'], queryFn: adminApi.aiProviders });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: '', type: 'claude', apiKey: '', model: '', baseUrl: '', isDefault: false });

  const create = useMutation({
    mutationFn: () => adminApi.createAiProvider({ ...form, apiKey: form.apiKey || undefined, model: form.model || undefined, baseUrl: form.baseUrl || undefined }),
    onSuccess: () => { toast.success('Provider added'); setOpen(false); setForm({ label: '', type: 'claude', apiKey: '', model: '', baseUrl: '', isDefault: false }); qc.invalidateQueries({ queryKey: ['ai-providers'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const setDefault = useMutation({ mutationFn: (id: string) => adminApi.setDefaultAiProvider(id), onSuccess: () => { toast.success('Default updated'); qc.invalidateQueries({ queryKey: ['ai-providers'] }); } });
  const del = useMutation({ mutationFn: (id: string) => adminApi.deleteAiProvider(id), onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['ai-providers'] }); } });

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Plug className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI providers</h2>
        <Button size="sm" magnetic={false} className="ml-auto" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add provider</Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Configure and switch between providers. Claude is live-wired; others store config and activate as adapters are added.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        {(data ?? []).map((p: any) => (
          <div
            key={p._id}
            className={cn(
              'group flex flex-col rounded-2xl border bg-card/40 p-5 transition-all hover:shadow-glow',
              p.isDefault ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border',
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white', PROVIDER_COLORS[p.type] || 'bg-muted')}>
                {p.label?.[0]?.toUpperCase() || 'A'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{p.label}</p>
                  {p.isDefault && <Badge tone="success">Default</Badge>}
                </div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.type.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Model</span><span className="font-mono text-foreground/80">{p.model || '—'}</span></div>
              <div className="flex justify-between"><span>API key</span><Badge tone={p.hasKey ? 'success' : 'warning'}>{p.hasKey ? 'set' : 'missing'}</Badge></div>
              <div className="flex justify-between"><span>Status</span><Badge tone={p.isActive ? 'default' : 'muted'}>{p.isActive ? 'active' : 'off'}</Badge></div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
              {!p.isDefault && (
                <Button size="sm" variant="glass" magnetic={false} onClick={() => setDefault.mutate(p._id)}>
                  <Star className="h-3.5 w-3.5" /> Make default
                </Button>
              )}
              <button onClick={() => del.mutate(p._id)} title="Remove" className="ml-auto rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No providers configured. The built-in Claude key from your environment is used by default — add one to switch or manage providers.
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add AI provider" footer={<><Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button><Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="Claude (Production)" />
          <Select label="Type" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={PROVIDER_TYPES.map((t) => ({ label: t.replace('_', ' ').toUpperCase(), value: t }))} />
          <Field label="API key" type="password" value={form.apiKey} onChange={(v) => setForm((f) => ({ ...f, apiKey: v }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Model" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} placeholder="claude-opus-4-8" />
            <Field label="Base URL (custom/azure)" value={form.baseUrl} onChange={(v) => setForm((f) => ({ ...f, baseUrl: v }))} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="accent-[hsl(var(--primary))]" /> Set as default provider</label>
        </div>
      </Modal>
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
      if (res?.ok) toast.success(`Claude OK · ${res.model} · ${res.latencyMs}ms`);
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
