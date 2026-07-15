'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import {
  questionSetsApi, questionCountOf, INTERVIEW_ROUNDS, MAX_SET_QUESTIONS,
  type AutoQuestionSetInput, type InterviewRound, type QuestionSet, type QuestionSetInput,
} from '@/lib/questionSets.api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { QuestionPicker } from '@/components/questions/QuestionPicker';
import {
  DIFFICULTIES, DIFFICULTY_LABELS, EXPERIENCE_LEVELS, INDUSTRIES, LANGUAGE_LABELS, LANGUAGES,
  QUESTION_TYPES, humanize, plural,
  type Difficulty, type ExperienceLevel, type QuestionLanguage, type QuestionType,
} from '@/types/question';

const ALL = '';
const ROUND_OPTIONS = [{ label: 'Any round', value: ALL }, ...INTERVIEW_ROUNDS.map((r) => ({ label: humanize(r), value: r }))];

const errText = (e: any) => e?.response?.data?.message || 'Something went wrong';

export default function QuestionSetsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [round, setRound] = useState<string>(ALL);
  const [createOpen, setCreateOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionSet | null>(null);

  // The list endpoint has no working free-text search (its scope $or overwrites
  // the one parseListQuery builds from `q`), so filter on round only.
  const params = useMemo(() => ({ page, limit: 10, round: round || undefined }), [page, round]);

  const { data, isLoading } = useQuery({
    queryKey: ['question-sets', params],
    queryFn: () => questionSetsApi.list(params),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['question-sets'] });

  const act = <T,>(fn: (v: T) => Promise<unknown>, msg: string) => ({
    mutationFn: fn,
    onSuccess: () => { toast.success(msg); refresh(); },
    onError: (e: any) => toast.error(errText(e)),
  });

  const dupe = useMutation(act<string>((id) => questionSetsApi.duplicate(id), 'Set duplicated'));
  const del = useMutation(act<string>((id) => questionSetsApi.remove(id), 'Set archived'));

  const columns: Column<QuestionSet>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <div className="max-w-xs">
          <p className="font-medium">{r.name}</p>
          {r.description && <p className="line-clamp-1 text-xs text-muted-foreground">{r.description}</p>}
        </div>
      ),
    },
    { key: 'round', header: 'Round', render: (r) => (r.round ? <Badge tone="info">{humanize(r.round)}</Badge> : <span className="text-muted-foreground">—</span>) },
    { key: 'jobRole', header: 'Job role', render: (r) => <span className="text-sm text-muted-foreground">{r.jobRole || '—'}</span> },
    {
      key: 'questions',
      header: 'Questions',
      render: (r) => {
        const n = questionCountOf(r);
        return (
          <span className={cn('text-sm', n === 0 && 'text-yellow-500')}>
            {n === 0 ? 'Empty' : plural(n, 'question')}
          </span>
        );
      },
    },
    { key: 'language', header: 'Language', render: (r) => <span className="text-sm text-muted-foreground">{LANGUAGE_LABELS[r.language] ?? humanize(r.language)}</span> },
    { key: 'usageCount', header: 'Used', render: (r) => r.usageCount ?? 0 },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <IconBtn label="Edit" onClick={() => setEditingId(r._id)}><Pencil className="h-4 w-4" /></IconBtn>
          <IconBtn label="Duplicate" onClick={() => dupe.mutate(r._id)}><Copy className="h-4 w-4" /></IconBtn>
          <IconBtn label="Delete" danger onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4" /></IconBtn>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Question Sets"
        description="Named, ordered questions an interview asks verbatim — before the bank or the AI gets a turn."
        action={
          <>
            <Button size="sm" variant="ghost" magnetic={false} onClick={() => setAutoOpen(true)}>
              <Sparkles className="h-4 w-4" /> Auto-build
            </Button>
            <Button size="sm" magnetic={false} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New set
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:max-w-xs">
        <Select value={round} onChange={(v) => { setRound(v); setPage(1); }} options={ROUND_OPTIONS} aria-label="Filter by round" />
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
        emptyText={round ? 'No sets for this round' : 'No question sets yet — build one from your bank'}
      />

      <SetModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); refresh(); }} />
      {editingId && (
        <SetModal open id={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); refresh(); }} />
      )}
      <AutoModal open={autoOpen} onClose={() => setAutoOpen(false)} onSaved={() => { setAutoOpen(false); refresh(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) del.mutate(confirmDelete._id); setConfirmDelete(null); }}
        title="Delete this question set?"
        description="The set is archived and stops being offered to new interviews. The questions themselves stay in your bank, and interviews already scheduled with it keep working."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

