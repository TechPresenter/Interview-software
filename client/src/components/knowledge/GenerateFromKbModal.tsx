'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ShieldCheck, Filter, Check, AlertTriangle } from 'lucide-react';
import { knowledgeApi } from '@/lib/knowledge.api';
import { useAuth } from '@/store/auth.store';
import { number } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';
import {
  DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_LABELS, humanize,
  type Difficulty, type GenerateResult, type Question, type QuestionLanguage, type QuestionType,
} from '@/types/question';

/**
 * The six types worth asking from uploaded reference material. QUESTION_TYPES
 * carries all eighteen, but most of the rest (hr, leadership, communication)
 * are judged from the candidate, not from a document, and grounding them in a
 * KB produces questions the material cannot actually answer.
 */
const KB_TYPES: QuestionType[] = ['mcq', 'true_false', 'short_answer', 'long_answer', 'scenario', 'coding'];

/** A KB says `both`; a Question says `bilingual`. Same idea, different enums. */
const KB_LANGUAGE: Record<string, QuestionLanguage> = { both: 'bilingual', en: 'en', hi: 'hi' };

/** Why the server rejected the model's other questions, in words a recruiter reads. */
const REASON_LABELS: Record<string, string> = {
  filler: 'generic filler',
  duplicate: 'duplicate',
  invalid: 'irrelevant or unusable',
};

interface KbSource {
  label?: string;
  chars?: number;
  error?: string | null;
}

export interface KbForGeneration {
  _id: string;
  name: string;
  charCount?: number;
  difficulty?: string;
  language?: string;
  jobRole?: string;
  department?: string;
  sources?: KbSource[];
}

/**
 * Generate questions from a knowledge base.
 *
 * Two steps on purpose: PREVIEW, then save. Nothing reaches the bank until a
 * human has read it, and even then it lands as `pending_review` rather than
 * live. The preview also reports what the server threw away — a generator that
 * silently drops half its output looks broken when it is doing its job.
 */
