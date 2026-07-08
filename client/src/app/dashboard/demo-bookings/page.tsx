'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Clock, Search, Trash2, Download, History } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { adminApi } from '@/lib/admin.api';
import { date, dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const STATUSES = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled'] as const;
const statusTone = (s: string) => (s === 'confirmed' ? 'success' : s === 'completed' ? 'info' : s === 'cancelled' ? 'danger' : s === 'rescheduled' ? 'default' : 'warning') as any;
const controlCls = 'h-10 rounded-xl border border-input bg-card/60 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

export default function DemoBookingsPage() {
  const isAdmin = useAuth((s) => s.user?.role) === 'super_admin';
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<any | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { page, limit: 15 };
    if (status) p.status = status;
    if (q) p.q = q;
    return p;
  }, [page, status, q]);

  const { data: stats } = useQuery({ queryKey: ['demo-stats'], queryFn: adminApi.demoBookingStats, enabled: isAdmin });
  const { data, isLoading } = useQuery({ queryKey: ['demo-bookings', params], queryFn: () => adminApi.demoBookings(params), enabled: isAdmin });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['demo-bookings'] }); qc.invalidateQueries({ queryKey: ['demo-stats'] }); };

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Demo bookings" />
        <GlassCard><p className="text-sm text-muted-foreground">This area is available to platform administrators.</p></GlassCard>
      </div>
    );
  }

  const doExport = async () => {
    setExporting(true);
    try { await adminApi.exportDemoBookings({ status: status || undefined }); toast.success('Exported CSV'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'who', header: 'Requester', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> },
    { key: 'company', header: 'Company', render: (r) => r.company || '—' },
    { key: 'date', header: 'Preferred', render: (r) => <div className="text-sm">{r.preferredDate ? date(r.preferredDate) : 'TBD'}<p className="text-xs text-muted-foreground">{r.timeSlot || ''}</p></div> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'assigned', header: 'Assigned', render: (r) => r.assignedTo?.name || <span className="text-xs text-muted-foreground">—</span> },
    { key: 'createdAt', header: 'Requested', render: (r) => <span className="text-muted-foreground">{date(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Demo bookings" description="Manage “Book a Demo” requests from the website — assign, schedule, and track." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats?.total ?? 0} icon={CalendarClock} />
        <StatCard label="Pending" value={stats?.byStatus?.pending ?? 0} icon={Clock} />
        <StatCard label="Confirmed" value={stats?.byStatus?.confirmed ?? 0} icon={CheckCircle2} />
        <StatCard label="Completed" value={stats?.byStatus?.completed ?? 0} icon={CheckCircle2} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company…" className={cn(controlCls, 'w-64 pl-9')} />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={controlCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button size="sm" variant="glass" magnetic={false} loading={exporting} onClick={doExport} className="ml-auto"><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <DataTable
        columns={columns} rows={data?.items ?? []} loading={isLoading} emptyText="No demo bookings yet"
        rowKey={(r) => r._id} onRowClick={(r) => setActive(r)}
        page={data?.meta.page} pages={data?.meta.pages} total={data?.meta.total} onPageChange={setPage}
      />

      <BookingModal id={active?._id} onClose={() => setActive(null)} onChanged={refresh} />
    </div>
  );
}

function BookingModal({ id, onClose, onChanged }: { id?: string; onClose: () => void; onChanged: () => void }) {
  const { data: booking } = useQuery({ queryKey: ['demo-booking', id], queryFn: () => adminApi.demoBooking(id as string), enabled: !!id });
  const { data: assignees } = useQuery({ queryKey: ['demo-assignees'], queryFn: adminApi.demoAssignees, enabled: !!id });

  const [status, setStatus] = useState('pending');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setStatus(booking.status || 'pending');
    setAssignedTo(booking.assignedTo?._id || booking.assignedTo || '');
    setNotes(booking.notes || '');
    setPreferredDate(booking.preferredDate ? new Date(booking.preferredDate).toISOString().slice(0, 10) : '');
    setTimeSlot(booking.timeSlot || '');
  }, [booking]);

  if (!id) return null;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateDemoBooking(id, { status, assignedTo: assignedTo || null, notes, preferredDate: preferredDate || null, timeSlot });
      toast.success('Booking updated');
      onChanged();
      onClose();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!window.confirm('Delete this demo booking?')) return;
    try { await adminApi.deleteDemoBooking(id); toast.success('Deleted'); onChanged(); onClose(); }
    catch { toast.error('Delete failed'); }
  };

  const rows = booking ? ([
    ['Name', booking.name], ['Company', booking.company], ['Email', booking.email], ['Phone', booking.phone],
    ['Country', booking.country], ['Timezone', booking.timezone], ['Employees', booking.employees],
  ] as [string, any][]).filter(([, v]) => v) : [];

  return (
    <Modal open={!!id} onClose={onClose} size="2xl" title="Demo booking" description={booking ? date(booking.createdAt) : ''}
      footer={<><Button variant="ghost" magnetic={false} onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button><Button magnetic={false} loading={saving} onClick={save}>Save changes</Button></>}
    >
      {!booking ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-5">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
            {rows.map(([k, v]) => (
              <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{k === 'Email' ? <a href={`mailto:${v}`} className="text-primary hover:underline">{v}</a> : String(v)}</dd></Fragment>
            ))}
          </dl>
          {booking.message && <div><p className="text-xs font-medium text-muted-foreground">Requirements</p><p className="mt-1 whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-sm">{booking.message}</p></div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s }))} />
            <Select label="Assign to" value={assignedTo} onChange={setAssignedTo} options={[{ label: 'Unassigned', value: '' }, ...(assignees ?? []).map((u: any) => ({ label: `${u.name} (${u.role?.replace('_', ' ')})`, value: u._id }))]} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Reschedule date</span>
              <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className={controlCls + ' w-full'} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Time slot</span>
              <input value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} placeholder="e.g. 10:00 – 11:00" className={controlCls + ' w-full'} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Internal notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-input bg-card/60 px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>

          {(booking.activity?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History className="h-3.5 w-3.5" /> Booking history</p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {[...booking.activity].reverse().map((a: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 text-sm last:border-0">
                    <span><span className="font-medium capitalize">{a.action}</span> <span className="text-muted-foreground">— {a.detail}</span>{a.by?.name && <span className="text-xs text-muted-foreground"> · {a.by.name}</span>}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateTime(a.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
