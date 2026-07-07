'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { date, titleCase } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const REC_TONE: Record<string, any> = {
  strong_hire: 'success',
  hire: 'success',
  consider: 'warning',
  reject: 'danger',
};

export default function ReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['reports', page], queryFn: () => companyApi.reports({ page, limit: 10 }) });
  const { data: analytics } = useQuery({ queryKey: ['report-analytics'], queryFn: companyApi.reportAnalytics });

  const exportRanking = async () => {
    try {
      await companyApi.exportRanking();
      toast.success('Ranking exported');
    } catch {
      toast.error('Export failed');
    }
  };
  const exportOne = async (id: string) => {
    try {
      await companyApi.exportReport(id);
    } catch {
      toast.error('Export failed');
    }
  };

  const columns: Column<any>[] = [
    { key: 'candidate', header: 'Candidate', render: (r) => r.candidate?.name ?? '—' },
    { key: 'job', header: 'Job', render: (r) => r.job?.title ?? '—' },
    {
      key: 'overallScore',
      header: 'Overall',
      render: (r) => <span className="text-lg font-bold text-gradient">{r.overallScore ?? '—'}</span>,
    },
    {
      key: 'recommendation',
      header: 'Recommendation',
      render: (r) => <Badge tone={REC_TONE[r.recommendation] || 'muted'}>{titleCase(r.recommendation || 'n/a')}</Badge>,
    },
    { key: 'createdAt', header: 'Date', render: (r) => date(r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); exportOne(r._id); }} title="Export PDF" className="text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />
        </button>
      ),
    },
  ];

  const recCounts: Record<string, number> = {};
  for (const b of analytics?.byRecommendation ?? []) recCounts[b._id] = b.count;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="AI evaluations, ranking, and analytics."
        action={
          <Button size="sm" variant="glass" magnetic={false} onClick={exportRanking}>
            <FileSpreadsheet className="h-4 w-4" /> Export ranking (Excel)
          </Button>
        }
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {['strong_hire', 'hire', 'consider', 'reject'].map((rec) => (
          <GlassCard key={rec}>
            <p className="text-sm capitalize text-muted-foreground">{titleCase(rec)}</p>
            <p className="mt-2 text-2xl font-bold">{recCounts[rec] ?? 0}</p>
          </GlassCard>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        emptyText="No reports yet — they appear once interviews are completed."
        rowKey={(r) => r._id}
        onRowClick={(r) => router.push(`/dashboard/reports/${r._id}`)}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />
    </div>
  );
}
