'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Trash2, Users } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { date, titleCase } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/toast';

const STATUS = ['draft', 'open', 'paused', 'closed'];

export default function JobsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', department: '', location: '', status: 'open', description: '', skills: '' });

  const { data, isLoading } = useQuery({ queryKey: ['jobs', page], queryFn: () => companyApi.jobs({ page, limit: 10 }) });

  const reset = () => setForm({ title: '', department: '', location: '', status: 'open', description: '', skills: '' });

  const create = useMutation({
    mutationFn: () =>
      companyApi.createJob({
        title: form.title,
        department: form.department || undefined,
        location: form.location || undefined,
        status: form.status,
        description: form.description || undefined,
        skills: form.skills
          ? form.skills.split(',').map((s) => ({ name: s.trim() })).filter((s) => s.name)
          : [],
      }),
    onSuccess: () => {
      toast.success('Job created');
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const clone = useMutation({
    mutationFn: (id: string) => companyApi.cloneJob(id),
    onSuccess: () => {
      toast.success('Job cloned');
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => companyApi.deleteJob(id),
    onSuccess: () => {
      toast.success('Job deleted');
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const columns: Column<any>[] = [
    {
      key: 'title',
      header: 'Job',
      render: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted-foreground">{[r.department, r.location].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    {
      key: 'candidateCount',
      header: 'Candidates',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="h-4 w-4" /> {r.candidateCount ?? 0}
        </span>
      ),
    },
    { key: 'createdAt', header: 'Created', render: (r) => date(r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-3">
          <button onClick={() => clone.mutate(r._id)} title="Clone" className="text-muted-foreground hover:text-foreground">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={() => del.mutate(r._id)} title="Delete" className="text-destructive hover:text-destructive/80">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Create and manage open roles."
        action={
          <Button size="sm" magnetic={false} onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New job
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
        title="Create job"
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department" value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))} />
            <Field label="Location" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
          </div>
          <Select label="Status" value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={STATUS.map((s) => ({ label: titleCase(s), value: s }))} />
          <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => setForm((f) => ({ ...f, skills: v }))} placeholder="react, node, system-design" />
          <Textarea label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
        </div>
      </Modal>
    </div>
  );
}
