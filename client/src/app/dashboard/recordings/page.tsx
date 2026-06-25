'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle, ShieldAlert, FileText, Film, Download } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { companyApi } from '@/lib/company.api';
import { dateTime, titleCase } from '@/lib/format';
import { downloadFile } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
const REC_TONE: Record<string, any> = { strong_hire: 'success', hire: 'success', consider: 'warning', reject: 'danger' };

export default function RecordingsPage() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === 'super_admin';
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recordings', isAdmin, page],
    queryFn: () => (isAdmin ? adminApi.recordings({ page, limit: 10 }) : companyApi.recordings({ page, limit: 10 })),
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['recording', isAdmin, openId],
    queryFn: () => (isAdmin ? adminApi.recordingDetail(openId!) : companyApi.interview(openId!)),
    enabled: Boolean(openId),
  });

  const columns: Column<any>[] = [
    { key: 'candidate', header: 'Candidate', render: (r) => <div><p className="font-medium">{r.candidate?.name ?? '—'}</p><p className="text-xs text-muted-foreground">{r.candidate?.email}</p></div> },
    { key: 'job', header: 'Job', render: (r) => r.job?.title ?? '—' },
    ...(isAdmin ? [{ key: 'company', header: 'Company', render: (r: any) => r.company?.name ?? '—' }] : []),
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'integrity', header: 'Integrity', render: (r) => <span className={r.integrityScore < 70 ? 'text-destructive' : ''}>{r.integrityScore ?? '—'}</span> },
    { key: 'score', header: 'Score', render: (r) => r.report?.overallScore != null ? <span className="font-bold text-gradient">{r.report.overallScore}</span> : '—' },
    { key: 'completedAt', header: 'Completed', render: (r) => dateTime(r.completedAt) },
    {
      key: 'a',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-3">
          {r.videoUrl && (
            <button
              onClick={() => downloadFile(`${API_ORIGIN}${r.videoUrl}`, `interview-${r.candidate?.name || 'recording'}.webm`)}
              title="Download recording"
              className="text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setOpenId(r._id)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <PlayCircle className="h-4 w-4" /> Review
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Recordings" description="Review interview video, transcripts, scores, and integrity." />
      <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} emptyText="No completed interviews to review yet" rowKey={(r) => r._id} page={data?.meta.page} pages={data?.meta.pages} total={data?.meta.total} onPageChange={setPage} />

      <Modal open={Boolean(openId)} onClose={() => setOpenId(null)} title="Interview review">
        {loadingDetail || !detail ? (
          <div className="space-y-3"><div className="skeleton h-48 w-full rounded-xl" /><div className="skeleton h-4 w-1/2" /></div>
        ) : (
          <div className="space-y-5">
            {detail.recordings?.videoUrl ? (
              <div>
                <video src={`${API_ORIGIN}${detail.recordings.videoUrl}`} controls className="w-full rounded-xl bg-black" />
                <Button
                  size="sm"
                  variant="glass"
                  magnetic={false}
                  className="mt-3"
                  onClick={() => downloadFile(`${API_ORIGIN}${detail.recordings.videoUrl}`, `interview-${detail.candidate?.name || 'recording'}.webm`)}
                >
                  <Download className="h-4 w-4" /> Download recording
                </Button>
              </div>
            ) : (
              <div className="grid h-40 place-items-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground"><div className="text-center"><Film className="mx-auto h-6 w-6" /><p className="mt-2">No video recording captured</p></div></div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{detail.candidate?.name}</span>
              <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
              {detail.report?.recommendation && <Badge tone={REC_TONE[detail.report.recommendation] || 'muted'}>{titleCase(detail.report.recommendation)}</Badge>}
              {detail.report?.overallScore != null && <Badge>Overall {detail.report.overallScore}</Badge>}
              {detail.proctoring?.integrityScore != null && <Badge tone={detail.proctoring.integrityScore < 70 ? 'danger' : 'success'}>Integrity {detail.proctoring.integrityScore}</Badge>}
            </div>

            {detail.report?.scores && (
              <GlassCard className="p-4">
                <p className="mb-3 text-sm font-semibold">Competency scores</p>
                <div className="space-y-2">
                  {Object.entries(detail.report.scores).filter(([, v]) => v != null).map(([k, v]: any) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs"><span className="capitalize text-muted-foreground">{k.replace(/([A-Z])/g, ' $1')}</span><span>{v}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" style={{ width: `${v}%` }} /></div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {Array.isArray(detail.proctoring?.events) && detail.proctoring.events.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive"><ShieldAlert className="h-4 w-4" /> Suspicious activity ({detail.proctoring.events.length})</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {detail.proctoring.events.slice(0, 12).map((e: any, i: number) => <li key={i}>{titleCase(e.type)} · {e.severity} · {new Date(e.at).toLocaleTimeString()}</li>)}
                </ul>
              </div>
            )}

            {Array.isArray(detail.transcript) && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> Transcript</p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
                  {detail.transcript.map((t: any, i: number) => (
                    <div key={i} className={t.role === 'ai' ? 'rounded-lg bg-primary/10 px-3 py-2' : 'rounded-lg bg-muted/50 px-3 py-2'}>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.role === 'ai' ? 'Interviewer' : t.role === 'candidate' ? 'Candidate' : 'System'}</span>
                      <p>{t.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
