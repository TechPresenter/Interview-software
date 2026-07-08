'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, FileText, Trash2, Pencil, Sparkles, Loader2 } from 'lucide-react';
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
const GENDERS = [['', '—'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['prefer_not_to_say', 'Prefer not to say']];
const EMP_TYPES = [['', '—'], ['full_time', 'Full-time'], ['part_time', 'Part-time'], ['contract', 'Contract'], ['internship', 'Internship'], ['remote', 'Remote']];

type Form = Record<string, any>;
const EMPTY: Form = {
  name: '', email: '', phone: '', whatsapp: '', dob: '', gender: '', nationality: '',
  address: '', city: '', state: '', country: '', postalCode: '', linkedin: '', website: '',
  skills: '', languages: '', highestQualification: '', currentCompany: '', currentDesignation: '',
  totalExperienceYears: '', currentSalary: '', expectedSalary: '', noticePeriod: '', preferredLocation: '',
  employmentType: '', stage: 'applied',
  // parsed-only extras (kept as-is, shown as summary):
  education: [], experience: [], certifications: [], projects: [], resume: null, resumeAnalysis: null,
};

/** Coerce the form to the create/update payload. */
function toPayload(f: Form) {
  const list = (v: any) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v : []);
  const out: Form = { ...f };
  out.skills = list(f.skills);
  out.languages = list(f.languages);
  if (f.totalExperienceYears === '' || f.totalExperienceYears == null) delete out.totalExperienceYears;
  else out.totalExperienceYears = Number(f.totalExperienceYears) || undefined;
  // drop empty scalars so we don't send noise
  for (const k of Object.keys(out)) if (out[k] === '' || out[k] == null) delete out[k];
  if (out.resume && !out.resume.url) delete out.resume;
  delete out.resumeAnalysis;
  return out;
}

export default function CandidatesPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === 'super_admin';

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Form>({ ...EMPTY });
  const [parsing, setParsing] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', isAdmin, page],
    queryFn: () => (isAdmin ? adminApi.candidates({ page, limit: 10 }) : companyApi.candidates({ page, limit: 10 })),
  });

  /** Parse an uploaded resume and pre-fill the Add form for review. */
  const autofillFromResume = async (file: File) => {
    setParsing(true);
    try {
      const res = await companyApi.parseResume(file);
      const fields = res?.fields || {};
      setForm((f) => ({
        ...f,
        ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) && ['skills', 'languages'].includes(k) ? (v as string[]).join(', ') : v])),
        resume: res?.resume || f.resume,
        resumeAnalysis: res?.analysis || null,
      }));
      if (res?.warning) toast.info(res.warning);
      else toast.success('Resume parsed — review the pre-filled details before saving.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not parse the resume');
    } finally {
      setParsing(false);
    }
  };

  const create = useMutation({
    mutationFn: () => companyApi.createCandidate(toPayload(form)),
    onSuccess: () => {
      toast.success('Candidate added');
      setOpen(false); setForm({ ...EMPTY });
      qc.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add candidate'),
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
    setEditForm({
      ...EMPTY, ...r,
      skills: (r.skills || []).join(', '),
      languages: (r.languages || []).join(', '),
      totalExperienceYears: r.totalExperienceYears ?? '',
      stage: r.stage || 'applied',
    });
  };
  const update = useMutation({
    mutationFn: () => {
      const body = toPayload(editForm);
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
          <button onClick={() => { if (confirm(`Delete ${r.name}?`)) del.mutate(r._id); }} title="Delete" className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
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
              <Button size="sm" magnetic={false} onClick={() => { setForm({ ...EMPTY }); setOpen(true); }}><Plus className="h-4 w-4" /> Add candidate</Button>
            </div>
          )
        }
      />

      <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} rowKey={(r) => r._id} page={data?.meta.page} pages={data?.meta.pages} total={data?.meta.total} onPageChange={setPage} />

      <input ref={csvRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ''; }} />
      <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && targetId.current) uploadResume.mutate({ id: targetId.current, file: f }); e.target.value = ''; }} />

      {/* Add (company only) */}
      <Modal
        open={open} onClose={() => setOpen(false)} size="3xl" title="Add candidate"
        description="Upload a resume to auto-fill, then review before saving."
        footer={<><Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button><Button magnetic={false} loading={create.isPending} disabled={!form.name || !form.email} onClick={() => create.mutate()}>Add candidate</Button></>}
      >
        <CandidateForm form={form} setForm={setForm} onParse={autofillFromResume} parsing={parsing} showResumeUpload />
      </Modal>

      {/* Edit (both roles) */}
      <Modal
        open={Boolean(editing)} onClose={() => setEditing(null)} size="3xl" title={`Edit ${editing?.name ?? 'candidate'}`}
        footer={<><Button variant="ghost" magnetic={false} onClick={() => setEditing(null)}>Cancel</Button><Button magnetic={false} loading={update.isPending} onClick={() => update.mutate()}>Save changes</Button></>}
      >
        <CandidateForm form={editForm} setForm={setEditForm} showStage />
      </Modal>
    </div>
  );
}

