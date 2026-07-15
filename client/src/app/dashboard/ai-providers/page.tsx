'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plug, Plus, Save, RotateCcw, Trash2, Star, Zap, KeyRound, CheckCircle2, XCircle,
  Link2, SlidersHorizontal, Cpu, Search, AlertTriangle, Activity, Download, Upload,
  Server, Power, ShieldCheck, Sparkles, ChevronRight, Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { number, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatTile } from '@/components/ui/StatTile';
import { AreaChart } from '@/components/ui/Charts';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

/* -------------------------------------------------------------------------- */
/*  Static provider catalogue (brand colour + hints for a richer UI).         */
/* -------------------------------------------------------------------------- */

const PROVIDER_META: Record<string, { label: string; color: string; hint: string; keyPrefix?: string }> = {
  claude: { label: 'Anthropic Claude', color: 'bg-[#d97757]', hint: 'Claude 3.5 / 4 family', keyPrefix: 'sk-ant-' },
  openai: { label: 'OpenAI', color: 'bg-[#10a37f]', hint: 'GPT-4o / o-series', keyPrefix: 'sk-' },
  gemini: { label: 'Google Gemini', color: 'bg-[#4285f4]', hint: 'Gemini 1.5 / 2.0' },
  grok: { label: 'xAI Grok', color: 'bg-[#111827]', hint: 'Grok models', keyPrefix: 'xai-' },
  deepseek: { label: 'DeepSeek', color: 'bg-[#4d6bfe]', hint: 'DeepSeek V2 / R1', keyPrefix: 'sk-' },
  mistral: { label: 'Mistral AI', color: 'bg-[#fa520f]', hint: 'Mistral / Mixtral' },
  azure_openai: { label: 'Azure OpenAI', color: 'bg-[#0078d4]', hint: 'Azure-hosted OpenAI' },
  groq: { label: 'Groq', color: 'bg-[#f55036]', hint: 'Ultra-fast inference', keyPrefix: 'gsk_' },
  openrouter: { label: 'OpenRouter', color: 'bg-[#6566f1]', hint: 'Multi-model router', keyPrefix: 'sk-or-' },
  custom: { label: 'Custom / self-hosted', color: 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))]', hint: 'OpenAI-compatible endpoint' },
};
const PROVIDER_TYPES = Object.keys(PROVIDER_META);

const meta = (type: string) => PROVIDER_META[type] || PROVIDER_META.custom;
const healthTone = (h?: string): any =>
  h === 'healthy' ? 'success' : h === 'down' ? 'danger' : h === 'degraded' ? 'warning' : 'muted';

const emptyForm = {
  label: '', type: 'openai', apiKey: '', model: '', baseUrl: '', apiVersion: '', organization: '', projectId: '',
  timeoutMs: 30000, maxRetries: 2, rateLimitPerMin: '', rateLimitPerDay: '', priority: 100,
  modules: [] as string[], isActive: true, isDefault: false, notes: '',
};

const formFromProvider = (p: any) => ({
  label: p.label ?? '', type: p.type ?? 'openai', apiKey: '', model: p.model ?? '', baseUrl: p.baseUrl ?? '',
  apiVersion: p.apiVersion ?? '', organization: p.organization ?? '', projectId: p.projectId ?? '',
  timeoutMs: p.timeoutMs ?? 30000, maxRetries: p.maxRetries ?? 2, rateLimitPerMin: p.rateLimitPerMin ?? '',
  rateLimitPerDay: p.rateLimitPerDay ?? '', priority: p.priority ?? 100, modules: p.modules ?? [],
  isActive: p.isActive !== false, isDefault: !!p.isDefault, notes: p.notes ?? '',
});

/** Serialise the comparable slice of a form, for dirty-checking. */
const cmp = (f: any) =>
  JSON.stringify({
    label: (f.label || '').trim(), type: f.type, apiKey: f.apiKey || '', model: (f.model || '').trim(),
    baseUrl: (f.baseUrl || '').trim(), apiVersion: (f.apiVersion || '').trim(), organization: (f.organization || '').trim(),
    projectId: (f.projectId || '').trim(), timeoutMs: Number(f.timeoutMs) || 0, maxRetries: Number(f.maxRetries) || 0,
    rateLimitPerMin: String(f.rateLimitPerMin || ''), rateLimitPerDay: String(f.rateLimitPerDay || ''),
    priority: Number(f.priority) || 0, modules: [...(f.modules || [])].sort(), isActive: !!f.isActive,
    isDefault: !!f.isDefault, notes: (f.notes || '').trim(),
  });

