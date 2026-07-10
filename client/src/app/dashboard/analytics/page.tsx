'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, UserPlus, Activity, Eye, MousePointerClick, Timer, TrendingDown, Globe2,
  DollarSign, CreditCard, Repeat, Coins, Mail, Bell, Inbox, CalendarClock, Newspaper,
  Download, FileSpreadsheet, FileText, Radio, Wifi, Sparkles, Layers, MonitorSmartphone,
  Target, Zap, ListTree, MapPin,
} from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { number, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AreaChart, BarChart, BarList, Donut, Funnel, Heatmap } from '@/components/ui/Charts';
import { Reveal } from '@/components/ui/motion';

const GeoMap = dynamic(() => import('@/components/analytics/GeoMap').then((m) => m.GeoMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[380px] rounded-2xl" />,
});

const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ago = (n: number) => iso(new Date(Date.now() - n * DAY));
const PRESETS: [string, number][] = [['7D', 7], ['30D', 30], ['90D', 90]];
const TABS = ['Overview', 'Engagement', 'Traffic', 'Audience', 'Geography', 'Business'] as const;
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
  const engagement = useQuery({ queryKey: ['analytics-engagement', from, to], queryFn: () => adminApi.analyticsEngagement(from, to) });

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
      {tab === 'Engagement' && <EngagementTab data={engagement.data} loading={engagement.isLoading} />}
      {tab === 'Traffic' && <TrafficTab data={traffic.data} loading={traffic.isLoading} />}
      {tab === 'Audience' && <AudienceTab data={traffic.data} loading={traffic.isLoading} />}
      {tab === 'Geography' && <GeographyTab from={from} to={to} />}
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

