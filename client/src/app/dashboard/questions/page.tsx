'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Sparkles, Search, Copy, Archive, ArchiveRestore, Pencil, Check, X, ShieldCheck,
} from 'lucide-react';
import { questionsApi, scopeForRole } from '@/lib/questions.api';
import { useAuth } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { QuestionModal } from '@/components/questions/QuestionModal';
import { GenerateModal } from '@/components/questions/GenerateModal';
import {
  DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_TONES, INDUSTRIES, QUESTION_TYPES,
  STATUS_TONES, STATUSES, humanize, plural, type Question,
} from '@/types/question';

const ALL = '';

export default function QuestionsPage() {
  const qc = useQueryClient();
  // Super-admins maintain the shared global bank; everyone else their company's.
  const role = useAuth((s) => s.user?.role);
  const scope = scopeForRole(role);
  const qapi = useMemo(() => questionsApi(scope), [scope]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ type: ALL, category: ALL, difficulty: ALL, status: ALL });
  const [tab, setTab] = useState<'all' | 'pending_review' | 'archived'>('all');
  const [sort, setSort] = useState('-createdAt');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Question | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Question | null>(null);

  // Debounce so we aren't firing a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => ({
    page,
    limit: 10,
    sort,
    search: debounced || undefined,
    type: filters.type || undefined,
    category: filters.category || undefined,
    difficulty: filters.difficulty || undefined,
    status: tab === 'pending_review' ? 'pending_review' : filters.status || undefined,
    archived: tab === 'archived' ? 'true' : undefined,
  }), [page, sort, debounced, filters, tab]);

  const { data, isLoading } = useQuery({ queryKey: ['questions', scope, params], queryFn: () => qapi.list(params) });
  const { data: stats } = useQuery({ queryKey: ['question-stats', scope], queryFn: qapi.stats });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['questions'] });
    qc.invalidateQueries({ queryKey: ['question-stats'] });
    setSelected([]);
  };

  /** Every row action shares the same success/refresh/error handling. */
  const act = <T,>(fn: (v: T) => Promise<unknown>, msg: string) => ({
    mutationFn: fn,
    onSuccess: () => { toast.success(msg); refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const del = useMutation(act<string>((id) => qapi.remove(id), 'Question deleted'));
  const dupe = useMutation(act<string>((id) => qapi.duplicate(id), 'Duplicated'));
  const archive = useMutation(act<string>((id) => qapi.archive(id), 'Archived'));
  const restore = useMutation(act<string>((id) => qapi.restore(id), 'Restored'));
  const bulkReview = useMutation(
    act<{ ids: string[]; status: 'approved' | 'rejected' }>(({ ids, status }) => qapi.bulkReview(ids, status), 'Questions reviewed'),
  );

  const pendingCount = stats?.byStatus?.find((s) => s._id === 'pending_review')?.count ?? 0;
  const rows = data?.items ?? [];
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const columns: Column<Question>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? [] : rows.map((r) => r._id))}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          aria-label="Select all"
        />
      ),
      className: 'w-8',
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.includes(r._id)}
          onChange={() => setSelected((s) => (s.includes(r._id) ? s.filter((x) => x !== r._id) : [...s, r._id]))}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          aria-label="Select question"
        />
      ),
    },
    {
      key: 'text',
      header: 'Question',
      render: (r) => (
        <div className="max-w-xl">
          <p className="line-clamp-2">{r.text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {r.source === 'ai' && <Badge tone="default"><Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AI</Badge>}
            {r.topic && <span className="text-xs text-muted-foreground">{r.topic}</span>}
            {r.skills?.slice(0, 3).map((s) => (
              <span key={s} className="text-xs text-muted-foreground">· {s}</span>
            ))}
            {/* A question with no answer key is graded on vibes — flag it. */}
            {!r.expectedPoints?.length && (
              <span className="text-xs text-yellow-500" title="No expected points — answers to this question are scored without an answer key">
                · no answer key
              </span>
            )}
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => <Badge tone="info">{humanize(r.type)}</Badge> },
    { key: 'category', header: 'Industry', render: (r) => <span className="text-sm text-muted-foreground">{humanize(r.category)}</span> },
    { key: 'difficulty', header: 'Difficulty', render: (r) => <Badge tone={DIFFICULTY_TONES[r.difficulty]}>{DIFFICULTY_LABELS[r.difficulty]}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONES[r.status]}>{humanize(r.status)}</Badge> },
    { key: 'usageCount', header: 'Used', render: (r) => r.usageCount ?? 0 },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <IconBtn label="Edit" onClick={() => { setEditing(r); setModalOpen(true); }}><Pencil className="h-4 w-4" /></IconBtn>
          <IconBtn label="Duplicate" onClick={() => dupe.mutate(r._id)}><Copy className="h-4 w-4" /></IconBtn>
          {r.archivedAt ? (
            <IconBtn label="Restore" onClick={() => restore.mutate(r._id)}><ArchiveRestore className="h-4 w-4" /></IconBtn>
          ) : (
            <IconBtn label="Archive" onClick={() => archive.mutate(r._id)}><Archive className="h-4 w-4" /></IconBtn>
          )}
          <IconBtn label="Delete" danger onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4" /></IconBtn>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Question Bank"
        description={`${scope === 'admin' ? 'Global library' : 'Your question bank'} · ${plural(stats?.total ?? 0, 'question')}${stats?.withAnswerKey != null ? ` · ${stats.withAnswerKey} with answer keys` : ''}`}
        action={
          <>
            <Button size="sm" variant="ghost" magnetic={false} onClick={() => setGenOpen(true)}>
              <Sparkles className="h-4 w-4" /> Generate with AI
            </Button>
            <Button size="sm" magnetic={false} onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </>
        }
      />

      {/* Tabs — the pending queue is where AI questions wait for a human. */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={tab === 'all'} onClick={() => { setTab('all'); setPage(1); }}>All</Chip>
        <Chip active={tab === 'pending_review'} onClick={() => { setTab('pending_review'); setPage(1); }}>
          Pending review
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-yellow-500/20 px-1.5 text-xs text-yellow-500">{pendingCount}</span>
          )}
        </Chip>
        <Chip active={tab === 'archived'} onClick={() => { setTab('archived'); setPage(1); }}>Archived</Chip>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions, skills, topics…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <Select value={filters.type} onChange={(v) => { setFilters((f) => ({ ...f, type: v })); setPage(1); }} options={[{ label: 'All types', value: ALL }, ...QUESTION_TYPES.map((t) => ({ label: humanize(t), value: t }))]} />
        <Select value={filters.category} onChange={(v) => { setFilters((f) => ({ ...f, category: v })); setPage(1); }} options={[{ label: 'All industries', value: ALL }, ...INDUSTRIES.map((c) => ({ label: humanize(c), value: c }))]} />
        <Select value={filters.difficulty} onChange={(v) => { setFilters((f) => ({ ...f, difficulty: v })); setPage(1); }} options={[{ label: 'All difficulties', value: ALL }, ...DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))]} />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          {tab === 'all' && (
            <Select value={filters.status} onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} options={[{ label: 'Any status', value: ALL }, ...STATUSES.map((s) => ({ label: humanize(s), value: s }))]} />
          )}
          <Select
            value={sort}
            onChange={(v) => { setSort(v); setPage(1); }}
            options={[
              { label: 'Newest', value: '-createdAt' },
              { label: 'Oldest', value: 'createdAt' },
              { label: 'Most used', value: '-usageCount' },
              { label: 'Least used', value: 'usageCount' },
            ]}
          />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{selected.length} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" magnetic={false} loading={bulkReview.isPending} onClick={() => bulkReview.mutate({ ids: selected, status: 'approved' })}>
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button size="sm" variant="ghost" magnetic={false} loading={bulkReview.isPending} onClick={() => bulkReview.mutate({ ids: selected, status: 'rejected' })}>
              <X className="h-4 w-4" /> Reject
            </Button>
            <Button size="sm" variant="ghost" magnetic={false} onClick={() => setSelected([])}>Clear</Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => r._id}
        page={data?.meta.page}
        pages={data?.meta.pages}
        total={data?.meta.total}
        onPageChange={setPage}
        emptyText={
          tab === 'pending_review'
            ? 'Nothing waiting for review'
            : debounced || filters.type || filters.category
              ? 'No questions match these filters'
              : 'No questions yet — add one or generate a set with AI'
        }
      />

      <QuestionModal
        open={modalOpen}
        question={editing}
        api={qapi}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); refresh(); }}
      />
      <GenerateModal open={genOpen} api={qapi} onClose={() => setGenOpen(false)} onSaved={() => { setGenOpen(false); refresh(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) del.mutate(confirmDelete._id); setConfirmDelete(null); }}
        title="Delete this question?"
        description="This permanently removes it from the bank. Reports that already used it keep their own copy of the question text. Archive it instead if you only want it out of rotation."
        confirmLabel="Delete"
        danger
      />
    </div>
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center rounded-full border px-4 py-1.5 text-sm transition',
        active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
