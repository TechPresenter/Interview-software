'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, FileText, Trash2, Pencil } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { adminApi } from '@/lib/admin.api';
import { date, titleCase } from '@/lib/format';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const STAGES = ['applied', 'screening', 'interview', 'shortlisted', 'hired', 'rejected'];

export default function CandidatesPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === 'super_admin';

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', skills: '' });
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', stage: 'applied', skills: '' });
  const csvRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', isAdmin, page],
    queryFn: () => (isAdmin ? adminApi.candidates({ page, limit: 10 }) : companyApi.candidates({ page, limit: 10 })),
  });

  const create = useMutation({
    mutationFn: () =>
      companyApi.createCandidate({
        name: form.name, email: form.email, phone: form.phone || undefined,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }),
    onSuccess: () => {
      toast.success('Candidate added'); setOpen(false);
      setForm({ name: '', email: '', phone: '', skills: '' });
      qc.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => companyApi.importCandidates(file),
    onSuccess: (res: any) => { toast.success(`Imported ${res.inserted} candidates${res.skipped ? ` (${res.skipped} skipped)` : ''}`); qc.invalidateQueries({ queryKey: ['candidates'] }); },
    onError: () => toast.error('Import failed'),
  });

  const uploadResume = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => companyApi.uploadResume(id, file),
    onSuccess: (res: any) => { toast.success(res?.analysis ? `Resume analyzed · ATS ${res.analysis.atsScore}, match ${res.analysis.jobMatch}%` : 'Resume uploaded'); qc.invalidateQueries({ queryKey: ['candidates'] }); },
    onError: () => toast.error('Resume upload failed'),
  });

  const openEdit = (r: any) => {
    setEditing(r);
    setEditForm({ name: r.name || '', email: r.email || '', phone: r.phone || '', stage: r.stage || 'applied', skills: (r.skills || []).join(', ') });
  };
  const update = useMutation({
    mutationFn: () => {
      const body = {
        name: editForm.name, email: editForm.email, phone: editForm.phone || undefined, stage: editForm.stage,
        skills: editForm.skills ? editForm.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };
      return isAdmin ? adminApi.updateCandidate(editing._id, body) : companyApi.updateCandidate(editing._id, body);
    },
    onSuccess: () => { toast.success('Candidate updated'); setEditing(null); qc.invalidateQueries({ queryKey: ['candidates'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => (isAdmin ? adminApi.deleteCandidateAdmin(id) : companyApi.deleteCandidate(id)),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['candidates'] }); },
  });

  const columns: Column<any>[] = [
    { key: 'name', header: 'Candidate', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> },
    ...(isAdmin ? [{ key: 'company', header: 'Company', render: (r: any) => r.company?.name ?? '—' }] : []),
    { key: 'job', header: 'Job', render: (r) => r.job?.title ?? '—' },
    { key: 'stage', header: 'Stage', render: (r) => <Badge tone={statusTone(r.stage)}>{r.stage}</Badge> },
    { key: 'ats', header: 'ATS / Match', render: (r) => r.resumeAnalysis?.atsScore != null ? <span className="text-sm">{r.resumeAnalysis.atsScore} · {r.resumeAnalysis.jobMatch}%</span> : <span className="text-xs text-muted-foreground">no resume</span> },
    { key: 'createdAt', header: 'Added', render: (r) => date(r.createdAt) },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-3">
          <button title="Edit" onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
          {!isAdmin && (
            <button title="Upload resume" onClick={() => { targetId.current = r._id; resumeRef.current?.click(); }} className="text-muted-foreground hover:text-foreground"><FileText className="h-4 w-4" /></button>
          )}
          <button onClick={() => del.mutate(r._id)} title="Delete" className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Candidates"
        description={isAdmin ? 'All candidates across every company.' : 'Add, import, and track applicants.'}
        action={
          isAdmin ? undefined : (
            <div className="flex gap-2">
              <Button size="sm" variant="glass" magnetic={false} onClick={() => csvRef.current?.click()}><Upload className="h-4 w-4" /> Import CSV</Button>
              <Button size="sm" magnetic={false} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add candidate</Button>
            </div>
          )
        }
      />

      <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} rowKey={(r) => r._id} page={data?.meta.page} pages={data?.meta.pages} total={data?.meta.total} onPageChange={setPage} />

      <input ref={csvRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ''; }} />
      <input ref={resumeRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && targetId.current) uploadResume.mutate({ id: targetId.current, file: f }); e.target.value = ''; }} />

      {/* Add (company only) */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add candidate" footer={<><Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button><Button magnetic={false} loading={create.isPending} onClick={() => create.mutate()}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => setForm((f) => ({ ...f, skills: v }))} />
          <p className="text-xs text-muted-foreground">CSV columns: name, email, phone, location, skills</p>
        </div>
      </Modal>

      {/* Edit (both roles) */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? 'candidate'}`} footer={<><Button variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button><Button magnetic={false} loading={update.isPending} onClick={() => update.mutate()}>Save changes</Button></>}>
        <div className="space-y-4">
          <Field label="Full name" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
          <Field label="Email" type="email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} />
            <Select label="Stage" value={editForm.stage} onChange={(v) => setEditForm((f) => ({ ...f, stage: v }))} options={STAGES.map((s) => ({ label: titleCase(s), value: s }))} />
          </div>
          <Field label="Skills (comma-separated)" value={editForm.skills} onChange={(v) => setEditForm((f) => ({ ...f, skills: v }))} />
        </div>
      </Modal>
    </div>
  );
}
