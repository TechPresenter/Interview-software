'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Link2, XCircle } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { dateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const TYPES = ['hr', 'technical', 'behavioral', 'aptitude', 'coding'];

export default function InterviewsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [types, setTypes] = useState<string[]>(['hr']);
  const [sendInvite, setSendInvite] = useState(true);

  const { data, isLoading } = useQuery({ queryKey: ['interviews', page], queryFn: () => companyApi.interviews({ page, limit: 10 }) });
  const { data: candidates } = useQuery({ queryKey: ['candidates-mini'], queryFn: () => companyApi.candidates({ limit: 100 }) });

  const schedule = useMutation({
    mutationFn: () => companyApi.schedule({ candidate, types, sendInvite }),
    onSuccess: async (res: any) => {
      toast.success('Interview scheduled');
      if (res?.link && navigator.clipboard) {
        await navigator.clipboard.writeText(res.link);
        toast.info('Link copied to clipboard');
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['interviews'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const invite = useMutation({
    mutationFn: (id: string) => companyApi.invite(id),
    onSuccess: () => toast.success('Invitation sent'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => companyApi.cancelInterview(id),
    onSuccess: () => {
      toast.success('Interview cancelled');
      qc.invalidateQueries({ queryKey: ['interviews'] });
    },
  });

  const copyLink = async (id: string) => {
    const full = await companyApi.interview(id);
    if (full?.link && navigator.clipboard) {
      await navigator.clipboard.writeText(full.link);
      toast.info('Link copied');
    }
  };

  const columns: Column<any>[] = [
    { key: 'candidate', header: 'Candidate', render: (r) => r.candidate?.name ?? '—' },
    { key: 'job', header: 'Job', render: (r) => r.job?.title ?? '—' },
    { key: 'types', header: 'Type', render: (r) => <span className="text-xs">{(r.types || []).map(titleCase).join(', ')}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'scheduledAt', header: 'Scheduled', render: (r) => (r.scheduledAt ? dateTime(r.scheduledAt) : '—') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-3">
          <button onClick={() => copyLink(r._id)} title="Copy link" className="text-muted-foreground hover:text-foreground">
            <Link2 className="h-4 w-4" />
          </button>
          <button onClick={() => invite.mutate(r._id)} title="Send invite" className="text-primary hover:text-primary/80">
            <Send className="h-4 w-4" />
          </button>
          {['scheduled', 'in_progress'].includes(r.status) && (
            <button onClick={() => cancel.mutate(r._id)} title="Cancel" className="text-destructive hover:text-destructive/80">
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const toggleType = (t: string) => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  return (
    <div>
      <PageHeader
        title="Interviews"
        description="Schedule AI interviews and send invitations."
        action={
          <Button size="sm" magnetic={false} onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Schedule
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => r._id}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule interview"
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button magnetic={false} loading={schedule.isPending} disabled={!candidate} onClick={() => schedule.mutate()}>
              Schedule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Candidate"
            value={candidate}
            onChange={setCandidate}
            options={[
              { label: 'Select a candidate…', value: '' },
              ...(candidates?.items ?? []).map((c: any) => ({ label: `${c.name} (${c.email})`, value: c._id })),
            ]}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Interview types</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm transition',
                    types.includes(t) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  {titleCase(t)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Send invitation email immediately
          </label>
        </div>
      </Modal>
    </div>
  );
}
