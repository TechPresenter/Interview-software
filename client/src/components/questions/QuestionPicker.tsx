'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search, Sparkles } from 'lucide-react';
import { questionsApi } from '@/lib/questions.api';
import { MAX_SET_QUESTIONS } from '@/lib/questionSets.api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_TONES, INDUSTRIES, QUESTION_TYPES,
  STATUS_TONES, humanize, plural, type Question,
} from '@/types/question';

const ALL = '';

interface QuestionPickerProps {
  /** Ids in pick order — the order they will be asked in. */
  selected: string[];
  onChange: (ids: string[]) => void;
  /**
   * Docs for ids the picker has not loaded a page for yet (e.g. an existing
   * set being edited). Without these it cannot tell whether an already-picked
   * question is approved.
   */
  known?: Question[];
  max?: number;
}

/**
 * Filtered multi-select over the question bank.
 *
 * Selections are held as ids and survive paging and filter changes, so a
 * recruiter can pull two questions out of one filter and three out of another.
 */
export function QuestionPicker({ selected, onChange, known, max = MAX_SET_QUESTIONS }: QuestionPickerProps) {
  const qapi = useMemo(() => questionsApi('company'), []);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [skills, setSkills] = useState('');
  const [debouncedSkills, setDebouncedSkills] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [debouncedRole, setDebouncedRole] = useState('');
  const [filters, setFilters] = useState({ type: ALL, category: ALL, difficulty: ALL, status: ALL });

  // One query per keystroke would hammer the bank.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setDebouncedSkills(skills);
      setDebouncedRole(jobRole);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search, skills, jobRole]);

  const params = useMemo(() => ({
    page,
    limit: 8,
    // The server reads free-text search from `q` (utils/query.js parseListQuery);
    // a `search` param is silently ignored and returns the unfiltered bank.
    q: debounced || undefined,
    jobRole: debouncedRole || undefined,
    skills: debouncedSkills
      ? debouncedSkills.split(',').map((s) => s.trim()).filter(Boolean).join(',')
      : undefined,
    type: filters.type || undefined,
    category: filters.category || undefined,
    difficulty: filters.difficulty || undefined,
    status: filters.status || undefined,
    // Deliberately NOT includeGlobal. A set may legally reference the shared
    // global bank, but that scope is an $or which Object.assign drops on top of
    // the search $or in the list controller — the box would return the whole
    // bank while looking filtered. Own-bank-only keeps search honest.
  }), [page, debounced, debouncedRole, debouncedSkills, filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['questions', 'picker', params],
    queryFn: () => qapi.list(params),
  });

  const rows = useMemo(() => data?.items ?? [], [data]);

  // Remember every question we have seen so a pick made three filters ago can
  // still be described (and warned about) after the rows have moved on.
  const [seen, setSeen] = useState<Record<string, Question>>({});
  useEffect(() => {
    const incoming = [...(known ?? []), ...rows];
    if (!incoming.length) return;
    setSeen((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const q of incoming) {
        if (!next[q._id]) { next[q._id] = q; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [rows, known]);

  const atLimit = selected.length >= max;

  const toggle = (q: Question) => {
    if (selected.includes(q._id)) {
      onChange(selected.filter((x) => x !== q._id));
      return;
    }
    if (atLimit) return;
    // Append so pick order stays the ask order.
    onChange([...selected, q._id]);
  };

  /**
   * question.selector filters to `status: 'approved'`, so anything else in a set
   * is dead weight the interview will skip. Better a warning here than a live
   * interview that silently asks nothing.
   */
  const notApproved = selected
    .map((id) => seen[id])
    .filter((q): q is Question => Boolean(q) && q.status !== 'approved');

  const columns: Column<Question>[] = [
    {
      key: 'select',
      className: 'w-8',
      header: '',
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.includes(r._id)}
          disabled={atLimit && !selected.includes(r._id)}
          onChange={() => toggle(r)}
          className="h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-40"
          aria-label={`Select question: ${r.text.slice(0, 60)}`}
        />
      ),
    },
    {
      key: 'text',
      header: 'Question',
      render: (r) => (
        <div className="max-w-md">
          <p className="line-clamp-2">{r.text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {r.source === 'ai' && <Badge tone="default"><Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AI</Badge>}
            {r.skills?.slice(0, 3).map((s) => (
              <span key={s} className="text-xs text-muted-foreground">· {s}</span>
            ))}
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => <Badge tone="info">{humanize(r.type)}</Badge> },
    {
      key: 'difficulty',
      header: 'Difficulty',
      render: (r) => <Badge tone={DIFFICULTY_TONES[r.difficulty]}>{DIFFICULTY_LABELS[r.difficulty]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={STATUS_TONES[r.status]}>{humanize(r.status)}</Badge>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative sm:col-span-2 lg:col-span-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions, skills, topics…"
            aria-label="Search the question bank"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <input
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          // The server matches jobRole exactly, so a near-miss returns nothing.
          placeholder="Job role (exact match)"
          aria-label="Filter by job role"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
        />
        <input
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Skills (comma separated)"
          aria-label="Filter by skills"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
        />
        <Select
          value={filters.category}
          onChange={(v) => { setFilters((f) => ({ ...f, category: v })); setPage(1); }}
          aria-label="Filter by industry"
          options={[{ label: 'All industries', value: ALL }, ...INDUSTRIES.map((c) => ({ label: humanize(c), value: c }))]}
        />
        <Select
          value={filters.type}
          onChange={(v) => { setFilters((f) => ({ ...f, type: v })); setPage(1); }}
          aria-label="Filter by type"
          options={[{ label: 'All types', value: ALL }, ...QUESTION_TYPES.map((t) => ({ label: humanize(t), value: t }))]}
        />
        <Select
          value={filters.difficulty}
          onChange={(v) => { setFilters((f) => ({ ...f, difficulty: v })); setPage(1); }}
          aria-label="Filter by difficulty"
          options={[{ label: 'All difficulties', value: ALL }, ...DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))]}
        />
        <Select
          value={filters.status}
          onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }}
          aria-label="Filter by status"
          options={[
            { label: 'Any status', value: ALL },
            { label: 'Approved only (servable)', value: 'approved' },
            { label: 'Pending review', value: 'pending_review' },
            { label: 'Draft', value: 'draft' },
            { label: 'Rejected', value: 'rejected' },
          ]}
        />
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>{plural(selected.length, 'question')} selected</span>
          {atLimit && <span className="text-xs text-muted-foreground">· limit of {max} reached</span>}
          <Button size="sm" variant="ghost" magnetic={false} className="ml-auto" onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      )}

      {notApproved.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
          <p className="text-muted-foreground">
            <span className="font-medium text-yellow-500">
              {plural(notApproved.length, 'selected question')} not approved.
            </span>{' '}
            Only approved questions are ever served, so {notApproved.length === 1 ? 'it' : 'they'} will be skipped in the
            interview. Approve {notApproved.length === 1 ? 'it' : 'them'} in the Question Bank first.
          </p>
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
        emptyText="No questions match these filters"
      />
    </div>
  );
}

export default QuestionPicker;
