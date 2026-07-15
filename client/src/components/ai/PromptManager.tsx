'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Eye, RotateCcw, History, Download, Upload, Trash2, Check, AlertTriangle,
} from 'lucide-react';
import { promptsApi, type PromptTemplate, type PromptKeyInfo, type PromptPreview } from '@/lib/prompts.api';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * Every prompt the AI engines send is a database row edited here.
 *
 * The previous panel could only save a `system` string that the runtime then
 * ignored — it reported success and changed nothing. Now the body is live, which
 * is powerful and sharp: dropping the JSON contract out of `scoreAnswer` would
 * score every candidate 0. Hence preview-before-save, version history and reset.
 */
export function PromptManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['prompt-templates'], queryFn: () => promptsApi.list() });
  const [editing, setEditing] = useState<{ tpl?: PromptTemplate; info: PromptKeyInfo } | null>(null);
  const [historyFor, setHistoryFor] = useState<PromptTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PromptTemplate | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['prompt-templates'] });

  const byKey = useMemo(() => {
    const m = new Map<string, PromptTemplate[]>();
    for (const t of data?.templates ?? []) {
      if (!m.has(t.key)) m.set(t.key, []);
      m.get(t.key)!.push(t);
    }
    return m;
  }, [data]);

  const del = useMutation({
    mutationFn: (id: string) => promptsApi.remove(id),
    onSuccess: () => { toast.success('Template deleted'); refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not delete'),
  });
  const activate = useMutation({
    mutationFn: (id: string) => promptsApi.setActive(id),
    onSuccess: () => { toast.success('Template activated — live on the next AI call'); refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not activate'),
  });
  const reset = useMutation({
    mutationFn: (id: string) => promptsApi.reset(id),
    onSuccess: () => { toast.success('Reset to the built-in text'); refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not reset'),
  });
  const importer = useMutation({
    mutationFn: (templates: unknown[]) => promptsApi.importAll(templates),
    onSuccess: (r) => { toast.success(`Imported — ${r.created} created, ${r.updated} updated`); refresh(); },
    onError: (e: any) => {
      const details = e?.response?.data?.details;
      toast.error(details?.length ? `Import rejected: ${details[0]}` : (e?.response?.data?.message || 'Import failed'));
    },
  });

  async function onExport() {
    const payload = await promptsApi.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-templates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed?.templates;
        if (!Array.isArray(list)) throw new Error('Expected a templates array');
        importer.mutate(list);
      } catch (err: any) {
        toast.error(`Could not read that file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Prompt templates</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" magnetic={false} onClick={onExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Upload className="h-4 w-4" /> Import
            </span>
          </label>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        These are the exact prompts sent to the model. Edits are live on the next AI call — no restart.
        Use Preview before saving: removing a placeholder silently drops that context, and removing a
        prompt&apos;s JSON contract can break scoring.
      </p>

      <div className="space-y-3">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}

        {(data?.keys ?? []).map((info) => {
          const rows = byKey.get(info.key) ?? [];
          const active = rows.find((r) => r.isActive);
          return (
            <div key={info.key} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{info.name}</p>
                    <Badge tone="muted">{info.category}</Badge>
                    {/* A seeded built-in still at v1 is NOT a customisation —
                        calling every prompt "custom" the moment it has a row
                        tells the admin they changed things they never touched. */}
                    <StateBadge active={active} usingDefault={info.usingDefault} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{info.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {info.variables.slice(0, 8).map((v) => (
                      <code key={v.name} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-accent">{`{{${v.name}}}`}</code>
                    ))}
                    {info.variables.length > 8 && (
                      <span className="text-[11px] text-muted-foreground">+{info.variables.length - 8} more</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" magnetic={false} onClick={() => setEditing({ tpl: active, info })}>
                    {active ? 'Edit' : 'Customise'}
                  </Button>
                  {active && (
                    <>
                      <Button size="sm" variant="ghost" magnetic={false} onClick={() => setHistoryFor(active)}>
                        <History className="h-4 w-4" /> v{active.version}
                      </Button>
                      <Button size="sm" variant="ghost" magnetic={false} loading={reset.isPending} onClick={() => reset.mutate(active._id)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" magnetic={false} onClick={() => setEditing({ info })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Alternates: only one per key can be live at a time. */}
              {rows.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {rows.map((r) => (
                    <button
                      key={r._id}
                      onClick={() => (r.isActive ? setEditing({ tpl: r, info }) : activate.mutate(r._id))}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition',
                        r.isActive ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                      title={r.isActive ? 'Live' : 'Click to make live'}
                    >
                      {r.isActive && <Check className="mr-1 inline h-3 w-3" />}{r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <PromptEditor
          info={editing.info}
          tpl={editing.tpl}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
          onDelete={(t) => { setEditing(null); setConfirmDelete(t); }}
        />
      )}

      {historyFor && (
        <VersionHistory tpl={historyFor} onClose={() => setHistoryFor(null)} onRestored={() => { setHistoryFor(null); refresh(); }} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) del.mutate(confirmDelete._id); setConfirmDelete(null); }}
        title="Delete this prompt template?"
        description="The built-in prompt takes over immediately, so the AI keeps working. Its version history is deleted with it."
        confirmLabel="Delete"
        danger
      />
    </GlassCard>
  );
}

/** Whether what runs today is the shipped text, an edit of it, or a new template. */
function StateBadge({ active, usingDefault }: { active?: PromptTemplate; usingDefault: boolean }) {
  if (usingDefault || !active) return <Badge tone="muted">built-in</Badge>;
  if (!active.isBuiltIn) return <Badge tone="success">custom</Badge>;
  if (active.version > 1) return <Badge tone="success">edited</Badge>;
  return <Badge tone="muted">built-in</Badge>;
}

function PromptEditor({
  info, tpl, onClose, onSaved, onDelete,
}: {
  info: PromptKeyInfo;
  tpl?: PromptTemplate;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (t: PromptTemplate) => void;
}) {
  const [form, setForm] = useState({
    name: tpl?.name ?? `${info.name} (custom)`,
    description: tpl?.description ?? '',
    system: tpl?.system ?? '',
    template: tpl?.template ?? '',
    note: '',
    isActive: tpl?.isActive ?? true,
  });
  const [preview, setPreview] = useState<PromptPreview | null>(null);

  // Seed a new template from what runs today, so nobody starts from a blank box.
  useEffect(() => {
    if (tpl) return;
    promptsApi.preview({ key: info.key })
      .then((p) => setForm((f) => (f.template ? f : { ...f, system: p.system, template: p.messages[0]?.content ?? '' })))
      .catch(() => { /* leave the fields empty; the API error already surfaced */ });
  }, [tpl, info.key]);

  const save = useMutation({
    mutationFn: () => (tpl
      ? promptsApi.update(tpl._id, {
        name: form.name, description: form.description, system: form.system,
        template: form.template, note: form.note || undefined, isActive: form.isActive,
      })
      : promptsApi.create({
        key: info.key, name: form.name, description: form.description,
        system: form.system, template: form.template, isActive: form.isActive,
      })),
    onSuccess: () => { toast.success('Saved — live on the next AI call'); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not save'),
  });

  const doPreview = useMutation({
    mutationFn: () => promptsApi.preview({ key: info.key, system: form.system, template: form.template }),
    onSuccess: setPreview,
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Preview failed'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={tpl ? `Edit — ${info.name}` : `New template — ${info.name}`}
      size="3xl"
      footer={
        <>
          {tpl && !tpl.isBuiltIn && (
            <Button variant="ghost" magnetic={false} className="mr-auto" onClick={() => onDelete(tpl)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="ghost" magnetic={false} loading={doPreview.isPending} onClick={() => doPreview.mutate()}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button magnetic={false} loading={save.isPending} disabled={!form.template.trim()} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Select
            label="Live"
            value={form.isActive ? 'yes' : 'no'}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v === 'yes' }))}
            options={[{ label: 'Active — this is what runs', value: 'yes' }, { label: 'Disabled — fall back to built-in', value: 'no' }]}
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium">Available placeholders</p>
          <div className="flex flex-wrap gap-1">
            {info.variables.map((v) => (
              <code
                key={v.name}
                title={v.description}
                className="cursor-pointer rounded bg-background px-1.5 py-0.5 text-[11px] text-accent transition hover:text-primary"
                onClick={() => setForm((f) => ({ ...f, template: `${f.template}{{${v.name}}}` }))}
              >{`{{${v.name}}}`}</code>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Click to append. A placeholder you remove simply stops being sent — Preview shows what each one resolves to.
          </p>
        </div>

        <Textarea label="System prompt" value={form.system} onChange={(v) => setForm((f) => ({ ...f, system: v }))} rows={5} />
        <Textarea label="Message body" value={form.template} onChange={(v) => setForm((f) => ({ ...f, template: v }))} rows={12} />

        {tpl && (
          <Field label="Change note (optional)" value={form.note} onChange={(v) => setForm((f) => ({ ...f, note: v }))} placeholder="Why you changed it — shown in version history" />
        )}

        {preview && (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Preview</p>
              <Badge tone="muted">{preview.source}</Badge>
            </div>
            {preview.unfilled.length > 0 && (
              <p className="mb-2 flex items-start gap-1.5 text-xs text-yellow-500">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Renders empty with these sample values: {preview.unfilled.map((u) => `{{${u}}}`).join(', ')}.
                  That is expected for optional blocks (an interview with no knowledge base), but a typo looks the same.
                </span>
              </p>
            )}
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px] leading-relaxed">
              {preview.system ? `SYSTEM:\n${preview.system}\n\n---\n\n` : ''}{preview.messages[0]?.content}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

function VersionHistory({ tpl, onClose, onRestored }: { tpl: PromptTemplate; onClose: () => void; onRestored: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['prompt-versions', tpl._id], queryFn: () => promptsApi.versions(tpl._id) });
  const restore = useMutation({
    mutationFn: (version: number) => promptsApi.restoreVersion(tpl._id, version),
    onSuccess: () => { toast.success('Version restored'); onRestored(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not restore'),
  });

  return (
    <Modal open onClose={onClose} title={`History — ${tpl.name}`} size="2xl" footer={<Button variant="ghost" magnetic={false} onClick={onClose}>Close</Button>}>
      {isLoading && <div className="skeleton h-24 rounded-xl" />}
      {!isLoading && !(data ?? []).length && (
        <p className="text-sm text-muted-foreground">No earlier versions yet — history starts at your first edit.</p>
      )}
      <div className="space-y-3">
        {(data ?? []).map((v) => (
          <div key={v.version} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">v{v.version}</Badge>
              {v.updatedAt && <span className="text-xs text-muted-foreground">{new Date(v.updatedAt).toLocaleString()}</span>}
              <Button size="sm" variant="ghost" magnetic={false} className="ml-auto" loading={restore.isPending} onClick={() => restore.mutate(v.version)}>
                Restore
              </Button>
            </div>
            {v.note && <p className="mt-1 text-xs italic text-muted-foreground">{v.note}</p>}
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px]">{v.template}</pre>
          </div>
        ))}
      </div>
    </Modal>
  );
}
