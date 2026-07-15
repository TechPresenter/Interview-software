'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, Power, Eye, FilePlus, FileText, Lightbulb, Search, Upload, Sparkles, Target, AlertTriangle } from 'lucide-react';
import { knowledgeApi } from '@/lib/knowledge.api';
import { GenerateFromKbModal } from '@/components/knowledge/GenerateFromKbModal';
import { useAuth } from '@/store/auth.store';
import { number, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

const SCOPES = [
  { label: 'Company-wide', value: 'company' },
  { label: 'Specific job/role', value: 'job' },
  { label: 'Specific interview', value: 'interview' },
  { label: 'Global (platform)', value: 'global' },
];
const CATEGORIES = [
  { label: '— Category —', value: '' }, { label: 'Technical', value: 'technical' }, { label: 'HR', value: 'hr' },
  { label: 'Aptitude', value: 'aptitude' }, { label: 'Coding', value: 'coding' }, { label: 'Behavioral', value: 'behavioral' },
];
const EXPERIENCE = [
  { label: '— Experience —', value: '' }, { label: 'Fresher', value: 'fresher' }, { label: 'Junior', value: 'junior' },
  { label: 'Mid', value: 'mid' }, { label: 'Senior', value: 'senior' }, { label: 'Lead', value: 'lead' },
];
const DIFFICULTY = [
  { label: '— Difficulty —', value: '' }, { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
];
const LANGUAGE = [{ label: 'English & Hindi', value: 'both' }, { label: 'English', value: 'en' }, { label: 'हिन्दी (Hindi)', value: 'hi' }];
const LANG_LABEL: Record<string, string> = { both: 'EN · हिं', en: 'EN', hi: 'हिं' };

const EMPTY_FORM = {
  name: '', description: '', scope: 'company', text: '', urls: '',
  category: '', department: '', jobRole: '', experienceLevel: '', difficulty: '', language: 'both', skills: '',
};

export default function KnowledgePage() {
  const role = useAuth((s) => s.user?.role);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['knowledge-bases'], queryFn: () => knowledgeApi.list(role) });
  const items: any[] = data ?? [];

  const [open, setOpen] = useState(false);
  const [appendTo, setAppendTo] = useState<any>(null); // KB being appended to (else create)
  const [viewing, setViewing] = useState<any>(null);
  const [generating, setGenerating] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filter, setFilter] = useState({ q: '', category: '', experienceLevel: '', difficulty: '', language: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setF = (k: string, v: any) => setFilter((f) => ({ ...f, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] });

  const filtered = items.filter((kb) => {
    if (filter.category && kb.category !== filter.category) return false;
    if (filter.experienceLevel && kb.experienceLevel !== filter.experienceLevel) return false;
    if (filter.difficulty && kb.difficulty !== filter.difficulty) return false;
    if (filter.language && kb.language !== filter.language) return false;
    if (filter.q && !`${kb.name} ${kb.description || ''} ${kb.department || ''} ${(kb.skills || []).join(' ')}`.toLowerCase().includes(filter.q.toLowerCase())) return false;
    return true;
  });

  function openCreate() {
    setAppendTo(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }
  function openAppend(kb: any) {
    setAppendTo(kb);
    setForm({
      ...EMPTY_FORM, name: kb.name, description: kb.description || '', scope: kb.scope,
      category: kb.category || '', department: kb.department || '', jobRole: kb.jobRole || '',
      experienceLevel: kb.experienceLevel || '', difficulty: kb.difficulty || '', language: kb.language || 'both',
      skills: (kb.skills || []).join(', '),
    });
    setOpen(true);
  }

  function buildFd() {
    const fd = new FormData();
    for (const k of ['name', 'description', 'scope', 'category', 'department', 'jobRole', 'experienceLevel', 'difficulty', 'language', 'skills'] as const) {
      if ((form as any)[k]) fd.append(k, (form as any)[k]);
    }
    if (form.text.trim()) fd.append('text', form.text);
    if (form.urls.trim()) fd.append('urls', form.urls);
    const files = fileRef.current?.files;
    if (files) Array.from(files).forEach((f) => fd.append('files', f));
    return fd;
  }

  const save = useMutation({
    mutationFn: () => (appendTo ? knowledgeApi.addSources(role, appendTo._id, buildFd(), 'append') : knowledgeApi.create(role, buildFd())),
    onSuccess: () => { toast.success(appendTo ? 'Sources added' : 'Knowledge base created'); setOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });
  const toggle = useMutation({ mutationFn: (id: string) => knowledgeApi.toggle(role, id), onSuccess: () => invalidate() });
  const del = useMutation({ mutationFn: (id: string) => knowledgeApi.remove(role, id), onSuccess: () => { toast.success('Deleted'); invalidate(); } });
  const view = useMutation({ mutationFn: (id: string) => knowledgeApi.get(role, id), onSuccess: (d) => setViewing(d) });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Knowledge Base"
        description="Upload reference material that grounds AI interviews and generates questions. PDF, DOCX, TXT, CSV, XLSX, PPTX, ZIP, URLs, or text."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/questions"><Button variant="glass" magnetic={false}>Question Bank</Button></Link>
            <Button magnetic={false} onClick={openCreate}><Plus className="h-4 w-4" /> New knowledge base</Button>
          </div>
        }
      />

      {/* How to use the Knowledge Base */}
      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Lightbulb className="h-5 w-5" /></span>
          <h2 className="text-lg font-semibold">How to use the Knowledge Base</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Upload, title: '1. Build a Knowledge Base', body: 'Create a collection and add material — upload PDF/DOCX/TXT/CSV/PPTX/ZIP, paste text, or add URLs. Tag it with category, skills, experience, difficulty & language.' },
            { icon: Target, title: '2. Organize & assign', body: 'Filter and organize by job role, department, skills, experience and category so the right questions reach the right candidates.' },
            { icon: Sparkles, title: '3. Generate questions', body: 'Hit Generate on any knowledge base to draft questions from its content — MCQ, true/false, short & long answer, scenario or coding. Review them, then they land in the Question Bank as pending review.' },
            { icon: BookOpen, title: '4. Run the interview', body: 'The AI asks questions grounded in your content and adds dynamic follow-ups based on the candidate’s answers.' },
          ].map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-card/40 p-4">
              <s.icon className="h-5 w-5 text-accent" />
              <p className="mt-2 text-sm font-semibold">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={filter.q} onChange={(e) => setF('q', e.target.value)} placeholder="Search name, skills, department…"
            className="h-10 w-56 rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
        </div>
        <div className="w-40"><Select value={filter.category} onChange={(v) => setF('category', v)} options={CATEGORIES} /></div>
        <div className="w-40"><Select value={filter.experienceLevel} onChange={(v) => setF('experienceLevel', v)} options={EXPERIENCE} /></div>
        <div className="w-40"><Select value={filter.difficulty} onChange={(v) => setF('difficulty', v)} options={DIFFICULTY} /></div>
        <div className="w-40"><Select value={filter.language} onChange={(v) => setF('language', v)} options={[{ label: '— Language —', value: '' }, ...LANGUAGE]} /></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
        {filtered.map((kb) => (
          <GlassCard key={kb._id} className={cn(kb.status !== 'active' && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><BookOpen className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{kb.name}</p>
                  <Badge tone={kb.status === 'active' ? 'success' : 'muted'}>{kb.status}</Badge>
                </div>
                <p className="text-xs capitalize text-muted-foreground">{kb.scope} · updated {relativeTime(kb.updatedAt)}</p>
              </div>
            </div>
            {kb.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{kb.description}</p>}
            {(kb.category || kb.department || kb.experienceLevel || kb.difficulty || kb.language) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {kb.category && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium capitalize text-primary">{kb.category}</span>}
                {kb.department && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{kb.department}</span>}
                {kb.experienceLevel && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{kb.experienceLevel}</span>}
                {kb.difficulty && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] capitalize text-amber-500">{kb.difficulty}</span>}
                {kb.language && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{LANG_LABEL[kb.language] || kb.language}</span>}
              </div>
            )}
            {(kb.skills?.length ?? 0) > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {kb.skills.slice(0, 6).map((s: string) => <span key={s} className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{s}</span>)}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">{kb.sources?.length ?? 0} sources</span>
              <span className={cn('rounded-md px-1.5 py-0.5', (kb.charCount || 0) === 0 ? 'bg-destructive/15 font-medium text-destructive' : 'bg-muted text-muted-foreground')}>{number(kb.charCount || 0)} chars</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">~{number(kb.tokensApprox || 0)} tokens</span>
            </div>
            <SourceHealth kb={kb} />
            {(kb.topics?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {kb.topics.slice(0, 6).map((t: string) => <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>)}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <Button size="sm" magnetic={false} disabled={(kb.charCount || 0) === 0} title={(kb.charCount || 0) === 0 ? 'Nothing was extracted from this knowledge base — there is no material to generate from' : undefined} onClick={() => setGenerating(kb)}><Sparkles className="h-3.5 w-3.5" /> Generate</Button>
              <Button size="sm" variant="glass" magnetic={false} loading={view.isPending && view.variables === kb._id} onClick={() => view.mutate(kb._id)}><Eye className="h-3.5 w-3.5" /> View</Button>
              <Button size="sm" variant="ghost" magnetic={false} onClick={() => openAppend(kb)}><FilePlus className="h-3.5 w-3.5" /> Add</Button>
              <button onClick={() => toggle.mutate(kb._id)} title={kb.status === 'active' ? 'Disable' : 'Enable'} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"><Power className="h-4 w-4" /></button>
              <button onClick={() => { if (window.confirm(`Delete "${kb.name}"?`)) del.mutate(kb._id); }} title="Delete" className="ml-auto rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </GlassCard>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {items.length === 0 ? 'No knowledge bases yet. Create one to ground interviews in your own material.' : 'No knowledge bases match these filters.'}
          </div>
        )}
      </div>

      {/* Create / append modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={appendTo ? `Add sources to "${appendTo.name}"` : 'New knowledge base'}
        footer={<>
          <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
          <Button magnetic={false} loading={save.isPending} onClick={() => save.mutate()}>{appendTo ? 'Add sources' : 'Create'}</Button>
        </>}
      >
        <div className="space-y-4">
          {!appendTo && (
            <>
              <Field label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Frontend Engineer — React" />
              <Field label="Description" value={form.description} onChange={(v) => set('description', v)} placeholder="Optional" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Scope" value={form.scope} onChange={(v) => set('scope', v)} options={SCOPES} />
                <Select label="Category" value={form.category} onChange={(v) => set('category', v)} options={CATEGORIES} />
                <Select label="Experience level" value={form.experienceLevel} onChange={(v) => set('experienceLevel', v)} options={EXPERIENCE} />
                <Select label="Difficulty" value={form.difficulty} onChange={(v) => set('difficulty', v)} options={DIFFICULTY} />
                <Select label="Language" value={form.language} onChange={(v) => set('language', v)} options={LANGUAGE} />
                <Field label="Department" value={form.department} onChange={(v) => set('department', v)} placeholder="e.g. Engineering" />
              </div>
              <Field label="Job role" value={form.jobRole} onChange={(v) => set('jobRole', v)} placeholder="e.g. Frontend Engineer" />
              <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => set('skills', v)} placeholder="React, Node.js, SQL" />
            </>
          )}
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><FileText className="h-4 w-4" /> Files</span>
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.pptx,.ppt,.zip" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-primary" />
          </div>
          <Textarea label="URLs (one per line)" value={form.urls} onChange={(v) => set('urls', v)} placeholder="https://docs.example.com/guide" rows={2} />
          <Textarea label="Or paste text" value={form.text} onChange={(v) => set('text', v)} placeholder="Paste reference material here…" rows={4} />
        </div>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name}>
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={viewing.status === 'active' ? 'success' : 'muted'}>{viewing.status}</Badge>
              <span className="rounded-md bg-muted px-2 py-0.5 capitalize text-muted-foreground">{viewing.scope}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{number(viewing.charCount || 0)} chars · {viewing.chunkCount} chunks</span>
            </div>
            <div>
              <p className="mb-1 font-medium">Sources</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {(viewing.sources ?? []).map((s: any, i: number) => (
                  <li key={i} className="break-words">
                    • <span className="capitalize">{s.kind}</span> — {s.label}{' '}
                    <span className={cn((s.chars || 0) === 0 && 'font-medium text-destructive')}>({number(s.chars || 0)} chars)</span>
                    {s.error && (
                      <span className="mt-0.5 flex items-start gap-1 pl-3 text-destructive">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {s.error}
                      </span>
                    )}
                  </li>
                ))}
                {(viewing.sources?.length ?? 0) === 0 && <li>No sources yet.</li>}
              </ul>
            </div>
            {(viewing.topics?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 font-medium">Topics</p>
                <div className="flex flex-wrap gap-1">{viewing.topics.map((t: string) => <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">{t}</span>)}</div>
              </div>
            )}
            <div>
              <p className="mb-1 font-medium">Content preview</p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">{viewing.contentPreview || '(empty)'}</pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Mounted per KB so the form always starts from that KB's own taxonomy. */}
      {generating && (
        <GenerateFromKbModal
          kb={generating}
          onClose={() => setGenerating(null)}
          onSaved={() => setGenerating(null)}
        />
      )}
    </div>
  );
}

/**
 * Ingestion problems, on the card. A source that could not be read is still
 * listed with its filename, so without this a KB looks fully populated while
 * holding no text at all — which reads as "AI generation is broken" when the
 * real fault is that nothing was ever extracted.
 */
function SourceHealth({ kb }: { kb: any }) {
  const unreadable = (kb.sources ?? []).filter((s: any) => s.error);
  const empty = (kb.charCount || 0) === 0;
  if (!unreadable.length && !empty) return null;

  return (
    <div className={cn('mt-2 rounded-lg border p-2 text-[11px]', empty ? 'border-destructive/30 bg-destructive/10' : 'border-yellow-500/30 bg-yellow-500/10')}>
      <p className={cn('flex items-center gap-1 font-medium', empty ? 'text-destructive' : 'text-yellow-500')}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {empty ? 'No readable text — nothing to generate from' : `${unreadable.length} source${unreadable.length === 1 ? '' : 's'} could not be read`}
      </p>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {unreadable.slice(0, 3).map((s: any, i: number) => (
          <li key={i} className="break-words">• {s.label} — {s.error}</li>
        ))}
        {unreadable.length > 3 && <li>• +{unreadable.length - 3} more — open View for the full list</li>}
        {empty && !unreadable.length && <li>Add material with selectable text, or paste it directly.</li>}
      </ul>
    </div>
  );
}