/* ── Create / edit ─────────────────────────────────────── */

const EMPTY: QuestionSetInput = {
  name: '', description: '', questions: [], jobRole: '', department: '',
  round: null, difficulty: null, experienceLevel: null, language: 'en',
};

function SetModal({ open, id, onClose, onSaved }: { open: boolean; id?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<QuestionSetInput>(EMPTY);
  const [ids, setIds] = useState<string[]>([]);

  // Only the detail endpoint populates the refs, which is what the reorder list
  // and the picker's approval warning need.
  const { data: existing, isLoading } = useQuery({
    queryKey: ['question-sets', id],
    queryFn: () => questionSetsApi.get(id as string),
    enabled: Boolean(id) && open,
  });

  useEffect(() => {
    if (!open) return;
    if (!id) { setForm(EMPTY); setIds([]); return; }
    if (!existing) return;
    setForm({
      name: existing.name,
      description: existing.description ?? '',
      jobRole: existing.jobRole ?? '',
      department: existing.department ?? '',
      round: existing.round ?? null,
      difficulty: existing.difficulty ?? null,
      experienceLevel: existing.experienceLevel ?? null,
      language: existing.language ?? 'en',
    });
    setIds((existing.questions ?? []).map((q) => q._id));
  }, [open, id, existing]);

  const known = existing?.questions;
  const byId = useMemo(() => new Map((known ?? []).map((q) => [q._id, q])), [known]);

  const save = useMutation({
    mutationFn: (body: QuestionSetInput) => (id ? questionSetsApi.update(id, body) : questionSetsApi.create(body)),
    onSuccess: () => { toast.success(id ? 'Set updated' : 'Set created'); onSaved(); },
    onError: (e: any) => toast.error(errText(e)),
  });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setIds(next);
  };

  const submit = () => {
    if (form.name.trim().length < 2) { toast.error('Give the set a name of at least 2 characters'); return; }
    save.mutate({ ...form, name: form.name.trim(), questions: ids });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="5xl"
      title={id ? 'Edit question set' : 'New question set'}
      description="Questions are asked in the order below, exactly as listed."
      footer={
        <>
          <Button variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button magnetic={false} loading={save.isPending} onClick={submit}>{id ? 'Save changes' : 'Create set'}</Button>
        </>
      }
    >
      {id && isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading set…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Backend screening — round 1" />
            <Field label="Job role" value={form.jobRole ?? ''} onChange={(v) => setForm((f) => ({ ...f, jobRole: v }))} placeholder="Backend Engineer" />
          </div>
          <Textarea label="Description" rows={2} value={form.description ?? ''} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Round"
              value={form.round ?? ALL}
              onChange={(v) => setForm((f) => ({ ...f, round: (v || null) as InterviewRound | null }))}
              options={ROUND_OPTIONS}
            />
            <Select
              label="Difficulty"
              value={form.difficulty ?? ALL}
              onChange={(v) => setForm((f) => ({ ...f, difficulty: (v || null) as Difficulty | null }))}
              options={[{ label: 'Any', value: ALL }, ...DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))]}
            />
            <Select
              label="Experience"
              value={form.experienceLevel ?? ALL}
              onChange={(v) => setForm((f) => ({ ...f, experienceLevel: (v || null) as ExperienceLevel | null }))}
              options={[{ label: 'Any', value: ALL }, ...EXPERIENCE_LEVELS.map((e) => ({ label: humanize(e), value: e }))]}
            />
            <Select
              label="Language"
              value={form.language ?? 'en'}
              onChange={(v) => setForm((f) => ({ ...f, language: v as QuestionLanguage }))}
              options={LANGUAGES.map((l) => ({ label: LANGUAGE_LABELS[l], value: l }))}
            />
          </div>

          {ids.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted-foreground">Ask order ({ids.length})</p>
              <ol className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                {ids.map((qid, i) => (
                  <li key={qid} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                    <span className="line-clamp-1 flex-1">{byId.get(qid)?.text ?? 'Newly added question'}</span>
                    <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-muted-foreground transition hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => move(i, i + 1)} disabled={i === ids.length - 1} aria-label="Move down" className="rounded p-1 text-muted-foreground transition hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setIds((s) => s.filter((x) => x !== qid))} aria-label="Remove" className="rounded p-1 text-muted-foreground transition hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">Pick from your bank</p>
            <QuestionPicker selected={ids} onChange={setIds} known={known} max={MAX_SET_QUESTIONS} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Auto-build ────────────────────────────────────────── */

const EMPTY_AUTO: AutoQuestionSetInput = {
  name: '', count: 8, jobRole: '', industry: '', type: undefined,
  round: undefined, difficulty: undefined, experienceLevel: undefined, language: 'en', randomOrder: false,
};

function AutoModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AutoQuestionSetInput>(EMPTY_AUTO);
  const [skills, setSkills] = useState('');

  useEffect(() => { if (open) { setForm(EMPTY_AUTO); setSkills(''); } }, [open]);

  const build = useMutation({
    mutationFn: (body: AutoQuestionSetInput) => questionSetsApi.auto(body),
    onSuccess: (set) => { toast.success(`Built “${set.name}”`); onSaved(); },
    onError: (e: any) => toast.error(errText(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title="Auto-build a set"
      description="Ranks your bank by relevance using the same selector the live interview uses — the result is what the engine would have picked anyway, just pinned down in advance."
      footer={
        <>
          <Button variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button magnetic={false} loading={build.isPending} onClick={() => build.mutate({
            ...form,
            skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          })}>
            Build set
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={form.name ?? ''} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Leave blank to name it automatically" />
          <Field
            label="How many questions"
            type="number"
            min={1}
            max={50}
            value={String(form.count ?? 8)}
            // The server takes a real number here, and zod does not coerce.
            onChange={(v) => setForm((f) => ({ ...f, count: Number(v) || undefined }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job role" value={form.jobRole ?? ''} onChange={(v) => setForm((f) => ({ ...f, jobRole: v }))} placeholder="Backend Engineer" />
          <Field label="Skills" value={skills} onChange={setSkills} placeholder="node, mongodb (comma separated)" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Industry"
            value={form.industry ?? ALL}
            onChange={(v) => setForm((f) => ({ ...f, industry: v || undefined }))}
            options={[{ label: 'Any', value: ALL }, ...INDUSTRIES.map((c) => ({ label: humanize(c), value: c }))]}
          />
          <Select
            label="Type"
            value={form.type ?? ALL}
            onChange={(v) => setForm((f) => ({ ...f, type: (v || undefined) as QuestionType | undefined }))}
            options={[{ label: 'Any', value: ALL }, ...QUESTION_TYPES.map((t) => ({ label: humanize(t), value: t }))]}
          />
          <Select
            label="Round"
            value={form.round ?? ALL}
            onChange={(v) => setForm((f) => ({ ...f, round: (v || undefined) as InterviewRound | undefined }))}
            options={ROUND_OPTIONS}
          />
          <Select
            label="Difficulty"
            value={form.difficulty ?? ALL}
            onChange={(v) => setForm((f) => ({ ...f, difficulty: (v || undefined) as Difficulty | undefined }))}
            options={[{ label: 'Any', value: ALL }, ...DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))]}
          />
          <Select
            label="Experience"
            value={form.experienceLevel ?? ALL}
            onChange={(v) => setForm((f) => ({ ...f, experienceLevel: (v || undefined) as ExperienceLevel | undefined }))}
            options={[{ label: 'Any', value: ALL }, ...EXPERIENCE_LEVELS.map((e) => ({ label: humanize(e), value: e }))]}
          />
          <Select
            label="Language"
            value={form.language ?? 'en'}
            onChange={(v) => setForm((f) => ({ ...f, language: v as QuestionLanguage }))}
            options={LANGUAGES.map((l) => ({ label: LANGUAGE_LABELS[l], value: l }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!form.randomOrder}
            onChange={(e) => setForm((f) => ({ ...f, randomOrder: e.target.checked }))}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Shuffle among the strong matches, so two candidates for one role get different questions
        </label>
        <p className="text-xs text-muted-foreground">
          Only approved questions are eligible. If your bank has nothing on-topic the build fails rather than
          padding the set with unrelated questions.
        </p>
      </div>
    </Modal>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn('rounded p-1.5 transition hover:bg-muted', danger ? 'text-destructive hover:text-destructive/80' : 'text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  );
}