export function GenerateFromKbModal({
  kb,
  onClose,
  onSaved,
}: {
  kb: KbForGeneration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const role = useAuth((s) => s.user?.role);
  const [form, setForm] = useState({
    types: [] as QuestionType[],
    count: 10,
    // The KB's own taxonomy is the sensible default for questions drawn from it.
    difficulty: (DIFFICULTIES as string[]).includes(kb.difficulty || '') ? (kb.difficulty as Difficulty) : 'medium',
    language: KB_LANGUAGE[kb.language || 'both'] ?? 'en',
    jobRole: kb.jobRole || '',
    department: kb.department || '',
  });
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [keep, setKeep] = useState<Record<number, boolean>>({});

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const body = () => ({
    types: form.types.length ? form.types : undefined,
    count: Number(form.count) || 10,
    difficulty: form.difficulty,
    language: form.language,
    jobRole: form.jobRole || undefined,
    department: form.department || undefined,
  });

  const preview = useMutation({
    mutationFn: () => knowledgeApi.generateQuestions(role, kb._id, { ...body(), save: false }),
    onSuccess: (r) => {
      setResult(r);
      setKeep(Object.fromEntries(r.questions.map((_, i) => [i, true])));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Generation failed'),
  });

  const save = useMutation({
    mutationFn: () =>
      knowledgeApi.generateQuestions(role, kb._id, {
        ...body(),
        save: true,
        questions: (result?.questions ?? []).filter((_, i) => keep[i]),
      }),
    onSuccess: (r) => {
      toast.success(`${r.inserted ?? 0} questions added to the bank — pending review`);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not save'),
  });

  const keptCount = Object.values(keep).filter(Boolean).length;
  const droppedReasons = Object.entries(result?.reasons ?? {}).filter(([, n]) => Number(n) > 0);

  // A KB that ingested nothing cannot ground anything: the model would invent
  // questions from thin air and every one of them would fail the relevance gate.
  const unreadable = (kb.sources ?? []).filter((s) => s.error);
  const empty = (kb.charCount ?? 0) === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={result ? 'Review generated questions' : `Generate questions from "${kb.name}"`}
      size="lg"
      footer={
        result ? (
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setResult(null)}>Back</Button>
            <Button magnetic={false} loading={save.isPending} disabled={!keptCount} onClick={() => save.mutate()}>
              <Check className="h-4 w-4" /> Add {keptCount} to bank
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
            <Button magnetic={false} loading={preview.isPending} disabled={empty} onClick={() => preview.mutate()}>
              <Sparkles className="h-4 w-4" /> Generate preview
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
            <span>
              <strong>{result.questions.length}</strong> question{result.questions.length === 1 ? '' : 's'} grounded in
              this knowledge base passed the relevance check.
            </span>
            {result.dropped > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                {result.dropped} filtered out
                {droppedReasons.map(([k, n]) => ` · ${n} ${REASON_LABELS[k] ?? humanize(k).toLowerCase()}`)}
              </span>
            )}
          </div>

          {result.questions.length === 0 && (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Every generated question was rejected before it reached you. That usually means the material is too thin
              or too general to build questions on — add more specific content to this knowledge base and try again.
            </p>
          )}

          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {result.questions.map((q, i) => (
              <PreviewCard key={i} q={q} checked={!!keep[i]} onToggle={() => setKeep((k) => ({ ...k, [i]: !k[i] }))} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            These are saved to the{' '}
            <Link href="/dashboard/questions" className="text-primary underline-offset-2 hover:underline">
              Question Bank
            </Link>{' '}
            as <strong>pending review</strong>. They are not asked in any interview until someone approves them.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {empty ? (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="font-medium text-destructive">This knowledge base has no readable text</p>
                <p className="mt-1 text-muted-foreground">
                  Nothing was extracted from its sources, so there is nothing to build questions from. Add material that
                  contains selectable text, then generate.
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Questions are drawn from this knowledge base&apos;s{' '}
              <strong className="text-foreground">{number(kb.charCount || 0)} characters</strong> of material — you do
              not need to describe the subject.
            </p>
          )}

          {unreadable.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
              <div className="min-w-0">
                <p className="font-medium">
                  {unreadable.length} source{unreadable.length === 1 ? '' : 's'} could not be read
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {unreadable.map((s, i) => (
                    <li key={i} className="break-words">• {s.label} — {s.error}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">Questions will only cover the sources that did read.</p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              Question types{' '}
              <span className="font-normal text-muted-foreground">(optional — leave empty for a suitable mix)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KB_TYPES.map((t) => {
                const on = form.types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('types', on ? form.types.filter((x) => x !== t) : [...form.types, t])}
                    className={`rounded-full border px-3 py-1 text-xs transition ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {humanize(t)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How many" type="number" min={1} max={50} value={String(form.count)} onChange={(v) => set('count', Number(v))} />
            <Select label="Difficulty" value={form.difficulty} onChange={(v) => set('difficulty', v as Difficulty)} options={DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))} />
            <Select label="Language" value={form.language} onChange={(v) => set('language', v as QuestionLanguage)} options={LANGUAGES.map((l) => ({ label: LANGUAGE_LABELS[l], value: l }))} />
            <Field label="Job role (optional)" value={form.jobRole} onChange={(v) => set('jobRole', v)} placeholder="e.g. Frontend Engineer" />
            <Field label="Department (optional)" value={form.department} onChange={(v) => set('department', v)} placeholder="e.g. Engineering" />
          </div>

          <p className="text-xs text-muted-foreground">
            Role and department only tag and angle the questions — the subject matter always comes from the knowledge
            base. Anything generic, off-topic, duplicated or unfair is rejected before you see it.
          </p>
        </div>
      )}
    </Modal>
  );
}

function PreviewCard({ q, checked, onToggle }: { q: Question; checked: boolean; onToggle: () => void }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${checked ? 'border-primary/40 bg-primary/5' : 'border-border opacity-60'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">{q.text}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="info">{humanize(q.type)}</Badge>
          <Badge tone="muted">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
          {q.topic && <Badge tone="muted">{q.topic}</Badge>}
          {q.skills?.slice(0, 4).map((s) => <Badge key={s} tone="muted">{s}</Badge>)}
        </div>
        {/* The model must justify every question against the material it drew from. */}
        {q.rationale && <p className="text-xs italic text-muted-foreground">Why: {q.rationale}</p>}
        {!!q.expectedPoints?.length && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">{q.expectedPoints.length} expected points</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {q.expectedPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </details>
        )}
        {!!q.mcq?.options?.length && (
          <ul className="space-y-0.5 text-xs">
            {q.mcq.options.map((o, i) => (
              <li key={i} className={o.isCorrect ? 'font-medium text-accent' : 'text-muted-foreground'}>
                {o.isCorrect ? '✓' : '○'} {o.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

export default GenerateFromKbModal;
