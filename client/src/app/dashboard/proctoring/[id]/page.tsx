'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Monitor, Globe, ShieldAlert, Eye, Camera, Clock, ScanFace,
} from 'lucide-react';
import { proctoringApi, evidenceUrl } from '@/lib/proctoring.api';
import { useAuth } from '@/store/auth.store';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const RISK: Record<string, { label: string; color: string; badge: any }> = {
  safe: { label: 'Safe', color: 'hsl(var(--accent))', badge: 'success' },
  low: { label: 'Low', color: 'hsl(199 89% 48%)', badge: 'info' },
  medium: { label: 'Medium', color: 'hsl(38 92% 50%)', badge: 'warning' },
  high: { label: 'High', color: 'hsl(24 95% 53%)', badge: 'warning' },
  critical: { label: 'Critical', color: 'hsl(var(--destructive))', badge: 'danger' },
};
const fraudColor = (s: number) => (s <= 20 ? RISK.safe.color : s <= 40 ? RISK.low.color : s <= 60 ? RISK.medium.color : s <= 80 ? RISK.high.color : RISK.critical.color);
const humanize = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const SEV_DOT: Record<string, string> = { high: 'bg-destructive', medium: 'bg-amber-400', low: 'bg-muted-foreground' };

function Gauge({ score }: { score: number }) {
  const r = 62, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: 150, height: 150 }}>
      <svg viewBox="0 0 150 150" className="-rotate-90 h-[150px] w-[150px]">
        <circle cx="75" cy="75" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="11" />
        <motion.circle cx="75" cy="75" r={r} fill="none" stroke={fraudColor(pct)} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (pct / 100) * c }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-extrabold tabular-nums" style={{ color: fraudColor(pct) }}>{pct}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">fraud score</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '') return null;
  return <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

