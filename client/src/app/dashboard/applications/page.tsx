'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import {
  applicationsApi, APPLICATION_STATUSES, APPLICATION_PAYMENT_STATUSES,
  PAYMENT_LABELS, PAYMENT_TONES, STATUS_LABELS, STATUS_TONES,
  type ApplicationListParams, type ApplicationRow,
} from '@/lib/applications.api';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

const controlCls =
  'h-10 rounded-xl border border-input bg-card/60 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

const SORTS = [
  { label: 'Newest first', value: '-submittedAt' },
  { label: 'Oldest first', value: 'submittedAt' },
  { label: 'Name A–Z', value: 'fullName' },
  { label: 'Name Z–A', value: '-fullName' },
];

export default function ApplicationsPage() {
  const isAdmin = useAuth((s) => s.user?.role) === 'super_admin';
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('-submittedAt');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Debounce so we aren't firing a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo<ApplicationListParams>(() => {
    const p: ApplicationListParams = { page, limit: 15, sort };
    // An unselected filter must be absent, not an empty string — the server's
    // validator drops '' and the filter would otherwise match nothing.
    if (q) p.q = q;
    if (status) p.status = status as ApplicationListParams['status'];
    if (paymentStatus) p.paymentStatus = paymentStatus as ApplicationListParams['paymentStatus'];
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [page, sort, q, status, paymentStatus, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', params],
    queryFn: () => applicationsApi.list(params),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Applications" />
        <GlassCard><p className="text-sm text-muted-foreground">This area is available to platform administrators.</p></GlassCard>
      </div>
    );
  }

  const doExport = async () => {
    setExporting(true);
    // Export what is on screen: an export that ignores the filters is a
    // different dataset from the one the admin is looking at.
    const { page: _page, limit: _limit, ...filters } = params;
    try { await applicationsApi.exportApplications({ ...filters, format: 'csv' }); toast.success('Exported CSV'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const filtered = Boolean(q || status || paymentStatus || from || to);

  const columns: Column<ApplicationRow>[] = [
    {
      key: 'applicationId',
      header: 'Application ID',
      render: (r) => <span className="whitespace-nowrap font-mono text-xs">{r.applicationId}</span>,
    },
    {
      key: 'applicant',
      header: 'Applicant',
      render: (r) => (
        <div className="min-w-[160px]">
          <p className="font-medium">{r.fullName}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      ),
    },
    { key: 'mobile', header: 'Mobile', render: (r) => <span className="whitespace-nowrap text-sm">{r.mobile}</span> },
    {
      key: 'preferredJobRole',
      header: 'Preferred role',
      render: (r) => r.preferredJobRole || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (r) => {
        const s = r.payment?.status ?? 'unpaid';
        return (
          <Badge tone={PAYMENT_TONES[s]} className="whitespace-nowrap normal-case">
            {/* An unverified claim gets a warning glyph as well as a warning tone —
                tone alone is invisible to a colour-blind reviewer. */}
            {s === 'claimed' && <AlertTriangle className="h-3 w-3" />}
            {PAYMENT_LABELS[s]}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={STATUS_TONES[r.status]} className="whitespace-nowrap normal-case">{STATUS_LABELS[r.status]}</Badge>,
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (r) => <span className="whitespace-nowrap text-muted-foreground">{date(r.submittedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: () => <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Applications"
        description="Interview applications submitted from the public site — review, verify payment, and decide."
        action={
          <Button size="sm" variant="glass" magnetic={false} loading={exporting} onClick={doExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, role…"
            className={cn(controlCls, 'w-full pl-9')}
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={controlCls} aria-label="Filter by status">
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className={controlCls} aria-label="Filter by payment">
          <option value="">Any payment</option>
          {APPLICATION_PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_LABELS[s]}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={controlCls} aria-label="Sort">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={cn(controlCls, 'w-full')} aria-label="Submitted from" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={cn(controlCls, 'w-full')} aria-label="Submitted to" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => r._id}
        onRowClick={(r) => router.push(`/dashboard/applications/${r._id}`)}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
        emptyText={filtered ? 'No applications match these filters' : 'No applications yet'}
      />
    </div>
  );
}
