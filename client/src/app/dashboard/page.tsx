'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  CalendarClock,
  TrendingUp,
  Briefcase,
  CalendarCheck,
  FileBarChart,
} from 'lucide-react';
import { StatTile, type TileColor } from '@/components/ui/StatTile';
import { AreaChart } from '@/components/ui/Charts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { adminApi } from '@/lib/admin.api';
import { companyApi } from '@/lib/company.api';
import { candidateApi } from '@/lib/candidate.api';
import { relativeTime, dateTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/store/auth.store';

const COMPANY_ROLES = ['company_admin', 'recruiter', 'hr_manager'];

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  if (user?.role === 'super_admin') return <SuperAdminOverview name={user.name} />;
  if (user && COMPANY_ROLES.includes(user.role)) return <CompanyOverview name={user.name} />;
  if (user?.role === 'candidate') return <CandidateOverview name={user.name} />;
  return <PlaceholderOverview role={user?.role} name={user?.name} />;
}

/* ── Candidate: live data ──────────────────────────────── */
function CandidateOverview({ name }: { name: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['my-interviews'], queryFn: candidateApi.interviews });
  const { data: notif } = useQuery({ queryKey: ['my-notifications'], queryFn: candidateApi.notifications });

  const cards = [
    { label: 'Upcoming Interviews', value: data?.upcoming?.length ?? 0, icon: CalendarCheck },
    { label: 'Completed', value: data?.completed?.length ?? 0, icon: CalendarClock },
    { label: 'Notifications', value: notif?.unread ?? 0, icon: FileBarChart },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">
          Welcome, <span className="text-gradient">{name?.split(' ')[0]}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Your interviews and updates.</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-3">
        {cards.map((c, i) => (
          <StatTile key={c.label} {...c} color={(['cyan', 'blue', 'violet'] as TileColor[])[i]} loading={isLoading} delay={i * 0.06} />
        ))}
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Next up</h2>
          <Link href="/dashboard/my-interviews"><Button size="sm" variant="ghost" magnetic={false}>View all</Button></Link>
        </div>
        <div className="mt-4 space-y-3">
          {(data?.upcoming ?? []).length === 0 && <p className="text-sm text-muted-foreground">No upcoming interviews. We&apos;ll notify you when one is scheduled.</p>}
          {(data?.upcoming ?? []).slice(0, 3).map((i: any) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium">{i.job}</p>
                <p className="text-xs text-muted-foreground">{i.scheduledAt ? dateTime(i.scheduledAt) : 'Available now'}</p>
              </div>
              {i.link && (
                <a href={i.link} target="_blank" rel="noreferrer">
                  <Button size="sm" magnetic={false}>Start</Button>
                </a>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ── Company roles: live data ──────────────────────────── */
function CompanyOverview({ name }: { name: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['company-overview'], queryFn: companyApi.overview });
  const k = data?.kpis;
  const cards = [
    { label: 'Active Jobs', value: k?.activeJobs ?? 0, icon: Briefcase },
    { label: 'Candidates', value: k?.totalCandidates ?? 0, icon: Users },
    { label: 'Interviews Scheduled', value: k?.interviewsScheduled ?? 0, icon: CalendarClock },
    { label: 'Avg. Score', value: k?.avgScore ?? 0, icon: TrendingUp, suffix: '%' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">
          Welcome back, <span className="text-gradient">{name?.split(' ')[0]}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Your hiring at a glance.</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <StatTile key={c.label} {...c} color={(['blue', 'green', 'orange', 'violet'] as TileColor[])[i]} loading={isLoading} delay={i * 0.06} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Hiring funnel</h2>
          <div className="mt-4 space-y-3">
            {(data?.funnel ?? []).map((f: any) => {
              const max = Math.max(1, ...(data?.funnel ?? []).map((x: any) => x.count));
              return (
                <div key={f.stage} className="flex items-center gap-3">
                  <span className="w-24 text-sm capitalize text-muted-foreground">{f.stage}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${(f.count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums">{f.count}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold">Plan usage</h2>
          <div className="mt-4 space-y-4 text-sm">
            <Usage label="Active jobs" used={data?.usage?.usage?.activeJobs} limit={data?.usage?.limits?.activeJobs} />
            <Usage label="Interviews (mo)" used={data?.usage?.usage?.interviewsThisMonth} limit={data?.usage?.limits?.interviewsPerMonth} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Usage({ label, used = 0, limit }: { label: string; used?: number; limit?: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span>{used}{limit != null ? ` / ${limit}` : ''}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${pct > 90 ? 'bg-destructive' : 'bg-gradient-brand'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Super admin: live data ────────────────────────────── */
function SuperAdminOverview({ name }: { name: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: adminApi.overview });
  const { data: health } = useQuery({ queryKey: ['admin-health'], queryFn: adminApi.health, refetchInterval: 15000 });
  const { data: activity } = useQuery({ queryKey: ['admin-activity'], queryFn: () => adminApi.activity(8) });
  const { data: series } = useQuery({ queryKey: ['admin-timeseries'], queryFn: () => adminApi.timeseries(30) });

  const cards = [
    { label: 'Total Companies', value: data?.totalCompanies ?? 0, icon: Building2 },
    { label: 'Total Candidates', value: data?.totalCandidates ?? 0, icon: Users, compact: true },
    { label: 'Total Interviews', value: data?.totalInterviews ?? 0, icon: CalendarClock, compact: true },
    { label: 'MRR', value: Math.round((data?.mrr ?? 0) / 100), icon: TrendingUp, prefix: '$', compact: true },
  ];
  const interviewSeries = (series?.interviews ?? []).map((d: any) => ({ label: d._id, value: d.count }));
  const revenueSeries = (series?.revenue ?? []).map((d: any) => ({ label: d._id, value: Math.round((d.total ?? 0) / 100) }));

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, <span className="text-gradient">{name?.split(' ')[0]}</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Platform overview.</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={health?.db === 'up' ? 'success' : 'danger'}>DB {health?.db ?? '…'}</Badge>
          <Badge tone={health?.redis === 'up' ? 'success' : 'danger'}>Redis {health?.redis ?? '…'}</Badge>
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <StatTile key={c.label} {...c} color={(['blue', 'green', 'violet', 'orange'] as TileColor[])[i]} loading={isLoading} delay={i * 0.06} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Interviews</h2>
            <span className="text-xs text-muted-foreground">last 30 days</span>
          </div>
          <AreaChart data={interviewSeries} />
        </GlassCard>
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Revenue</h2>
            <span className="text-xs text-muted-foreground">30d</span>
          </div>
          <AreaChart data={revenueSeries} height={150} />
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-lg font-semibold">Live activity</h2>
        <div className="mt-4 space-y-3">
          {(activity ?? []).length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
          {(activity ?? []).map((a: any) => (
            <div key={a._id} className="flex items-center justify-between border-b border-border/40 pb-3 text-sm last:border-0">
              <span>
                <span className="font-medium">{a.actor?.name ?? 'System'}</span>{' '}
                <span className="text-muted-foreground">{a.summary ?? a.action}</span>
              </span>
              <span className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ── Fallback for any role without a dedicated overview ── */
function PlaceholderOverview({ name }: { role?: string; name?: string }) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">
          Welcome back, <span className="text-gradient">{name?.split(' ')[0] ?? 'there'}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s what&apos;s happening today.</p>
      </header>
      <GlassCard>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your role&apos;s overview will appear here.</p>
      </GlassCard>
    </div>
  );
}