/** Best-effort client-side sanity check for a pasted key (instant feedback). */
function keyFormatIssue(type: string, key: string): string | null {
  if (!key) return null;
  const m = meta(type);
  if (type !== 'custom' && m.keyPrefix && !key.startsWith(m.keyPrefix))
    return `Keys for ${m.label} usually start with “${m.keyPrefix}”. Double-check you copied the right one.`;
  if (key.trim().length < 16) return 'This key looks unusually short.';
  return null;
}

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

/* -------------------------------------------------------------------------- */
/*  Small accessible toggle switch (Enable / Disable).                        */
/* -------------------------------------------------------------------------- */

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
        checked ? 'bg-[hsl(var(--primary))]' : 'bg-muted',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm', checked ? 'ml-[22px]' : 'ml-0.5')}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const TABS = [
  { id: 'connection', label: 'Connection', icon: Link2 },
  { id: 'routing', label: 'Routing', icon: SlidersHorizontal },
  { id: 'advanced', label: 'Advanced', icon: Cpu },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function AiProvidersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ai-providers'], queryFn: adminApi.aiProviders });
  const providers: any[] = useMemo(() => data?.providers ?? [], [data]);
  const catalog: any[] = data?.catalog ?? [];
  // Fallback only — the server's AI_MODULES is the source of truth, and a stale
  // copy here silently hides routing checkboxes for newer modules.
  const modules: string[] = data?.modules ?? [
    'chat', 'content', 'image', 'embeddings',
    'interview', 'scoring', 'report', 'resume',
    'question_generation', 'answer_key',
  ];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [tab, setTab] = useState<TabId>('connection');
  const [testResult, setTestResult] = useState<any>(null);
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const selectedProvider = creating ? null : providers.find((p) => p._id === selectedId) || null;
  const baseline = creating ? emptyForm : selectedProvider ? formFromProvider(selectedProvider) : emptyForm;
  const dirty = cmp(form) !== cmp(baseline);
  const defaultModel = catalog.find((c) => c.type === form.type)?.defaultModel || meta(form.type).hint;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-providers'] });
    qc.invalidateQueries({ queryKey: ['ai-provider-analytics'] });
  };

  // Auto-select the default (or first) provider once data lands / after a delete.
  useEffect(() => {
    if (creating) return;
    if (selectedId && providers.some((p) => p._id === selectedId)) return;
    if (!selectedId && providers.length) {
      const def = providers.find((p) => p.isDefault) || providers[0];
      setSelectedId(def._id);
      setForm(formFromProvider(def));
    }
  }, [providers, selectedId, creating]);

  function selectProvider(p: any) {
    setCreating(false);
    setSelectedId(p._id);
    setForm(formFromProvider(p));
    setTab('connection');
    setTestResult(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }
  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyForm);
    setTab('connection');
    setTestResult(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }
  function resetForm() {
    setForm(creating ? emptyForm : selectedProvider ? formFromProvider(selectedProvider) : emptyForm);
    setTestResult(null);
  }

  const payload = () => {
    const f = form;
    const body: any = {
      label: (f.label || '').trim(),
      type: f.type,
      model: (f.model || '').trim() || undefined,
      baseUrl: (f.baseUrl || '').trim() || undefined,
      apiVersion: (f.apiVersion || '').trim() || undefined,
      organization: (f.organization || '').trim() || undefined,
      projectId: (f.projectId || '').trim() || undefined,
      timeoutMs: Number(f.timeoutMs) || undefined,
      maxRetries: Number(f.maxRetries) || 0,
      rateLimitPerMin: f.rateLimitPerMin ? Number(f.rateLimitPerMin) : undefined,
      rateLimitPerDay: f.rateLimitPerDay ? Number(f.rateLimitPerDay) : undefined,
      priority: Number(f.priority) || 100,
      modules: f.modules,
      isActive: f.isActive,
      isDefault: f.isDefault,
      notes: (f.notes || '').trim() || undefined,
    };
    if (f.apiKey) body.apiKey = f.apiKey; // blank leaves the stored key untouched
    return body;
  };

  const save = useMutation({
    mutationFn: () => (creating ? adminApi.createAiProvider(payload()) : adminApi.updateAiProvider(selectedId!, payload())),
    onSuccess: (saved: any) => {
      toast.success(creating ? 'Provider added' : 'Changes saved');
      setTestResult(null);
      invalidate();
      if (creating && saved?._id) {
        setCreating(false);
        setSelectedId(saved._id);
        setForm(formFromProvider(saved));
      } else if (saved) {
        setForm(formFromProvider(saved));
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  });

  const testConn = useMutation({
    mutationFn: () => adminApi.testAiProvider({ ...payload(), id: creating ? undefined : selectedId }),
    onSuccess: (r: any) => {
      setTestResult({ ...r, kind: 'test' });
      r.ok ? toast.success(`Connected · ${r.model || form.model || 'model'} · ${r.latencyMs}ms`) : toast.error(r.error || 'Connection failed');
      if (!creating) invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  const validateKey = useMutation({
    mutationFn: () =>
      adminApi.testAiProvider({
        type: form.type,
        apiKey: form.apiKey || undefined,
        baseUrl: (form.baseUrl || '').trim() || undefined,
        apiVersion: (form.apiVersion || '').trim() || undefined,
        organization: (form.organization || '').trim() || undefined,
        projectId: (form.projectId || '').trim() || undefined,
        model: (form.model || '').trim() || undefined,
        id: creating ? undefined : selectedId,
      }),
    onSuccess: (r: any) => {
      setTestResult({ ...r, kind: 'validate' });
      r.ok ? toast.success('API key is valid') : toast.error(r.error || 'Key rejected by provider');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Validation failed'),
  });

  function onValidateKey() {
    if (creating && !(form.apiKey || '').trim()) {
      setTestResult({ ok: false, error: 'Enter an API key to validate.', kind: 'validate' });
      toast.error('Enter an API key first');
      return;
    }
    validateKey.mutate();
  }

  const setDefault = useMutation({
    mutationFn: (id: string) => adminApi.setDefaultAiProvider(id),
    onSuccess: () => { toast.success('Default provider set'); invalidate(); },
    onError: () => toast.error('Could not set default'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteAiProvider(id),
    onSuccess: () => { toast.success('Provider removed'); setCreating(false); setSelectedId(null); invalidate(); },
    onError: () => toast.error('Delete failed'),
  });
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

  // Health summary
  const total = providers.length;
  const active = providers.filter((p) => p.isActive).length;
  const healthy = providers.filter((p) => p.health === 'healthy').length;
  const issues = providers.filter((p) => p.health === 'down' || p.health === 'degraded').length;
  const missingKey = providers.filter((p) => !p.hasKey).length;
  const defaultName = providers.find((p) => p.isDefault)?.label;

  const typeOptions = (catalog.length ? catalog.map((c) => ({ value: c.type, label: `${meta(c.type).label}` })) : PROVIDER_TYPES.map((t) => ({ value: t, label: meta(t).label })));

  const filtered = providers.filter((p) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return String(p.label || '').toLowerCase().includes(s) || String(p.type || '').toLowerCase().includes(s);
  });

  const keyIssue = keyFormatIssue(form.type, form.apiKey);
  const canSave = (form.label || '').trim().length > 0 && (!creating || (form.apiKey || '').trim().length > 0);
  const busy = save.isPending || testConn.isPending || validateKey.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Providers"
        description="Register, route, and fail over between AI providers without code changes. Keys are encrypted at rest."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportFile} />
            <Button size="sm" variant="glass" magnetic={false} loading={exportM.isPending} onClick={() => exportM.mutate()}>
              <Download className="h-4 w-4" /> Backup
            </Button>
            <Button size="sm" variant="glass" magnetic={false} loading={importM.isPending} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Restore
            </Button>
            <Button size="sm" magnetic={false} onClick={startCreate}>
              <Plus className="h-4 w-4" /> Add provider
            </Button>
          </div>
        }
      />

      {/* Health summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Providers" value={total} icon={Server} color="violet" sub={defaultName ? `Default · ${defaultName}` : 'No default set'} loading={isLoading} delay={0} />
        <StatTile label="Active" value={active} icon={Power} color="green" sub={total - active > 0 ? `${total - active} disabled` : 'all enabled'} loading={isLoading} delay={0.05} />
        <StatTile label="Healthy" value={healthy} icon={ShieldCheck} color="cyan" sub="passed last test" loading={isLoading} delay={0.1} />
        <StatTile label="Needs attention" value={issues} icon={AlertTriangle} color="orange" sub={missingKey > 0 ? `${missingKey} missing key` : 'no failures'} loading={isLoading} delay={0.15} />
      </div>

      {/* Master–detail configurator */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* List */}
        <GlassCard className="lg:sticky lg:top-6 lg:w-[340px] lg:shrink-0">
          <div className="mb-4 flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Providers</h2>
            <span className="ml-auto text-xs text-muted-foreground">{total}</span>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search providers…"
              aria-label="Search providers"
              className="w-full rounded-xl border border-input bg-background/60 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="-mr-2 max-h-[560px] space-y-2 overflow-y-auto pr-2">
            {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[68px] rounded-xl" />)}

            {!isLoading &&
              filtered.map((p) => {
                const activeSel = !creating && selectedId === p._id;
                return (
                  <button
                    key={p._id}
                    onClick={() => selectProvider(p)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200',
                      activeSel ? 'border-primary/50 bg-primary/[0.06] ring-1 ring-primary/30' : 'border-border hover:border-primary/30 hover:bg-muted/40',
                      !p.isActive && 'opacity-60',
                    )}
                  >
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white', meta(p.type).color)}>
                      {(p.label?.[0] || 'A').toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{p.label}</span>
                        {p.isDefault && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn('h-1.5 w-1.5 rounded-full', p.health === 'healthy' ? 'bg-accent' : p.health === 'down' ? 'bg-destructive' : p.health === 'degraded' ? 'bg-yellow-400' : 'bg-muted-foreground/50')} />
                        <span className="capitalize">{String(p.type).replace('_', ' ')}</span>
                        <span aria-hidden>·</span>
                        <span>{p.hasKey ? 'key set' : 'no key'}</span>
                      </span>
                    </span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', activeSel ? 'text-primary' : 'text-muted-foreground/40 group-hover:translate-x-0.5')} />
                  </button>
                );
              })}

            {!isLoading && providers.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No providers yet. The built-in environment key is used until you add one.
              </div>
            )}
            {!isLoading && providers.length > 0 && filtered.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">No provider matches “{q}”.</p>
            )}
          </div>

          <Button variant="outline" size="sm" magnetic={false} className="mt-3 w-full" onClick={startCreate}>
            <Plus className="h-4 w-4" /> Add provider
          </Button>
        </GlassCard>

        {/* Editor */}
        <div ref={editorRef} className="min-w-0 flex-1 scroll-mt-6">
          {providers.length === 0 && !creating && !isLoading ? (
            <GlassCard className="grid place-items-center py-16 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold">Add your first AI provider</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Connect Claude, OpenAI, Gemini and more. Route each module to a provider with automatic failover.
              </p>
              <Button className="mt-5" magnetic={false} onClick={startCreate}>
                <Plus className="h-4 w-4" /> Add provider
              </Button>
            </GlassCard>
          ) : (
            <GlassCard className="overflow-hidden p-0">
              {/* Editor header */}
              <div className="flex flex-wrap items-center gap-4 border-b border-border bg-muted/30 p-5">
                <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-bold text-white', meta(form.type).color)}>
                  {(form.label?.[0] || (creating ? '+' : 'A')).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">{creating ? 'New provider' : form.label || 'Untitled provider'}</h2>
                    {!creating && selectedProvider?.isDefault && <Badge tone="success"><Star className="h-3 w-3 fill-current" /> Default</Badge>}
                    {!creating && selectedProvider && <Badge tone={healthTone(selectedProvider.health)}>{selectedProvider.health || 'unknown'}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta(form.type).label} · {meta(form.type).hint}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
                    <Power className={cn('h-4 w-4', form.isActive ? 'text-accent' : 'text-muted-foreground')} />
                    <span className="text-xs font-medium">{form.isActive ? 'Enabled' : 'Disabled'}</span>
                    <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Enable provider" />
                  </span>
                  {!creating && selectedProvider && !selectedProvider.isDefault && (
                    <Button size="sm" variant="soft" magnetic={false} loading={setDefault.isPending} onClick={() => setDefault.mutate(selectedId!)} title="Make this the default provider">
                      <Star className="h-4 w-4" /> <span className="hidden sm:inline">Set default</span>
                    </Button>
                  )}
                  {!creating && selectedProvider && (
                    <button
                      onClick={() => { if (window.confirm(`Delete provider “${selectedProvider.label}”? This cannot be undone.`)) del.mutate(selectedId!); }}
                      title="Delete provider"
                      aria-label="Delete provider"
                      className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-border px-3">
                {TABS.map((t) => {
                  const on = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn('relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors', on ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                    >
                      <t.icon className="h-4 w-4" /> {t.label}
                      {on && <motion.span layoutId="ai-tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {tab === 'connection' && (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Select label="Provider type" value={form.type} onChange={(v) => set('type', v)} options={typeOptions} />
                          <Field label="Display label" value={form.label} onChange={(v) => set('label', v)} placeholder="OpenAI (Production)" />
                        </div>

                        <div>
                          <Field
                            label="API key"
                            type="password"
                            value={form.apiKey}
                            onChange={(v) => set('apiKey', v)}
                            autoComplete="off"
                            placeholder={creating ? 'Paste the secret key…' : '•••••••• leave blank to keep current'}
                          />
                          <p className={cn('mt-1.5 text-xs', keyIssue ? 'text-yellow-400' : 'text-muted-foreground')}>
                            {keyIssue
                              ? keyIssue
                              : creating
                                ? 'Stored encrypted (AES-256-GCM). Required to activate this provider.'
                                : selectedProvider?.hasKey
                                  ? 'A key is saved. Leave blank to keep it, or paste a new one to replace.'
                                  : 'No key saved yet — paste one to enable live calls.'}
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Model" value={form.model} onChange={(v) => set('model', v)} placeholder={defaultModel || 'model name'} />
                          <Field label="Base URL / endpoint" value={form.baseUrl} onChange={(v) => set('baseUrl', v)} placeholder="optional · proxy / Azure / self-hosted" />
                        </div>

                        {(form.type === 'azure_openai' || form.type === 'openai' || form.type === 'custom' || form.apiVersion || form.organization || form.projectId) && (
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="API version" value={form.apiVersion} onChange={(v) => set('apiVersion', v)} placeholder="Azure / Anthropic" />
                            <Field label="Organization" value={form.organization} onChange={(v) => set('organization', v)} placeholder="OpenAI org id" />
                            <Field label="Project ID" value={form.projectId} onChange={(v) => set('projectId', v)} placeholder="optional" />
                          </div>
                        )}
                      </div>
                    )}

                    {tab === 'routing' && (
                      <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Field label="Priority" type="number" value={String(form.priority)} onChange={(v) => set('priority', v)} min={1} />
                            <p className="mt-1.5 text-xs text-muted-foreground">Lower value is tried first during failover.</p>
                          </div>
                          <div className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Default provider</p>
                                <p className="text-xs text-muted-foreground">Serves any module without an explicit route.</p>
                              </div>
                              {creating ? (
                                <Switch checked={form.isDefault} onChange={(v) => set('isDefault', v)} label="Set as default" />
                              ) : selectedProvider?.isDefault ? (
                                <Badge tone="success">Current</Badge>
                              ) : (
                                <Button size="sm" variant="soft" magnetic={false} loading={setDefault.isPending} onClick={() => setDefault.mutate(selectedId!)}>
                                  <Star className="h-4 w-4" /> Set
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-sm font-medium">Modules served <span className="font-normal text-muted-foreground">(failover candidates)</span></p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {modules.map((m) => {
                              const on = form.modules.includes(m);
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => set('modules', on ? form.modules.filter((x: string) => x !== m) : [...form.modules, m])}
                                  className={cn(
                                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm capitalize transition-all',
                                    on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                                  )}
                                >
                                  <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border', on ? 'border-primary bg-primary text-white' : 'border-muted-foreground/40')}>
                                    {on && <CheckCircle2 className="h-3 w-3" />}
                                  </span>
                                  {m}
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">Unchecked modules fall back to the default provider, then the built-in environment key.</p>
                        </div>
                      </div>
                    )}

                    {tab === 'advanced' && (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Field label="Timeout (ms)" type="number" value={String(form.timeoutMs)} onChange={(v) => set('timeoutMs', v)} min={1000} />
                          <Field label="Max retries" type="number" value={String(form.maxRetries)} onChange={(v) => set('maxRetries', v)} min={0} />
                          <Field label="Rate / min" type="number" value={String(form.rateLimitPerMin)} onChange={(v) => set('rateLimitPerMin', v)} placeholder="unlimited" />
                          <Field label="Rate / day" type="number" value={String(form.rateLimitPerDay)} onChange={(v) => set('rateLimitPerDay', v)} placeholder="unlimited" />
                        </div>
                        <Textarea label="Notes" value={form.notes} onChange={(v) => set('notes', v)} rows={3} placeholder="Internal notes about this provider (billing account, owner, region…)." />
                        {!creating && selectedProvider?.health === 'down' && selectedProvider?.lastError && (
                          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>Last error: {selectedProvider.lastError}{selectedProvider.lastErrorAt ? ` · ${relativeTime(selectedProvider.lastErrorAt)}` : ''}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Test result banner */}
                <AnimatePresence>
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                      role="status"
                      aria-live="polite"
                      className="overflow-hidden"
                    >
                      <div className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm', testResult.ok ? 'border-accent/40 bg-accent/5 text-accent' : 'border-destructive/40 bg-destructive/5 text-destructive')}>
                        {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                        <span>
                          {testResult.ok
                            ? testResult.kind === 'validate'
                              ? `API key is valid · responded in ${testResult.latencyMs}ms.`
                              : `Connected in ${testResult.latencyMs}ms · ${testResult.model || form.model}${testResult.sample ? ` · “${testResult.sample}”` : ''}`
                            : `${testResult.kind === 'validate' ? 'Key validation failed' : 'Connection failed'}: ${testResult.error}`}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sticky action bar */}
              <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-card/80 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/60">
                <Button variant="glass" size="sm" magnetic={false} loading={testConn.isPending} disabled={busy && !testConn.isPending} onClick={() => testConn.mutate()}>
                  <Zap className="h-4 w-4" /> Test connection
                </Button>
                <Button variant="outline" size="sm" magnetic={false} loading={validateKey.isPending} disabled={busy && !validateKey.isPending} onClick={onValidateKey}>
                  <KeyRound className="h-4 w-4" /> Validate key
                </Button>

                <span className="ml-auto flex items-center gap-2">
                  <AnimatePresence>
                    {dirty && (
                      <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Unsaved changes
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <Button variant="ghost" size="sm" magnetic={false} disabled={!dirty || save.isPending} onClick={resetForm}>
                    <RotateCcw className="h-4 w-4" /> Reset
                  </Button>
                  <Button size="sm" magnetic={false} loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
                    <Save className="h-4 w-4" /> {creating ? 'Add provider' : 'Save changes'}
                  </Button>
                </span>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Module routing overview */}
      {providers.length > 0 && (
        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Module routing</h2>
            <span className="ml-auto text-xs text-muted-foreground">who serves what</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => {
              const serving = providers.filter((p) => p.isActive && (p.isDefault || (p.modules || []).includes(m)));
              return (
                <div key={m} className="rounded-xl border border-border bg-card/40 p-3">
                  <p className="text-xs font-medium capitalize">{m}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {serving.length === 0 && <span className="text-[11px] text-muted-foreground">— built-in default</span>}
                    {serving.map((s) => (
                      <button key={s._id} onClick={() => selectProvider(s)} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary transition hover:bg-primary/20">
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <ProviderMonitoring />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Provider monitoring (per-provider health + usage).                        */
/* -------------------------------------------------------------------------- */

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
            {errors.length === 0 && <p className="text-muted-foreground">No failed requests recently.</p>}
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
