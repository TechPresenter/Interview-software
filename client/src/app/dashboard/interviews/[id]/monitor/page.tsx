'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Pause, Play, Square, Wifi, WifiOff, ShieldCheck, ShieldAlert,
  Video, Mic, Activity, Clock, Gauge,
} from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const LIVE = ['in_progress', 'flagged', 'paused'];
const FINISHED = ['completed', 'terminated', 'cancelled', 'expired'];

export default function InterviewMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['interview-monitor', id],
    queryFn: () => companyApi.monitor(id),
    refetchInterval: (q: any) => (FINISHED.includes(q.state.data?.status) ? false : 2500),
  });

  const status: string = data?.status ?? 'loading';
  const live = LIVE.includes(status);

  const onDone = (msg: string) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ['interview-monitor', id] }); };
  const onErr = (e: any) => toast.error(e?.response?.data?.message || 'Action failed');

  const pause = useMutation({ mutationFn: () => companyApi.pauseInterview(id), onSuccess: onDone('Interview paused'), onError: onErr });
  const resume = useMutation({ mutationFn: () => companyApi.resumeInterview(id), onSuccess: onDone('Interview resumed'), onError: onErr });
  const terminate = useMutation({ mutationFn: () => companyApi.terminateInterview(id), onSuccess: onDone('Interview terminated'), onError: onErr });

  const integrity = data?.integrityScore ?? 100;
  const integrityTone = integrity >= 80 ? 'text-accent' : integrity >= 50 ? 'text-amber-400' : 'text-destructive';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Live interview monitor"
          description={data ? `${data.candidate?.name ?? 'Candidate'} · ${data.job?.title ?? 'Interview'}` : 'Real-time interview status'}
        />
        <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/interviews')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Status + controls */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cn('relative flex h-3 w-3', !live && 'opacity-40')}>
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
              <span className={cn('relative inline-flex h-3 w-3 rounded-full', live ? 'bg-accent' : 'bg-muted-foreground')} />
            </span>
            <Badge tone={statusTone(status)}>{status.replace('_', ' ')}</Badge>
            {data?.startedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Started {dateTime(data.startedAt)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {status === 'paused' ? (
              <Button size="sm" magnetic={false} loading={resume.isPending} onClick={() => resume.mutate()}>
                <Play className="h-4 w-4" /> Resume
              </Button>
            ) : (
              <Button size="sm" variant="glass" magnetic={false} disabled={!live} loading={pause.isPending} onClick={() => pause.mutate()}>
                <Pause className="h-4 w-4" /> Pause
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              magnetic={false}
              disabled={!live}
              loading={terminate.isPending}
              onClick={() => { if (window.confirm('Force-stop this interview? The candidate will be unable to continue. This cannot be undone.')) terminate.mutate(); }}
            >
              <Square className="h-4 w-4" /> Terminate
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Live metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Gauge} label="Progress" loading={isLoading}>
          <p className="text-2xl font-bold tabular-nums">{data?.progress?.current ?? 0}<span className="text-base text-muted-foreground">/{data?.progress?.total ?? 8}</span></p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full rounded-full bg-gradient-brand" animate={{ width: `${data?.progress?.percent ?? 0}%` }} transition={{ duration: 0.5 }} />
          </div>
        </MetricCard>

        <MetricCard icon={integrity >= 80 ? ShieldCheck : ShieldAlert} label="Integrity score" loading={isLoading}>
          <p className={cn('text-2xl font-bold tabular-nums', integrityTone)}>{integrity}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data?.proctoring?.events ?? 0} events · {data?.proctoring?.high ?? 0} high</p>
        </MetricCard>

        <MetricCard icon={data?.connection === 'connected' ? Wifi : WifiOff} label="Connection" loading={isLoading}>
          <p className={cn('text-lg font-semibold capitalize', data?.connection === 'connected' ? 'text-accent' : data?.connection === 'reconnecting' ? 'text-amber-400' : 'text-muted-foreground')}>
            {data?.connection ?? '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{data?.lastActivityAt ? `Updated ${dateTime(data.lastActivityAt)}` : ''}</p>
        </MetricCard>

        <MetricCard icon={Video} label="Recording" loading={isLoading}>
          <div className="flex items-center gap-4 text-sm">
            <span className={cn('inline-flex items-center gap-1.5', data?.recording?.video ? 'text-accent' : 'text-muted-foreground')}>
              <Video className="h-4 w-4" /> {data?.recording?.video ? 'On' : 'Off'}
            </span>
            <span className={cn('inline-flex items-center gap-1.5', data?.recording?.audio ? 'text-accent' : 'text-muted-foreground')}>
              <Mic className="h-4 w-4" /> {data?.recording?.audio ? 'On' : 'Off'}
            </span>
          </div>
        </MetricCard>
      </div>

      {/* Live transcript */}
      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Live transcript</h2>
        </div>
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {(data?.transcript ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Waiting for the interview to begin…</p>
          )}
          {(data?.transcript ?? []).map((t: any, i: number) => (
            <div key={i} className={cn('flex', t.role === 'candidate' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                t.role === 'candidate' ? 'bg-primary/15 text-foreground' : 'border border-border bg-card/60',
              )}>
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.role === 'candidate' ? 'Candidate' : 'AI Interviewer'}</p>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function MetricCard({ icon: Icon, label, loading, children }: { icon: any; label: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <GlassCard>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" /> {label}
      </div>
      {loading ? <div className="h-8 w-20 animate-pulse rounded bg-muted" /> : children}
    </GlassCard>
  );
}
