'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Cable, Search, Zap, ExternalLink, ChevronDown, CheckCircle2, XCircle, Save,
  BarChart3, Activity, Target, MessagesSquare, Users, Bug, Webhook, Code2, type LucideIcon,
} from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

const CAT_META: Record<string, { icon: LucideIcon; color: string }> = {
  analytics: { icon: BarChart3, color: 'text-violet-400' },
  product: { icon: Activity, color: 'text-cyan-400' },
  ads: { icon: Target, color: 'text-orange-400' },
  support: { icon: MessagesSquare, color: 'text-emerald-400' },
  crm: { icon: Users, color: 'text-pink-400' },
  monitoring: { icon: Bug, color: 'text-sky-400' },
  automation: { icon: Webhook, color: 'text-violet-400' },
  custom: { icon: Code2, color: 'text-muted-foreground' },
};

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
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
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm', checked ? 'ml-[22px]' : 'ml-0.5')} />
    </button>
  );
}

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['integrations'], queryFn: adminApi.integrations });
  const categories: { key: string; label: string }[] = data?.categories ?? [];
  const integrations: any[] = useMemo(() => data?.integrations ?? [], [data]);

  const [forms, setForms] = useState<Record<string, any>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Record<string, any>>({});
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current || !integrations.length) return;
    inited.current = true;
    const f: Record<string, any> = {};
    const e: Record<string, boolean> = {};
    for (const it of integrations) {
      f[it.key] = { ...it.values };
      e[it.key] = it.enabled;
    }
    setForms(f);
    setEnabled(e);
  }, [integrations]);

  const setField = (key: string, field: string, value: any) => setForms((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  const isConfigured = (it: any) => (it.fields || []).every((fl: any) => String(forms[it.key]?.[fl.key] ?? '').trim() !== '');

  const save = useMutation({
    mutationFn: ({ key, body }: { key: string; body: any }) => adminApi.saveIntegration(key, body),
    onSuccess: (_r, v) => { toast.success(enabled[v.key] ? 'Saved & enabled' : 'Saved'); qc.invalidateQueries({ queryKey: ['integrations'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });
  const test = useMutation({
    mutationFn: (key: string) => adminApi.testIntegration(key),
    onSuccess: (r: any, key) => { setResults((p) => ({ ...p, [key]: r })); r.ok ? toast.success(r.message || 'Connected') : toast.error(r.message || r.error || 'Test failed'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Test failed'),
  });

  const persist = (it: any, nextEnabled: boolean) => save.mutate({ key: it.key, body: { enabled: nextEnabled, ...forms[it.key] } });

  function toggleEnable(it: any, v: boolean) {
    setEnabled((p) => ({ ...p, [it.key]: v }));
    persist(it, v);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return integrations.filter((it) => {
      if (tab !== 'all' && it.category !== tab) return false;
      if (!s) return true;
      return `${it.name} ${it.description} ${it.key}`.toLowerCase().includes(s);
    });
  }, [integrations, tab, q]);

  const total = integrations.length;
  const liveCount = integrations.filter((it) => it.enabled && it.configured).length;
  const catCount = (key: string) => integrations.filter((it) => it.category === key).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tracking & Integrations"
        description="Connect analytics, ad pixels, chat, CRM and automation tools. Keys are encrypted; enabled snippets load automatically on your site."
        action={<Badge tone="success">{liveCount} live · {total} available</Badge>}
      />

      {/* Category tabs + search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          <TabButton active={tab === 'all'} onClick={() => setTab('all')} label={`All (${total})`} />
          {categories.map((c) => (
            <TabButton key={c.key} active={tab === c.key} onClick={() => setTab(c.key)} label={`${c.label} (${catCount(c.key)})`} icon={CAT_META[c.key]?.icon} />
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search integrations…"
            aria-label="Search integrations"
            className="h-10 w-full rounded-xl border border-input bg-background/60 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}

        {!isLoading && filtered.map((it) => {
          const CatIcon = CAT_META[it.category]?.icon || Cable;
          const on = enabled[it.key] ?? it.enabled;
          const configured = isConfigured(it);
          const open = openKey === it.key;
          const res = results[it.key];
          const status = on && configured ? { tone: 'success' as const, text: it.hasClientSnippet ? 'Live on site' : 'Active' }
            : on && !configured ? { tone: 'warning' as const, text: 'Needs setup' }
              : configured ? { tone: 'muted' as const, text: 'Configured · off' }
                : { tone: 'muted' as const, text: 'Not configured' };

          return (
            <motion.div layout key={it.key} className={cn('flex flex-col rounded-2xl border bg-card/40 transition-colors', on && configured ? 'border-primary/40' : 'border-border')}>
              <div className="flex items-start gap-3 p-5">
                <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted/60', CAT_META[it.category]?.color)}>
                  <CatIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{it.name}</p>
                    {it.docs && (
                      <a href={it.docs} target="_blank" rel="noreferrer" className="text-muted-foreground transition hover:text-primary" title="Documentation" aria-label={`${it.name} documentation`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{it.description}</p>
                </div>
                <Switch checked={on} onChange={(v) => toggleEnable(it, v)} disabled={save.isPending} label={`Enable ${it.name}`} />
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-border px-5 py-3">
                <Badge tone={status.tone}>{status.text}</Badge>
                <button
                  onClick={() => setOpenKey(open ? null : it.key)}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:opacity-80"
                >
                  Configure <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-border">
                    <div className="space-y-3 p-5">
                      {(it.fields || []).map((f: any) =>
                        f.type === 'textarea' ? (
                          <div key={f.key}>
                            <Textarea label={f.label} value={forms[it.key]?.[f.key] ?? ''} onChange={(v) => setField(it.key, f.key, v)} rows={4} placeholder={f.placeholder} />
                            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
                          </div>
                        ) : (
                          <div key={f.key}>
                            <Field
                              label={f.label + (f.secret ? ' (secret)' : '')}
                              type={f.secret ? 'password' : 'text'}
                              value={forms[it.key]?.[f.key] ?? ''}
                              onChange={(v) => setField(it.key, f.key, v)}
                              placeholder={f.placeholder}
                              autoComplete="off"
                            />
                            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
                          </div>
                        ),
                      )}

                      {res && (
                        <div className={cn('flex items-start gap-2 rounded-xl border p-2.5 text-xs', res.ok ? 'border-accent/40 bg-accent/5 text-accent' : 'border-destructive/40 bg-destructive/5 text-destructive')}>
                          {res.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                          <span>{res.message || (res.ok ? 'Connected' : res.error || 'Failed')}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button size="sm" magnetic={false} loading={save.isPending && save.variables?.key === it.key} onClick={() => persist(it, enabled[it.key] ?? it.enabled)}>
                          <Save className="h-4 w-4" /> Save
                        </Button>
                        <Button size="sm" variant="glass" magnetic={false} loading={test.isPending && test.variables === it.key} onClick={() => test.mutate(it.key)}>
                          <Zap className="h-4 w-4" /> {it.isWebhook ? 'Send test' : 'Verify'}
                        </Button>
                        {it.hasClientSnippet && <span className="text-[11px] text-muted-foreground">Loads client-side on every page</span>}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No integrations match “{q}”.
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon?: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition',
        active ? 'bg-gradient-brand text-white shadow-glow' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {Icon && <Icon className="h-4 w-4" />} {label}
    </button>
  );
}