/* ── Engagement (CTA + events + funnel) ── */
function EngagementTab({ data, loading }: any) {
  if (loading) return <LoadingGrid />;
  const cta = data?.cta ?? {};
  const events = data?.events ?? {};
  const funnel = data?.funnel ?? [];
  const byCta = cta.byCta ?? [];
  const ctaDevices = (cta.devices ?? []).map((d: any) => ({ label: d.label, value: d.value, color: DEVICE_COLORS[d.label] || 'hsl(var(--muted-foreground))' }));
  const ctaTrend = (cta.trend ?? []).map((d: any) => ({ label: d.label, value: d.value }));
  const maxClicks = Math.max(1, ...byCta.map((c: any) => c.clicks));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="CTA Clicks" value={cta.totals?.clicks ?? 0} icon={MousePointerClick} color="violet" compact delay={0} />
        <StatTile label="Unique Clickers" value={cta.totals?.uniqueVisitors ?? 0} icon={Target} color="cyan" compact delay={0.05} />
        <StatTile label="Total Events" value={events.total ?? 0} icon={Zap} color="pink" compact delay={0.1} />
        <StatTile label="Top CTA" value={byCta[0]?.clicks ?? 0} icon={Sparkles} color="green" sub={byCta[0]?.name || '—'} delay={0.15} />
      </div>

      <ChartCard title="Conversion funnel" icon={TrendingDown} hint="visitor → paid (6 steps)">
        <Funnel steps={funnel} />
      </ChartCard>

      <ChartCard title="CTA performance" icon={MousePointerClick} hint="clicks · unique · CTR">
        {byCta.length === 0 ? (
          <p className="text-sm text-muted-foreground">No CTA clicks in this range yet — tracked as visitors click buttons tagged with <code className="text-accent">data-cta</code>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">CTA</th>
                  <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-3 text-right font-medium">Unique</th>
                  <th className="py-2 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {byCta.map((c: any) => (
                  <tr key={c.name} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.name}</span>
                      <div className="mt-1 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" style={{ width: `${(c.clicks / maxClicks) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{number(c.clicks)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{number(c.unique)}</td>
                    <td className="py-2 text-right tabular-nums">{c.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="CTA clicks trend" icon={Activity} hint="per day"><AreaChart data={ctaTrend} /></ChartCard>
        <ChartCard title="CTA by device" icon={MonitorSmartphone}>{ctaDevices.length ? <Donut segments={ctaDevices} /> : <p className="text-sm text-muted-foreground">No data yet</p>}</ChartCard>
        <ChartCard title="CTA by source" icon={Globe2}><BarList data={topList(cta.sources)} /></ChartCard>
        <ChartCard title="CTA by country" icon={Globe2}><BarList data={topList(cta.countries)} /></ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Events by category" icon={Layers}><BarList data={topList(events.byCategory)} /></ChartCard>
        <ChartCard title="Top events" icon={Zap}>
          <BarList data={(events.topEvents ?? []).map((e: any) => ({ label: e.name, value: e.value, hint: number(e.value) }))} />
        </ChartCard>
        <ChartCard title="Live event stream" icon={ListTree}>
          <div className="space-y-1.5 text-xs">
            {(events.recent ?? []).length === 0 && <p className="text-muted-foreground">No events yet.</p>}
            {(events.recent ?? []).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium capitalize text-primary">{e.category}</span>
                <span className="truncate font-medium">{e.name}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{relativeTime(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

/* ── Geography (choropleth + drill-down) ── */
function GeographyTab({ from, to }: { from: string; to: string }) {
  const [country, setCountry] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [metric, setMetric] = useState<'visitors' | 'sessions' | 'pageviews'>('visitors');
  const [q, setQ] = useState('');

  const geo = useQuery({
    queryKey: ['analytics-geo', from, to, country, region],
    queryFn: () => adminApi.analyticsGeo(from, to, country || undefined, region || undefined),
  });
  const rows: any[] = geo.data?.rows ?? [];
  const level: string = geo.data?.level ?? 'country';
  const values = Object.fromEntries(rows.map((r) => [r.name, r[metric]]));
  // World map at country level; India state map when drilled into India; table-only at city level.
  const mapMode: 'world' | 'india' | null = region ? null : country === null ? 'world' : country === 'India' ? 'india' : null;
  const filtered = rows.filter((r) => String(r.name).toLowerCase().includes(q.toLowerCase()));

  const drill = (name: string) => {
    if (level === 'country') { setCountry(name); setRegion(null); }
    else if (level === 'region') { setRegion(name); }
  };

  const exportCsv = () => {
    const header = ['Name', 'Visitors', 'Sessions', 'PageViews', 'New', 'Returning'];
    const lines = [header.join(','), ...rows.map((r) => [`"${r.name}"`, r.visitors, r.sessions, r.pageviews, r.newVisitors, r.returningVisitors].join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `geo-${level}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => { setCountry(null); setRegion(null); }} className={cn('rounded-lg px-2 py-1 transition', !country ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}>World</button>
          {country && <><span className="text-muted-foreground">/</span><button onClick={() => setRegion(null)} className={cn('rounded-lg px-2 py-1 transition', country && !region ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}>{country}</button></>}
          {region && <><span className="text-muted-foreground">/</span><span className="rounded-lg px-2 py-1 font-semibold">{region}</span></>}
        </div>
        <div className="ml-auto inline-flex rounded-xl border border-border p-1">
          {(['visitors', 'sessions', 'pageviews'] as const).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition', metric === m ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white' : 'text-muted-foreground hover:text-foreground')}>{m}</button>
          ))}
        </div>
      </div>

      {mapMode && (
        <ChartCard title={mapMode === 'world' ? `World — ${metric} by country` : `${country} — ${metric} by state`} icon={Globe2} hint="click a region to drill down">
          <GeoMap mode={mapMode} values={values} onSelect={drill} metricLabel={metric} />
        </ChartCard>
      )}

      <ChartCard title={`${level.charAt(0).toUpperCase() + level.slice(1)} breakdown`} icon={MapPin} hint={`${rows.length} ${level}${rows.length === 1 ? '' : 's'}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${level}…`} className="w-full max-w-xs rounded-lg border border-input bg-background/60 px-3 py-1.5 text-sm outline-none transition focus:border-primary" />
          <Button size="sm" variant="glass" magnetic={false} onClick={exportCsv}><Download className="h-4 w-4" /> Export</Button>
        </div>
        {geo.isLoading ? (
          <div className="skeleton h-40 rounded-xl" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No geographic data in this range yet — populates as visitors browse (geo resolves from IP; localhost is skipped).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium capitalize">{level}</th>
                  <th className="py-2 pr-3 text-right font-medium">Visitors</th>
                  <th className="py-2 pr-3 text-right font-medium">Sessions</th>
                  <th className="py-2 pr-3 text-right font-medium">Views</th>
                  <th className="py-2 pr-3 text-right font-medium">New</th>
                  <th className="py-2 text-right font-medium">Returning</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const drillable = level !== 'city';
                  return (
                    <tr key={r.name} className={cn('border-b border-border/40 last:border-0', drillable && 'cursor-pointer hover:bg-muted/40')} onClick={() => drillable && drill(r.name)}>
                      <td className="py-2 pr-3 font-medium">{r.name}{drillable && <span className="ml-1 text-muted-foreground">›</span>}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{number(r.visitors)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{number(r.sessions)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{number(r.pageviews)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{number(r.newVisitors)}</td>
                      <td className="py-2 text-right tabular-nums">{number(r.returningVisitors)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
