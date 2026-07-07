'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Mail, MessageSquare, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { adminApi } from '@/lib/admin.api';
import { date } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const STATUSES = ['new', 'in_progress', 'resolved', 'archived'] as const;
const controlCls = 'h-10 rounded-xl border border-input bg-card/60 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

export default function EnquiriesPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'super_admin';
  const qc = useQueryClient();

  const [type, setType] = useState<'' | 'contact' | 'newsletter'>('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<any | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { page, limit: 15 };
    if (type) p.type = type;
    if (status) p.status = status;
    if (q) p.search = q;
    return p;
  }, [page, type, status, q]);

  const { data: stats } = useQuery({ queryKey: ['lead-stats'], queryFn: adminApi.leadStats, enabled: isAdmin });
  const { data, isLoading } = useQuery({ queryKey: ['leads', params], queryFn: () => adminApi.leads(params), enabled: isAdmin });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['lead-stats'] });
  };

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Enquiries" />
        <GlassCard><p className="text-sm text-muted-foreground">This area is available to platform administrators.</p></GlassCard>
      </div>
    );
  }

  const columns: Column<any>[] = [
    { key: 'type', header: 'Type', render: (r) => <Badge tone={r.type === 'newsletter' ? 'info' : 'default'}>{r.type}</Badge> },
    {
      key: 'who',
      header: 'From',
      render: (r) => (
        <div>
          <p className="font-medium">{r.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      ),
    },
    { key: 'subject', header: 'Subject', render: (r) => r.subject || (r.type === 'newsletter' ? 'Newsletter signup' : '—') },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{String(r.status).replace('_', ' ')}</Badge> },
    { key: 'createdAt', header: 'Received', render: (r) => <span className="text-muted-foreground">{date(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Enquiries & subscribers" description="Contact-form submissions and newsletter signups from the website." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats?.total ?? 0} icon={Inbox} />
        <StatCard label="Enquiries" value={stats?.contact ?? 0} icon={MessageSquare} />
        <StatCard label="Subscribers" value={stats?.newsletter ?? 0} icon={Mail} />
        <StatCard label="Unread" value={stats?.unread ?? 0} icon={Inbox} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, subject…" className={cn(controlCls, 'w-64 pl-9')} />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value as any); setPage(1); }} className={controlCls}>
          <option value="">All types</option>
          <option value="contact">Contact enquiries</option>
          <option value="newsletter">Newsletter</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={controlCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        emptyText="No enquiries yet"
        rowKey={(r) => r._id}
        onRowClick={(r) => setActive(r)}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />

      <LeadModal lead={active} onClose={() => setActive(null)} onChanged={refresh} />
    </div>
  );
}

function LeadModal({ lead, onClose, onChanged }: { lead: any | null; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) { setStatus(lead.status); setNotes(lead.notes || ''); }
  }, [lead]);

  if (!lead) return null;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateLead(lead._id, { status, notes });
      toast.success('Enquiry updated');
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm('Delete this record permanently?')) return;
    try {
      await adminApi.deleteLead(lead._id);
      toast.success('Deleted');
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  const rows = ([
    ['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone], ['Country', lead.country],
    ['Company', lead.company], ['Job title', lead.jobTitle], ['Subject', lead.subject], ['Source', lead.source],
  ] as [string, any][]).filter(([, v]) => v);

  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      title={lead.type === 'newsletter' ? 'Newsletter subscriber' : 'Contact enquiry'}
      description={date(lead.createdAt)}
      footer={
        <>
          <Button variant="ghost" magnetic={false} onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button magnetic={false} loading={saving} onClick={save}>Save changes</Button>
        </>
      }
    >
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-words">
              {k === 'Email' ? <a href={`mailto:${v}`} className="text-primary hover:underline">{v}</a> : String(v)}
            </dd>
          </Fragment>
        ))}
      </dl>

      {lead.message && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Message</p>
          <p className="mt-1 whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-sm">{lead.message}</p>
        </div>
      )}

      <div className="mt-5">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-card/60 px-3 text-sm outline-none focus:border-primary">
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Internal notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-input bg-card/60 px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>
    </Modal>
  );
}