function CandidateForm({
  form, setForm, onParse, parsing, showResumeUpload, showStage,
}: {
  form: Form; setForm: (fn: (f: Form) => Form) => void;
  onParse?: (file: File) => void; parsing?: boolean; showResumeUpload?: boolean; showStage?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string) => (v: any) => setForm((f) => ({ ...f, [k]: v }));
  const counts = [
    ['Education', form.education?.length], ['Experience', form.experience?.length],
    ['Certifications', form.certifications?.length], ['Projects', form.projects?.length],
  ].filter(([, n]) => n) as [string, number][];

  return (
    <div className="space-y-5">
      {showResumeUpload && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Auto-fill the form from a resume (PDF, DOC, DOCX).</span>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && onParse) onParse(f); e.target.value = ''; }} />
            <Button type="button" size="sm" variant="glass" magnetic={false} disabled={parsing} onClick={() => fileRef.current?.click()}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {parsing ? 'Parsing…' : 'Upload & auto-fill'}
            </Button>
          </div>
          {form.resume?.filename && <p className="mt-2 text-xs text-muted-foreground">Attached: {form.resume.filename}{form.resumeAnalysis?.atsScore != null ? ` · ATS ${form.resumeAnalysis.atsScore} · match ${form.resumeAnalysis.jobMatch}%` : ''}</p>}
          {counts.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{counts.map(([l, n]) => <Badge key={l} tone="muted">{n} {l.toLowerCase()}</Badge>)}</div>}
        </div>
      )}

      <Section title="Personal details" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *" value={form.name} onChange={set('name')} />
        <Field label="Email *" type="email" value={form.email} onChange={set('email')} />
        <Field label="Mobile number" value={form.phone} onChange={set('phone')} />
        <Field label="WhatsApp number" value={form.whatsapp} onChange={set('whatsapp')} />
        <Field label="Date of birth" value={form.dob} onChange={set('dob')} placeholder="DD/MM/YYYY" />
        <Select label="Gender" value={form.gender} onChange={set('gender')} options={GENDERS.map(([v, l]) => ({ label: l, value: v }))} />
        <Field label="Nationality" value={form.nationality} onChange={set('nationality')} />
        {showStage && <Select label="Stage" value={form.stage} onChange={set('stage')} options={STAGES.map((s) => ({ label: titleCase(s), value: s }))} />}
        <Field label="Address" value={form.address} onChange={set('address')} />
        <Field label="City" value={form.city} onChange={set('city')} />
        <Field label="State" value={form.state} onChange={set('state')} />
        <Field label="Country" value={form.country} onChange={set('country')} />
        <Field label="Postal / ZIP code" value={form.postalCode} onChange={set('postalCode')} />
        <Field label="LinkedIn" value={form.linkedin} onChange={set('linkedin')} />
        <Field label="Portfolio / Website" value={form.website} onChange={set('website')} />
      </div>

      <Section title="Professional details" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Highest qualification" value={form.highestQualification} onChange={set('highestQualification')} />
        <Field label="Total experience (years)" type="number" value={String(form.totalExperienceYears ?? '')} onChange={set('totalExperienceYears')} />
        <Field label="Current company" value={form.currentCompany} onChange={set('currentCompany')} />
        <Field label="Current designation" value={form.currentDesignation} onChange={set('currentDesignation')} />
        <Field label="Current salary" value={form.currentSalary} onChange={set('currentSalary')} />
        <Field label="Expected salary" value={form.expectedSalary} onChange={set('expectedSalary')} />
        <Field label="Notice period" value={form.noticePeriod} onChange={set('noticePeriod')} />
        <Field label="Preferred job location" value={form.preferredLocation} onChange={set('preferredLocation')} />
        <Select label="Employment type" value={form.employmentType} onChange={set('employmentType')} options={EMP_TYPES.map(([v, l]) => ({ label: l, value: v }))} />
      </div>

      <Section title="Skills & languages" />
      <div className="grid gap-4">
        <Field label="Skills (comma-separated)" value={form.skills} onChange={set('skills')} />
        <Field label="Languages (comma-separated)" value={form.languages} onChange={set('languages')} />
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>;
}
