'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Activity, Flag, Gauge, Download, Search } from 'lucide-react';
import { proctoringApi } from '@/lib/proctoring.api';
import { useAuth } from '@/store/auth.store';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatTile } from '@/components/ui/StatTile';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Donut } from '@/components/ui/Charts';
import { toast } from '@/components/ui/toast';

const RISK: Record<string, { label: string; color: string; badge: any }> = {
  safe: { label: 'Safe', color: 'hsl(var(--accent))', badge: 'success' },
  low: { label: 'Low', color: 'hsl(199 89% 48%)', badge: 'info' },
  medium: { label: 'Medium', color: 'hsl(38 92% 50%)', badge: 'warning' },
  high: { label: 'High', color: 'hsl(24 95% 53%)', badge: 'warning' },
  critical: { label: 'Critical', color: 'hsl(var(--destructive))', badge: 'danger' },
};

function fraudColor(score: number) {
  return score <= 20 ? RISK.safe.color : score <= 40 ? RISK.low.color : score <= 60 ? RISK.medium.color : score <= 80 ? RISK.high.color : RISK.critical.color;
}

export default function ProctoringAuditPage() {
  const router = useRouter();
  const role = useAuth((s) => s.user?.role);
  const admin = role === 'super_admin';

  const [page, setPage] = useState(1);
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const params = { page, limit: 12, ...(risk && { riskLevel: risk }), ...(status && { status }) };
  const { data, isLoading } = useQuery({ queryKey: ['proctoring', admin, params], queryFn: () => proctoringApi.list(admin, params) });
  const { data: stats } = useQuery({ queryKey: ['proctoring-stats', admin], queryFn: () => proctoringApi.stats(admin) });

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((r: any) => `${r.candidate?.name ?? ''} ${r.candidate?.email ?? ''} ${r.company?.name ?? ''}`.toLowerCase().includes(s));
  }, [data, q]);

  const segments = useMemo(() => {
    const r = stats?.risk || {};
    return (['critical', 'high', 'medium', 'low', 'safe'] as const)
      .map((k) => ({ label: RISK[k].label, value: r[k] || 0, color: RISK[k].color }))
      .filter((s) => s.value > 0);
  }, [stats]);

  const exportCsv = async () => {
    try { await proctoringApi.exportCsv(admin, { ...(risk && { riskLevel: risk }) }); }
    catch { toast.error('Export failed'); }
  };

  const columns: Column<any>[] = [
    { key: 'candidate', header: 'Candidate', render: (r) => (
      <div><p className="font-medium">{r.candidate?.name ?? '—'}</p><p className="text-xs text-muted-foreground">{r.candidate?.email}</p></div>
    ) },
    ...(admin ? [{ key: 'company', header: 'Company', render: (r: any) => r.company?.name ?? '—' } as Column<any>] : []),
    { key: 'fraud', header: 'Fraud', render: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: fraudColor(r.fraudScore) }}>{r.fraudScore}</span>
        <Badge tone={RISK[r.riskLevel]?.badge || 'muted'}>{RISK[r.riskLevel]?.label || r.riskLevel}</Badge>
      </span>
    ) },
    { key: 'attention', header: 'Attention', render: (r) => (r.attentionScore != null ? `${r.attentionScore}%` : '—') },
    { key: 'events', header: 'Events', render: (r) => r.eventCount },
    { key: 'device', header: 'Device', render: (r) => r.device ? <span className="text-xs">{r.device.browser} · {r.device.os}{r.network?.vpn ? ' · VPN' : ''}</span> : '—' },
    { key: 'started', header: 'Started', render: (r) => (r.startedAt ? date(r.startedAt) : date(r.createdAt)) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proctoring & Anti-Cheat"
        description={admin ? 'Platform-wide interview integrity monitoring.' : 'AI monitoring across your interviews.'}
        action={<Button size="sm" variant="glass" magnetic={false} onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Sessions" value={stats?.total ?? 0} icon={Activity} color="blue" loading={!stats} />
        <StatTile label="Avg. Fraud Score" value={stats?.avgFraud ?? 0} icon={Gauge} color="violet" sub="0–100" loading={!stats} />
        <StatTile label="Flagged" value={stats?.flagged ?? 0} icon={Flag} color="orange" sub="Auto-flagged sessions" loading={!stats} />
        <StatTile label="Total Events" value={stats?.totalEvents ?? 0} icon={ShieldAlert} color="pink" compact loading={!stats} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Sessions</h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-10 w-40 rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="w-36"><Select value={risk} onChange={(v) => { setRisk(v); setPage(1); }} options={[{ label: 'All risk', value: '' }, ...Object.entries(RISK).map(([v, r]) => ({ label: r.label, value: v }))]} /></div>
              <div className="w-36"><Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ label: 'All status', value: '' }, { label: 'Completed', value: 'completed' }, { label: 'Flagged', value: 'flagged' }, { label: 'In progress', value: 'in_progress' }]} /></div>
            </div>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            emptyText="No proctoring sessions yet."
            rowKey={(r) => r._id}
            onRowClick={(r) => router.push(`/dashboard/proctoring/${r._id}`)}
            page={data?.meta?.page}
            pages={data?.meta?.pages}
            total={data?.meta?.total}
            onPageChange={setPage}
          />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 text-lg font-semibold">Risk distribution</h2>
          {segments.length ? (
            <Donut segments={segments} size={150} />
          ) : (
            <div className="grid h-[150px] place-items-center text-sm text-muted-foreground">No data yet.</div>
          )}
          <div className="mt-4 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Average fraud score</span>
              <span className="font-bold tabular-nums" style={{ color: fraudColor(stats?.avgFraud ?? 0) }}>{stats?.avgFraud ?? 0}/100</span>
            </div>
            <div className={cn('mt-2 h-2 overflow-hidden rounded-full bg-muted')}>
              <div className="h-full rounded-full transition-all" style={{ width: `${stats?.avgFraud ?? 0}%`, background: fraudColor(stats?.avgFraud ?? 0) }} />
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
