'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, UserPlus, Activity, Eye, MousePointerClick, Timer, TrendingDown, Globe2,
  DollarSign, CreditCard, Repeat, Coins, Mail, Bell, Inbox, CalendarClock, Newspaper,
  Download, FileSpreadsheet, FileText, Radio, Wifi, Sparkles, Layers, MonitorSmartphone,
} from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { number } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AreaChart, BarChart, BarList, Donut, Funnel, Heatmap } from '@/components/ui/Charts';
import { Reveal } from '@/components/ui/motion';

const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ago = (n: number) => iso(new Date(Date.now() - n * DAY));
const PRESETS: [string, number][] = [['7D', 7], ['30D', 30], ['90D', 90]];
const TABS = ['Overview', 'Traffic', 'Audience', 'Business'] as const;
type Tab = (typeof TABS)[number];

const DEVICE_COLORS: Record<string, string> = {
  desktop: 'hsl(var(--primary))',
  mobile: 'hsl(var(--accent))',
  tablet: 'hsl(var(--sunset))',
  other: 'hsl(var(--muted-foreground))',
};

function fmtDuration(sec: number) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(ago(30));
  const [to, setTo] = useState(iso(new Date()));
  const [tab, setTab] = useState<Tab>('Overview');
  const [exporting, setExporting] = useState('');

  const summary = useQuery({ queryKey: ['analytics-summary', from, to], queryFn: () => adminApi.analyticsSummary(from, to) });
  const traffic = useQuery({ queryKey: ['analytics-traffic', from, to], queryFn: () => adminApi.analyticsTraffic(from, to) });

  const b = summary.data?.business;
  const t = summary.data?.traffic;
  const funnel = summary.data?.funnel ?? [];

  const activePreset = useMemo(() => {
    if (to !== iso(new Date())) return '';
    const p = PRESETS.find(([, n]) => from === ago(n));
    return p?.[0] ?? '';
  }, [from, to]);

  const setPreset = (n: number) => { setFrom(ago(n)); setTo(iso(new Date())); };

  const doExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setExporting(format);
    try { await adminApi.exportAnalytics({ from, to, format }); } finally { setExporting(''); }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Traffic, audience, product usage, and business metrics across your platform."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="glass" magnetic={false} loading={exporting === 'csv'} onClick={() => doExport('csv')}><Download className="h-4 w-4" /> CSV</Button>
            <Button size="sm" variant="glass" magnetic={false} loading={exporting === 'xlsx'} onClick={() => doExport('xlsx')}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button size="sm" variant="glass" magnetic={false} loading={exporting === 'pdf'} onClick={() => doExport('pdf')}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      {/* ── Real-time + date range ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <RealtimeStrip />
        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-border p-1">
            {PRESETS.map(([label, n]) => (
              <button
                key={label}
                onClick={() => setPreset(n)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition', activePreset === label ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white' : 'text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-input bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            To
            <input type="date" value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-input bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary" />
          </label>
        </GlassCard>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn('relative px-4 py-2.5 text-sm font-medium transition-colors', tab === tb ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {tb}
            {tab === tb && <motion.span layoutId="an-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" />}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab b={b} t={t} funnel={funnel} loading={summary.isLoading} />}
      {tab === 'Traffic' && <TrafficTab data={traffic.data} loading={traffic.isLoading} />}
      {tab === 'Audience' && <AudienceTab data={traffic.data} loading={traffic.isLoading} />}
      {tab === 'Business' && <BusinessTab b={b} loading={summary.isLoading} />}
    </div>
  );
}

/* ── Real-time ── */
function RealtimeStrip() {
  const { data } = useQuery({ queryKey: ['analytics-realtime'], queryFn: adminApi.analyticsRealtime, refetchInterval: 15000 });
  const active = data?.active ?? 0;
  const recent: any[] = data?.recent ?? [];
  return (
    <GlassCard className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15">
          <Radio className="h-5 w-5 text-emerald-500" />
          <span className="absolute right-1 top-1 h-2 w-2 animate-ping rounded-full bg-emerald-500" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <div>
          <p className="text-2xl font-extrabold tabular-nums leading-none">{active}</p>
          <p className="text-xs text-muted-foreground">active now · live</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Wifi className="h-3.5 w-3.5" /> Recent activity</p>
        <div className="flex flex-wrap gap-1.5">
          {recent.length === 0 && <span className="text-xs text-muted-foreground">No live visitors right now.</span>}
          {recent.slice(0, 6).map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
              <span className="truncate max-w-[140px] font-mono text-foreground/80">{r.path}</span>
              {r.country && <span className="text-muted-foreground">· {r.country}</span>}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

/* ── Overview ── */
function OverviewTab({ b, t, funnel, loading }: any) {
  const regs = (b?.registrations ?? []).map((r: any) => ({ label: r.label, value: r.value }));
  const rev = (b?.revenue?.series ?? []).map((r: any) => ({ label: r.label, value: r.value }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Users" value={b?.users?.total ?? 0} icon={Users} color="violet" compact loading={loading} delay={0} />
        <StatTile label="Active (DAU)" value={b?.users?.dau ?? 0} icon={Activity} color="green" sub={`WAU ${number(b?.users?.wau ?? 0)} · MAU ${number(b?.users?.mau ?? 0)}`} loading={loading} delay={0.05} />
        <StatTile label="New Registrations" value={b?.users?.new ?? 0} icon={UserPlus} color="blue" compact loading={loading} delay={0.1} />
        <StatTile label="Page Views" value={t?.pageviews ?? 0} icon={Eye} color="cyan" compact loading={loading} delay={0.15} />
        <StatTile label="Sessions" value={t?.sessions ?? 0} icon={Layers} color="pink" compact loading={loading} delay={0.2} />
        <StatTile label="Unique Visitors" value={t?.visitors ?? 0} icon={Users} color="orange" compact loading={loading} delay={0.25} />
        <StatTile label="Bounce Rate" value={t?.bounceRate ?? 0} icon={TrendingDown} color="orange" suffix="%" loading={loading} delay={0.3} />
        <StatTile label="MRR" value={b?.revenue?.mrr ?? 0} icon={DollarSign} color="green" prefix="₹" compact loading={loading} delay={0.35} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="New registrations" icon={UserPlus}><AreaChart data={regs} /></ChartCard>
        <ChartCard title="Revenue" icon={DollarSign} hint="paid, per day"><AreaChart data={rev} /></ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Conversion funnel" icon={TrendingDown}><Funnel steps={funnel} /></ChartCard>
        <ChartCard title="Avg session · engagement" icon={Timer}>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Avg session" value={fmtDuration(t?.avgSessionSeconds ?? 0)} />
            <MiniStat label="Bounce rate" value={`${t?.bounceRate ?? 0}%`} />
            <MiniStat label="Pages / session" value={t?.sessions ? (t.pageviews / t.sessions).toFixed(1) : '0'} />
            <MiniStat label="Trial → paid" value={funnelConv(funnel)} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function funnelConv(funnel: any[]) {
  if (!funnel?.length) return '0%';
  const top = funnel[0]?.value || 0;
  const paid = funnel[funnel.length - 1]?.value || 0;
  return top ? `${((paid / top) * 100).toFixed(1)}%` : '0%';
}

/* ── Traffic ── */
function TrafficTab({ data, loading }: any) {
  if (loading) return <LoadingGrid />;
  const series = (data?.series ?? []).map((d: any) => ({ label: d.label, value: d.pageviews }));
  return (
    <div className="space-y-6">
      <ChartCard title="Page views & sessions" icon={Eye} hint="per day">
        <AreaChart data={series} height={220} />
      </ChartCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top landing pages" icon={MousePointerClick}><BarList data={topList(data?.topPages)} /></ChartCard>
        <ChartCard title="Traffic sources" icon={Globe2}><BarList data={topList(data?.sources)} /></ChartCard>
        <ChartCard title="Channels / mediums" icon={Layers}><BarList data={topList(data?.mediums)} /></ChartCard>
        <ChartCard title="Referrers" icon={Globe2}><BarList data={topList(data?.referrers)} /></ChartCard>
      </div>
      <ChartCard title="Activity heatmap" icon={Activity} hint="day × hour">
        <Heatmap cells={data?.heatmap ?? []} />
      </ChartCard>
    </div>
  );
}

/* ── Audience ── */
function AudienceTab({ data, loading }: any) {
  if (loading) return <LoadingGrid />;
  const devices = (data?.devices ?? []).map((d: any) => ({ label: d.label, value: d.value, color: DEVICE_COLORS[d.label] || 'hsl(var(--muted-foreground))' }));
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Device breakdown" icon={MonitorSmartphone}>
          {devices.length ? <Donut segments={devices} /> : <p className="text-sm text-muted-foreground">No data yet</p>}
        </ChartCard>
        <ChartCard title="Countries" icon={Globe2} hint="top by visits"><BarList data={topList(data?.countries)} /></ChartCard>
        <ChartCard title="Browsers" icon={Globe2}><BarList data={topList(data?.browsers)} /></ChartCard>
        <ChartCard title="Operating systems" icon={MonitorSmartphone}><BarList data={topList(data?.os)} /></ChartCard>
      </div>
    </div>
  );
}

/* ── Business ── */
function BusinessTab({ b, loading }: any) {
  const subs = b?.subscriptions ?? {};
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Paid Subscribers" value={subs.paid ?? 0} icon={CreditCard} color="green" loading={loading} delay={0} />
        <StatTile label="Free Trials" value={subs.trialing ?? 0} icon={Sparkles} color="violet" loading={loading} delay={0.05} />
        <StatTile label="MRR" value={b?.revenue?.mrr ?? 0} icon={DollarSign} color="green" prefix="₹" compact loading={loading} delay={0.1} />
        <StatTile label="ARR" value={b?.revenue?.arr ?? 0} icon={Repeat} color="blue" prefix="₹" compact loading={loading} delay={0.15} />
        <StatTile label="Churn Rate" value={b?.revenue?.churnRate ?? 0} icon={TrendingDown} color="orange" suffix="%" loading={loading} delay={0.2} />
        <StatTile label="AI Tokens" value={b?.ai?.tokens ?? 0} icon={Coins} color="pink" compact loading={loading} delay={0.25} />
        <StatTile label="Emails Sent" value={b?.email?.sent ?? 0} icon={Mail} color="cyan" compact loading={loading} delay={0.3} />
        <StatTile label="Notifications" value={b?.notifications ?? 0} icon={Bell} color="orange" compact loading={loading} delay={0.35} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Subscriptions" icon={CreditCard}>
          <div className="space-y-2.5 text-sm">
            <Row label="Paid / active" value={subs.paid ?? 0} tone="success" />
            <Row label="Trialing" value={subs.trialing ?? 0} tone="default" />
            <Row label="Past due" value={subs.pastDue ?? 0} tone="warning" />
            <Row label="Canceled" value={subs.canceled ?? 0} tone="muted" />
          </div>
        </ChartCard>
        <ChartCard title="AI usage" icon={Coins}>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Tokens" value={number(b?.ai?.tokens ?? 0)} />
            <MiniStat label="Cost" value={`$${(b?.ai?.cost ?? 0).toFixed(2)}`} />
            <MiniStat label="API calls" value={number(b?.ai?.calls ?? 0)} />
            <MiniStat label="Open rate" value={`${b?.email?.openRate ?? 0}%`} />
          </div>
        </ChartCard>
        <ChartCard title="Engagement" icon={Inbox}>
          <div className="space-y-2.5 text-sm">
            <Row label="Contact enquiries" value={b?.enquiries ?? 0} icon={Inbox} />
            <Row label="Newsletter subs" value={b?.newsletter ?? 0} icon={Mail} />
            <Row label="Demo bookings" value={b?.demos ?? 0} icon={CalendarClock} />
            <Row label="Blog views" value={b?.blog?.views ?? 0} icon={Newspaper} />
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Revenue trend" icon={DollarSign} hint="paid, per day">
        <BarChart data={(b?.revenue?.series ?? []).map((r: any) => ({ label: r.label, value: r.value }))} height={200} />
      </ChartCard>
    </div>
  );
}

/* ── Small pieces ── */
function ChartCard({ title, icon: Icon, hint, children }: { title: string; icon: any; hint?: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <GlassCard className="h-full">
        <div className="mb-4 flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <span className="ml-auto text-[11px] text-muted-foreground">{hint}</span>}
        </div>
        {children}
      </GlassCard>
    </Reveal>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: any; icon?: any }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}</span>
      {tone ? <Badge tone={tone} className="ml-auto tabular-nums">{number(value)}</Badge> : <span className="ml-auto font-semibold tabular-nums">{number(value)}</span>}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
    </div>
  );
}

const topList = (arr?: any[]) => (arr ?? []).map((x) => ({ label: String(x.label ?? '—'), value: x.value, hint: number(x.value) }));
