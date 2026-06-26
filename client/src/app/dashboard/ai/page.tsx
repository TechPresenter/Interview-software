'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Save, Sliders, FileText, Plus, Trash2, Star, Plug, Pencil, Power, Zap,
  Download, Upload, Coins, DollarSign, Activity, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { titleCase, number, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
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
      <PageHeader title="AI Management" description="Providers, routing, models, scoring weightage, prompts, and usage." />
      <UsageSummary />
      <Providers />
      <ProviderMonitoring />
      <div className="grid gap-6 lg:grid-cols-2">
        <Settings />
        <Weightage />
      </div>
      <Prompts />
    </div>
  );
}

const PROVIDER_TYPES = ['claude', 'openai', 'gemini', 'grok', 'deepseek', 'mistral', 'azure_openai', 'groq', 'openrouter', 'custom'];
const PROVIDER_COLORS: Record<string, string> = {
  claude: 'bg-[#d97757]',
  openai: 'bg-[#10a37f]',
  gemini: 'bg-[#4285f4]',
  grok: 'bg-[#111827]',
  deepseek: 'bg-[#4d6bfe]',
  mistral: 'bg-[#fa520f]',
  azure_openai: 'bg-[#0078d4]',
  groq: 'bg-[#f55036]',
  openrouter: 'bg-[#6566f1]',
  custom: 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))]',
};
const healthTone = (h?: string): any =>
  h === 'healthy' ? 'success' : h === 'down' ? 'danger' : h === 'degraded' ? 'warning' : 'muted';

const emptyForm = {
  label: '', type: 'openai', apiKey: '', model: '', baseUrl: '', apiVersion: '', organization: '', projectId: '',
  timeoutMs: 30000, maxRetries: 2, rateLimitPerMin: '', priority: 100, modules: [] as string[], isDefault: false, isActive: true,
};

