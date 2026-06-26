'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, Power, Eye, FilePlus, FileText } from 'lucide-react';
import { knowledgeApi } from '@/lib/knowledge.api';
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

export default function KnowledgePage() {
  const role = useAuth((s) => s.user?.role);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['knowledge-bases'], queryFn: () => knowledgeApi.list(role) });
  const items: any[] = data ?? [];

  const [open, setOpen] = useState(false);
  const [appendTo, setAppendTo] = useState<any>(null); // KB being appended to (else create)
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', scope: 'company', text: '', urls: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['knowledge-bases'] });

  function openCreate() {
    setAppendTo(null);
    setForm({ name: '', description: '', scope: 'company', text: '', urls: '' });
    setOpen(true);
  }
  function openAppend(kb: any) {
    setAppendTo(kb);
    setForm({ name: kb.name, description: kb.description || '', scope: kb.scope, text: '', urls: '' });
    setOpen(true);
  }

  function buildFd() {
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('scope', form.scope);
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
        description="Upload reference material that grounds AI interviews. PDF, DOCX, TXT, CSV, XLSX, PPTX, ZIP, URLs, or text."
        action={<Button magnetic={false} onClick={openCreate}><Plus className="h-4 w-4" /> New knowledge base</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
        {items.map((kb) => (
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
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">{kb.sources?.length ?? 0} sources</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">{number(kb.charCount || 0)} chars</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">~{number(kb.tokensApprox || 0)} tokens</span>
            </div>
            {(kb.topics?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {kb.topics.slice(0, 6).map((t: string) => <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>)}
              </div>
            )}
            <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
              <Button size="sm" variant="glass" magnetic={false} loading={view.isPending && view.variables === kb._id} onClick={() => view.mutate(kb._id)}><Eye className="h-3.5 w-3.5" /> View</Button>
              <Button size="sm" variant="ghost" magnetic={false} onClick={() => openAppend(kb)}><FilePlus className="h-3.5 w-3.5" /> Add</Button>
              <button onClick={() => toggle.mutate(kb._id)} title={kb.status === 'active' ? 'Disable' : 'Enable'} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"><Power className="h-4 w-4" /></button>
              <button onClick={() => { if (window.confirm(`Delete "${kb.name}"?`)) del.mutate(kb._id); }} title="Delete" className="ml-auto rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </GlassCard>
        ))}
        {!isLoading && items.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No knowledge bases yet. Create one to ground interviews in your own material.
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
              <Select label="Scope" value={form.scope} onChange={(v) => set('scope', v)} options={SCOPES} />
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
              <ul className="space-y-1 text-xs text-muted-foreground">
                {(viewing.sources ?? []).map((s: any, i: number) => <li key={i}>• <span className="capitalize">{s.kind}</span> — {s.label} ({number(s.chars || 0)} chars)</li>)}
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
    </div>
  );
}
