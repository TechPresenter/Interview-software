'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Ban, CheckCircle2, Search, Pencil } from 'lucide-react';
import { adminApi } from '@/lib/admin.api';
import { date } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const PLAN_OPTIONS = ['free', 'starter', 'professional', 'enterprise'].map((p) => ({
  label: p[0].toUpperCase() + p.slice(1),
  value: p,
}));

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', plan: 'free', adminName: '', adminEmail: '' });
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', website: '', industry: '', plan: 'free', contactEmail: '', billingEmail: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, q],
    queryFn: () => adminApi.companies({ page, q, limit: 10 }),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createCompany(form),
    onSuccess: (res: any) => {
      toast.success('Company created');
      if (res?.tempPassword) toast.info(`Temp admin password: ${res.tempPassword}`);
      setOpen(false);
      setForm({ name: '', plan: 'free', adminName: '', adminEmail: '' });
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create company'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      suspend ? adminApi.suspendCompany(id) : adminApi.activateCompany(id),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const openEdit = (r: any) => {
    setEditing(r);
    setEditForm({
      name: r.name || '',
      website: r.website || '',
      industry: r.industry || '',
      plan: r.plan || 'free',
      contactEmail: r.contactEmail || '',
      billingEmail: r.billingEmail || '',
    });
  };
  const update = useMutation({
    mutationFn: () =>
      adminApi.updateCompany(editing._id, {
        name: editForm.name,
        website: editForm.website || undefined,
        industry: editForm.industry || undefined,
        plan: editForm.plan,
        contactEmail: editForm.contactEmail || undefined,
        billingEmail: editForm.billingEmail || undefined,
      }),
    onSuccess: () => {
      toast.success('Company updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.owner?.email ?? r.slug}</p>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r) => <Badge tone="info">{r.plan}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'createdAt', header: 'Created', render: (r) => date(r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => openEdit(r)} title="Edit" className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          {r.status === 'suspended' ? (
            <button onClick={() => toggle.mutate({ id: r._id, suspend: false })} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              <CheckCircle2 className="h-4 w-4" /> Activate
            </button>
          ) : (
            <button onClick={() => toggle.mutate({ id: r._id, suspend: true })} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
              <Ban className="h-4 w-4" /> Suspend
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Manage tenant workspaces, plans, and access."
        action={
          <Button size="sm" onClick={() => setOpen(true)} magnetic={false}>
            <Plus className="h-4 w-4" /> New company
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 sm:max-w-xs">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Search companies…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

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
        title="Create company"
        description="Provision a workspace and (optionally) its first admin."
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Company name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Select label="Plan" value={form.plan} onChange={(v) => setForm((f) => ({ ...f, plan: v }))} options={PLAN_OPTIONS} />
          <Field label="Admin name (optional)" value={form.adminName} onChange={(v) => setForm((f) => ({ ...f, adminName: v }))} />
          <Field
            label="Admin email (optional)"
            type="email"
            value={form.adminEmail}
            onChange={(v) => setForm((f) => ({ ...f, adminEmail: v }))}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? 'company'}`}
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button>
            <Button magnetic={false} loading={update.isPending} onClick={() => update.mutate()}>Save changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Company name" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Website" value={editForm.website} onChange={(v) => setEditForm((f) => ({ ...f, website: v }))} />
            <Field label="Industry" value={editForm.industry} onChange={(v) => setEditForm((f) => ({ ...f, industry: v }))} />
          </div>
          <Select label="Plan" value={editForm.plan} onChange={(v) => setEditForm((f) => ({ ...f, plan: v }))} options={PLAN_OPTIONS} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact email" type="email" value={editForm.contactEmail} onChange={(v) => setEditForm((f) => ({ ...f, contactEmail: v }))} />
            <Field label="Billing email" type="email" value={editForm.billingEmail} onChange={(v) => setEditForm((f) => ({ ...f, billingEmail: v }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