function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Providers() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ai-providers'], queryFn: adminApi.aiProviders });
  const providers: any[] = data?.providers ?? [];
  const catalog: any[] = data?.catalog ?? [];
  const modules: string[] = data?.modules ?? ['chat', 'content', 'image', 'embeddings', 'interview', 'scoring', 'report', 'resume'];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [testResult, setTestResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const defaultModel = catalog.find((c) => c.type === form.type)?.defaultModel || '';

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-providers'] });
    qc.invalidateQueries({ queryKey: ['ai-provider-analytics'] });
  };

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setTestResult(null);
    setOpen(true);
  }
  function openEdit(p: any) {
    setEditing(p);
    setForm({
      label: p.label, type: p.type, apiKey: '', model: p.model || '', baseUrl: p.baseUrl || '', apiVersion: p.apiVersion || '',
      organization: p.organization || '', projectId: p.projectId || '', timeoutMs: p.timeoutMs ?? 30000, maxRetries: p.maxRetries ?? 2,
      rateLimitPerMin: p.rateLimitPerMin ?? '', priority: p.priority ?? 100, modules: p.modules || [], isDefault: !!p.isDefault, isActive: p.isActive !== false,
    });
    setTestResult(null);
    setOpen(true);
  }

  const payload = () => ({
    label: form.label,
    type: form.type,
    apiKey: form.apiKey || undefined,
    model: form.model || undefined,
    baseUrl: form.baseUrl || undefined,
    apiVersion: form.apiVersion || undefined,
    organization: form.organization || undefined,
    projectId: form.projectId || undefined,
    timeoutMs: Number(form.timeoutMs) || undefined,
    maxRetries: Number(form.maxRetries) || 0,
    rateLimitPerMin: form.rateLimitPerMin ? Number(form.rateLimitPerMin) : undefined,
    priority: Number(form.priority) || 100,
    modules: form.modules,
    isDefault: form.isDefault,
    isActive: form.isActive,
  });

  const save = useMutation({
    mutationFn: () => (editing ? adminApi.updateAiProvider(editing._id, payload()) : adminApi.createAiProvider(payload())),
    onSuccess: () => { toast.success(editing ? 'Provider updated' : 'Provider added'); setOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  });
  const testForm = useMutation({
    mutationFn: () => adminApi.testAiProvider({ ...payload(), id: editing?._id }),
    onSuccess: (r: any) => { setTestResult(r); r.ok ? toast.success(`Connected · ${r.model} · ${r.latencyMs}ms`) : toast.error(r.error || 'Connection failed'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });
  const setDefault = useMutation({ mutationFn: (id: string) => adminApi.setDefaultAiProvider(id), onSuccess: () => { toast.success('Default provider set'); invalidate(); } });
  const toggle = useMutation({ mutationFn: (p: any) => adminApi.updateAiProvider(p._id, { isActive: !p.isActive }), onSuccess: () => invalidate() });
  const del = useMutation({ mutationFn: (id: string) => adminApi.deleteAiProvider(id), onSuccess: () => { toast.success('Provider removed'); invalidate(); } });
  const testOne = useMutation({
    mutationFn: (id: string) => adminApi.testAiProviderById(id),
    onSuccess: (r: any) => { r.ok ? toast.success(`Connected · ${r.latencyMs}ms`) : toast.error(r.error || 'Connection failed'); invalidate(); },
    onError: () => toast.error('Test failed'),
  });
  const exportM = useMutation({
    mutationFn: () => adminApi.exportAiProviders(),
    onSuccess: (d: any) => { downloadJson(d, `ai-providers-backup-${new Date().toISOString().slice(0, 10)}.json`); toast.success('Backup downloaded'); },
    onError: () => toast.error('Export failed'),
  });
  const importM = useMutation({
    mutationFn: (list: any[]) => adminApi.importAiProviders(list),
    onSuccess: (r: any) => { toast.success(r?.message || 'Providers restored'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Import failed'),
  });

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const list = json.providers || json;
      if (!Array.isArray(list)) throw new Error('bad shape');
      importM.mutate(list);
    } catch {
      toast.error('Invalid backup file');
    }
  }

  const typeOptions = (catalog.length ? catalog.map((c) => ({ label: `${c.label} (${c.type})`, value: c.type })) : PROVIDER_TYPES.map((t) => ({ label: t, value: t })));

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Plug className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI providers</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportFile} />
          <Button size="sm" variant="glass" magnetic={false} loading={exportM.isPending} onClick={() => exportM.mutate()}><Download className="h-4 w-4" /> Backup</Button>
          <Button size="sm" variant="glass" magnetic={false} loading={importM.isPending} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Restore</Button>
          <Button size="sm" magnetic={false} onClick={openCreate}><Plus className="h-4 w-4" /> Add provider</Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Configure, route, and switch between providers without code changes. API keys are encrypted at rest. The default provider (and any explicitly assigned to a module) is used at request time, with automatic failover in priority order.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
        {providers.map((p) => (
          <div
            key={p._id}
            className={cn(
              'group flex flex-col rounded-2xl border bg-card/40 p-5 transition-all hover:shadow-glow',
              p.isDefault ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border',
              !p.isActive && 'opacity-60',
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white', PROVIDER_COLORS[p.type] || 'bg-muted')}>
                {p.label?.[0]?.toUpperCase() || 'A'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-semibold">{p.label}</p>
                  {p.isDefault && <Badge tone="success">Default</Badge>}
                  <Badge tone={healthTone(p.health)}>{p.health || 'unknown'}</Badge>
                </div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{String(p.type).replace('_', ' ')}</p>
              </div>
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Model</span><span className="font-mono text-foreground/80">{p.model || defaultLabel(catalog, p.type)}</span></div>
              <div className="flex justify-between"><span>API key</span><Badge tone={p.hasKey ? 'success' : 'warning'}>{p.hasKey ? 'set' : 'missing'}</Badge></div>
              <div className="flex justify-between"><span>Priority</span><span className="tabular-nums text-foreground/80">{p.priority ?? 100}</span></div>
              <div className="flex justify-between"><span>Status</span><Badge tone={p.isActive ? 'default' : 'muted'}>{p.isActive ? 'active' : 'disabled'}</Badge></div>
              {p.lastSuccessAt && <div className="flex justify-between"><span>Last OK</span><span>{relativeTime(p.lastSuccessAt)}</span></div>}
              {p.health === 'down' && p.lastError && <p className="truncate text-destructive" title={p.lastError}>⚠ {p.lastError}</p>}
            </div>

            {(p.modules?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {p.modules.map((m: string) => <span key={m} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{m}</span>)}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <Button size="sm" variant="glass" magnetic={false} loading={testOne.isPending && testOne.variables === p._id} onClick={() => testOne.mutate(p._id)}><Zap className="h-3.5 w-3.5" /> Test</Button>
              {!p.isDefault && <Button size="sm" variant="ghost" magnetic={false} onClick={() => setDefault.mutate(p._id)}><Star className="h-3.5 w-3.5" /> Default</Button>}
              <button onClick={() => openEdit(p)} title="Edit" className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => toggle.mutate(p)} title={p.isActive ? 'Disable' : 'Enable'} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"><Power className="h-4 w-4" /></button>
              <button onClick={() => { if (window.confirm(`Delete provider "${p.label}"?`)) del.mutate(p._id); }} title="Remove" className="ml-auto rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {!isLoading && providers.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No providers configured. The built-in Claude key from your environment is used by default — add a provider to switch or route per module.
          </div>
        )}
      </div>

      {/* Module routing overview */}
      {providers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">Module routing</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => {
              const serving = providers.filter((p) => p.isActive && (p.isDefault || (p.modules || []).includes(m)));
              return (
                <div key={m} className="rounded-xl bg-card/40 p-3">
                  <p className="text-xs font-medium capitalize">{m}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {serving.length === 0 && <span className="text-[11px] text-muted-foreground">— built-in default</span>}
                    {serving.map((s) => <span key={s._id} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{s.label}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit AI provider' : 'Add AI provider'}
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="glass" magnetic={false} loading={testForm.isPending} onClick={() => testForm.mutate()}><Zap className="h-4 w-4" /> Test connection</Button>
            <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Label" value={form.label} onChange={(v) => set('label', v)} placeholder="OpenAI (Production)" />
            <Select label="Type" value={form.type} onChange={(v) => set('type', v)} options={typeOptions} />
          </div>
          <Field label="API key" type="password" value={form.apiKey} onChange={(v) => set('apiKey', v)} placeholder={editing ? 'Leave blank to keep current key' : 'sk-…'} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Model" value={form.model} onChange={(v) => set('model', v)} placeholder={defaultModel || 'model name'} />
            <Field label="Base URL / endpoint" value={form.baseUrl} onChange={(v) => set('baseUrl', v)} placeholder="optional (proxy / Azure / custom)" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="API version" value={form.apiVersion} onChange={(v) => set('apiVersion', v)} placeholder="Azure/Anthropic" />
            <Field label="Organization" value={form.organization} onChange={(v) => set('organization', v)} placeholder="OpenAI org" />
            <Field label="Project ID" value={form.projectId} onChange={(v) => set('projectId', v)} placeholder="optional" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Field label="Timeout (ms)" type="number" value={String(form.timeoutMs)} onChange={(v) => set('timeoutMs', v)} />
            <Field label="Retries" type="number" value={String(form.maxRetries)} onChange={(v) => set('maxRetries', v)} />
            <Field label="Rate/min" type="number" value={String(form.rateLimitPerMin)} onChange={(v) => set('rateLimitPerMin', v)} />
            <Field label="Priority" type="number" value={String(form.priority)} onChange={(v) => set('priority', v)} />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Modules served (failover candidates)</span>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              {modules.map((m) => (
                <label key={m} className="flex items-center gap-1.5 capitalize">
                  <input
                    type="checkbox"
                    checked={form.modules.includes(m)}
                    onChange={(e) => set('modules', e.target.checked ? [...form.modules, m] : form.modules.filter((x: string) => x !== m))}
                    className="accent-[hsl(var(--primary))]"
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="accent-[hsl(var(--primary))]" /> Set as default</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="accent-[hsl(var(--primary))]" /> Active</label>
          </div>

          {testResult && (
            <div className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm', testResult.ok ? 'border-accent/40 text-accent' : 'border-destructive/40 text-destructive')}>
              {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{testResult.ok ? `Connected in ${testResult.latencyMs}ms · ${testResult.model} · "${testResult.sample}"` : `Failed: ${testResult.error}`}</span>
            </div>
          )}
        </div>
      </Modal>
    </GlassCard>
  );
}

function defaultLabel(catalog: any[], type: string) {
  return catalog.find((c) => c.type === type)?.defaultModel || '—';
}

function ProviderMonitoring() {
  const { data, isLoading } = useQuery({ queryKey: ['ai-provider-analytics'], queryFn: () => adminApi.aiProviderAnalytics(30), refetchInterval: 30000 });
  const rows: any[] = data?.byProvider ?? [];
  const daily = (data?.daily ?? []).map((d: any) => ({ label: d.label, value: d.value }));
  const errors: any[] = data?.errors ?? [];

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Provider monitoring</h2>
        <span className="ml-auto text-xs text-muted-foreground">last 30 days · auto-refresh</span>
      </div>

      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No per-provider usage yet. Metrics appear here once a configured provider serves a request.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Health</th>
                <th className="py-2 pr-3 text-right font-medium">Calls</th>
                <th className="py-2 pr-3 text-right font-medium">Fails</th>
                <th className="py-2 pr-3 text-right font-medium">Tokens</th>
                <th className="py-2 pr-3 text-right font-medium">Cost</th>
                <th className="py-2 pr-3 text-right font-medium">Avg ms</th>
                <th className="py-2 text-right font-medium">Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{r.provider}</span>
                    <span className="ml-1.5 text-[11px] uppercase text-muted-foreground">{String(r.type || '').replace('_', ' ')}</span>
                  </td>
                  <td className="py-2 pr-3"><Badge tone={healthTone(r.health)}>{r.health}</Badge></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{number(r.calls)}</td>
                  <td className={cn('py-2 pr-3 text-right tabular-nums', r.failures > 0 && 'text-destructive')}>{number(r.failures)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{number(r.tokens)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">${(r.cost ?? 0).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.avgLatencyMs}</td>
                  <td className="py-2 text-right text-muted-foreground">{r.lastAt ? relativeTime(r.lastAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-2 text-sm font-medium">Token usage</p>
          <AreaChart data={daily} />
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-yellow-400" /> Recent failures</p>
          <div className="space-y-2 text-xs">
            {errors.length === 0 && <p className="text-muted-foreground">No failed requests. 🎉</p>}
            {errors.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5">
                <span className="truncate">{e.provider} · <span className="text-muted-foreground">{e.feature}</span></span>
                <span className="shrink-0 text-muted-foreground">{relativeTime(e.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