export default function ProctoringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const admin = useAuth((s) => s.user?.role) === 'super_admin';

  const { data, isLoading } = useQuery({ queryKey: ['proctoring-detail', admin, id], queryFn: () => proctoringApi.detail(admin, id) });

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/proctoring')}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <GlassCard><p className="text-sm text-muted-foreground">Session not found.</p></GlassCard>
    </div>
  );

  const p = data.proctoring || {};
  const device = p.device || {};
  const net = p.network || {};
  const identity = p.identity || {};
  const events = [...(p.events || [])].sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const evidence = p.evidence || [];
  const summary = Object.entries(data.eventSummary || {}).sort((a: any, b: any) => b[1] - a[1]);
  const maxCount = Math.max(1, ...summary.map(([, n]: any) => n));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Proctoring Session" description={`${data.candidate?.name ?? 'Candidate'}${data.job?.title ? ` · ${data.job.title}` : ''}`} />
        <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/proctoring')}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      {/* Score summary */}
      <GlassCard>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Gauge score={data.fraudScore ?? 0} />
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Risk level', <Badge key="r" tone={RISK[data.riskLevel]?.badge || 'muted'}>{RISK[data.riskLevel]?.label || data.riskLevel}</Badge>],
              ['Integrity', `${data.integrityScore ?? 100}%`],
              ['Attention', data.attentionScore != null ? `${data.attentionScore}%` : '—'],
              ['Eye contact', p.eyeContactPct != null ? `${p.eyeContactPct}%` : '—'],
            ].map(([l, v], i) => (
              <div key={i} className="rounded-xl border border-border bg-card/50 p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 text-lg font-bold">{v}</p>
              </div>
            ))}
            <div className="rounded-xl border border-border bg-card/50 p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Candidate</p>
              <p className="mt-1 text-sm font-medium">{data.candidate?.name} · {data.candidate?.email}</p>
              {admin && data.company?.name && <p className="text-xs text-muted-foreground">{data.company.name}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Timing</p>
              <p className="mt-1 text-sm">{data.startedAt ? dateTime(data.startedAt) : '—'} {data.completedAt ? `→ ${dateTime(data.completedAt)}` : ''}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Device */}
        <GlassCard>
          <div className="mb-2 flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" /><h2 className="font-semibold">Device & browser</h2></div>
          <InfoRow label="Browser" value={[device.browser, device.browserVersion].filter(Boolean).join(' ')} />
          <InfoRow label="OS" value={device.os} />
          <InfoRow label="Device" value={device.deviceType} />
          <InfoRow label="Screen" value={device.screenResolution} />
          <InfoRow label="Viewport" value={device.viewport} />
          <InfoRow label="CPU cores" value={device.cpuCores} />
          <InfoRow label="RAM" value={device.ram ? `${device.ram} GB` : undefined} />
          <InfoRow label="Timezone" value={device.timezone} />
          <InfoRow label="Language" value={device.language} />
        </GlassCard>

        {/* Network */}
        <GlassCard>
          <div className="mb-2 flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><h2 className="font-semibold">Network & location</h2></div>
          <InfoRow label="IP" value={net.ip} />
          <InfoRow label="Location" value={[net.city, net.region, net.country].filter(Boolean).join(', ')} />
          <InfoRow label="ISP" value={net.isp} />
          <InfoRow label="Network" value={net.networkType} />
          <InfoRow label="Downlink" value={net.downlinkMbps ? `${net.downlinkMbps} Mbps` : undefined} />
          <InfoRow label="VPN / Proxy" value={net.vpn ? <Badge tone="danger">Detected</Badge> : <Badge tone="success">No</Badge>} />
          <InfoRow label="Coordinates" value={net.lat != null ? `${net.lat}, ${net.lng}` : undefined} />
        </GlassCard>

        {/* Identity (Phase 2) */}
        <GlassCard>
          <div className="mb-2 flex items-center gap-2"><ScanFace className="h-5 w-5 text-primary" /><h2 className="font-semibold">Identity</h2></div>
          {identity.verified || identity.faceMatch != null || identity.livenessPassed != null ? (
            <>
              <InfoRow label="Verified" value={identity.verified ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">No</Badge>} />
              <InfoRow label="Face match" value={identity.faceMatch != null ? `${identity.faceMatch}%` : undefined} />
              <InfoRow label="Liveness" value={identity.livenessPassed != null ? (identity.livenessPassed ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Failed</Badge>) : undefined} />
              <InfoRow label="Method" value={identity.method} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Face verification & liveness run in the interview (Phase 2). No identity data captured for this session.</p>
          )}
        </GlassCard>
      </div>

      {/* Event breakdown + timeline */}
      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard>
          <div className="mb-4 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /><h2 className="font-semibold">Event breakdown</h2></div>
          {summary.length ? (
            <div className="space-y-3">
              {summary.map(([type, n]: any) => (
                <div key={type}>
                  <div className="mb-1 flex justify-between text-xs"><span>{humanize(type)}</span><span className="font-medium tabular-nums">{n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" style={{ width: `${(n / maxCount) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No events recorded.</p>}
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><h2 className="font-semibold">Event timeline</h2></div>
          <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
            {events.length === 0 && <p className="text-sm text-muted-foreground">No events recorded for this session.</p>}
            {events.slice(0, 200).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/40 pb-2 text-sm last:border-0">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', SEV_DOT[e.severity] || SEV_DOT.low)} />
                <span className="min-w-0 flex-1 truncate">{humanize(e.type)}{e.detail?.people ? ` (${e.detail.people} people)` : ''}{e.detail?.level ? ` · ${e.detail.level}%` : ''}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Evidence */}
      <GlassCard>
        <div className="mb-4 flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /><h2 className="font-semibold">Evidence ({evidence.length})</h2></div>
        {evidence.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {evidence.map((ev: any, i: number) => (
              <a key={i} href={evidenceUrl(ev.url)} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border border-border">
                <img src={evidenceUrl(ev.url)} alt={ev.reason} className="aspect-video w-full bg-muted object-cover transition group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/60 px-2 py-1 text-[10px] text-white">
                  <Eye className="h-3 w-3" /> {humanize(ev.reason || ev.type)}
                </div>
              </a>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No screenshots captured for this session.</p>}
      </GlassCard>
    </div>
  );
}
