'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, ShieldCheck, CheckCircle2, XCircle, Lightbulb, MessageSquare,
  Sparkles, Loader2, ChevronDown,
} from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { dateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { toast } from '@/components/ui/toast';

const COMPETENCIES: [string, string][] = [
  ['technical', 'Technical'],
  ['communication', 'Communication'],
  ['problemSolving', 'Problem Solving'],
  ['behavioral', 'Behavioral'],
  ['confidence', 'Confidence'],
  ['leadership', 'Leadership'],
  ['culturalFit', 'Cultural Fit'],
];

const REC: Record<string, { label: string; tone: any }> = {
  strong_hire: { label: 'Strong Hire', tone: 'success' },
  hire: { label: 'Hire', tone: 'success' },
  consider: { label: 'Consider', tone: 'warning' },
  reject: { label: 'Not Recommended', tone: 'danger' },
};

const scoreColor = (s: number) => (s >= 80 ? 'hsl(var(--accent))' : s >= 50 ? 'hsl(38 92% 50%)' : 'hsl(var(--destructive))');

function ScoreRing({ score, size = 168 }: { score: number; size?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <motion.circle
          cx="80" cy="80" r={r} fill="none" stroke={scoreColor(pct)} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-extrabold tabular-nums"><AnimatedCounter value={pct} /></p>
        <p className="text-xs text-muted-foreground">out of 100</p>
      </div>
    </div>
  );
}

function ListCard({ icon: Icon, title, items, tone }: { icon: any; title: string; items?: string[]; tone: string }) {
  return (
    <GlassCard className="h-full">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('h-5 w-5', tone)} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items && items.length ? (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-2"><span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', tone.replace('text-', 'bg-'))} /> {t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">None noted.</p>
      )}
    </GlassCard>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showTranscript, setShowTranscript] = useState(false);

  const { data: report, isLoading } = useQuery({ queryKey: ['report', id], queryFn: () => companyApi.report(id) });

  const download = useMutation({
    mutationFn: () => companyApi.exportReport(id),
    onError: () => toast.error('Could not generate PDF'),
  });

  if (isLoading) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!report) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/reports')}><ArrowLeft className="h-4 w-4" /> Back to reports</Button>
        <GlassCard><p className="text-sm text-muted-foreground">Report not found.</p></GlassCard>
      </div>
    );
  }

  const rec = REC[report.recommendation] || { label: titleCase(report.recommendation || 'N/A'), tone: 'muted' };
  const scores = report.scores || {};
  const skills = COMPETENCIES.map(([k, label]) => ({ key: k, label, value: Math.round(scores[k] ?? 0) })).filter((s) => s.value > 0 || scores[s.key] != null);
  const transcript: any[] = report.interview?.transcript || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Interview Report"
          description={`${report.candidate?.name ?? 'Candidate'} · ${report.job?.title ?? 'Interview'}`}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/reports')}><ArrowLeft className="h-4 w-4" /> Back</Button>
          <Button size="sm" magnetic={false} loading={download.isPending} onClick={() => download.mutate()}><Download className="h-4 w-4" /> Download PDF</Button>
        </div>
      </div>

      {/* Overall performance */}
      <GlassCard>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={report.overallScore ?? 0} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h2 className="text-2xl font-bold">{report.candidate?.name}</h2>
              <Badge tone={rec.tone}>{rec.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{report.candidate?.email}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm sm:justify-start">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> {report.job?.title || 'Role'}</span>
              {typeof report.integrityScore === 'number' && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" /> Integrity {report.integrityScore}</span>
              )}
              {report.interview?.completedAt && (
                <span className="text-muted-foreground">Completed {dateTime(report.interview.completedAt)}</span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Skill-wise breakdown */}
      <GlassCard>
        <h2 className="mb-5 text-lg font-semibold">Skill-wise breakdown</h2>
        {skills.length ? (
          <div className="space-y-4">
            {skills.map((s, i) => (
              <div key={s.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="font-semibold tabular-nums" style={{ color: scoreColor(s.value) }}>{s.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: scoreColor(s.value) }}
                    initial={{ width: 0 }} whileInView={{ width: `${s.value}%` }} viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No competency scores available.</p>
        )}
      </GlassCard>

      {/* Strengths / weaknesses / improvement */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ListCard icon={CheckCircle2} title="Strengths" items={report.strengths} tone="text-accent" />
        <ListCard icon={XCircle} title="Weaknesses" items={report.weaknesses} tone="text-destructive" />
        <ListCard icon={Lightbulb} title="Areas to improve" items={report.improvementAreas} tone="text-amber-400" />
      </div>

      {/* Detailed feedback */}
      {report.detailedFeedback && (
        <GlassCard>
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI evaluation & feedback</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{report.detailedFeedback}</p>
        </GlassCard>
      )}

      {/* Interview transcript */}
      {transcript.length > 0 && (
        <GlassCard>
          <button className="flex w-full items-center justify-between" onClick={() => setShowTranscript((s) => !s)}>
            <h2 className="text-lg font-semibold">Interview transcript ({transcript.length})</h2>
            <ChevronDown className={cn('h-5 w-5 transition-transform', showTranscript && 'rotate-180')} />
          </button>
          {showTranscript && (
            <div className="mt-4 space-y-3">
              {transcript.map((t, i) => (
                <div key={i} className={cn('flex', t.role === 'candidate' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm', t.role === 'candidate' ? 'bg-primary/15 text-foreground' : 'border border-border bg-card/60')}>
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.role === 'candidate' ? 'Candidate' : 'AI Interviewer'}</p>
                    {t.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
