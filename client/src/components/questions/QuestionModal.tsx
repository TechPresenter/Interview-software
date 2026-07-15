'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Sparkles, Wand2 } from 'lucide-react';
import type { QuestionsApi } from '@/lib/questions.api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/toast';
import {
  DIFFICULTIES, DIFFICULTY_LABELS, INDUSTRIES, LANGUAGES, LANGUAGE_LABELS,
  EXPERIENCE_LEVELS, QUESTION_TYPES, STATUSES, humanize,
  type Question,
} from '@/types/question';

const COMPETENCIES = ['technical', 'domain', 'communication', 'confidence', 'behavioral', 'leadership', 'problemSolving', 'culturalFit'];

const EMPTY = {
  type: 'technical', category: 'software_development', topic: '', jobRole: '',
  experienceLevel: 'mid', difficulty: 'medium', language: 'en', status: 'approved',
  text: '', textHi: '', skills: '', competencies: ['technical'] as string[],
  expectedPoints: [''] as string[],
  mcqOptions: [{ text: '', isCorrect: false }],
  codingLanguage: '', starterCode: '',
};

type FormState = typeof EMPTY;

function toForm(q: Question): FormState {
  return {
    type: q.type ?? 'technical',
    category: q.category ?? 'software_development',
    topic: q.topic ?? '',
    jobRole: q.jobRole ?? '',
    experienceLevel: q.experienceLevel ?? 'mid',
    difficulty: q.difficulty ?? 'medium',
    language: q.language ?? 'en',
    status: q.status ?? 'approved',
    text: q.text ?? '',
    textHi: q.textHi ?? '',
    skills: (q.skills ?? []).join(', '),
    competencies: q.competencies?.length ? q.competencies : ['technical'],
    expectedPoints: q.expectedPoints?.length ? q.expectedPoints : [''],
    mcqOptions: q.mcq?.options?.length ? q.mcq.options.map((o) => ({ text: o.text, isCorrect: !!o.isCorrect })) : [{ text: '', isCorrect: false }],
    codingLanguage: q.coding?.language ?? '',
    starterCode: q.coding?.starterCode ?? '',
  };
}

/** Create or edit a bank question. `question` null => create. */
export function QuestionModal({
  open, question, api, onClose, onSaved,
}: {
  open: boolean;
  question: Question | null;
  /** Scoped client — the global bank for super-admins, the company's otherwise. */
  api: QuestionsApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Reset whenever we switch between create and a different question.
  useEffect(() => {
    if (open) setForm(question ? toForm(question) : EMPTY);
  }, [open, question]);

  const isMcq = form.type === 'mcq' || form.type === 'true_false';
  const isCoding = form.type === 'coding';
  const isBilingual = form.language === 'bilingual';

  const payload = () => {
    const body: Record<string, unknown> = {
      type: form.type,
      category: form.category || null,
      topic: form.topic || undefined,
      jobRole: form.jobRole || undefined,
      experienceLevel: form.experienceLevel || null,
      difficulty: form.difficulty,
      language: form.language,
      status: form.status,
      text: form.text.trim(),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      competencies: form.competencies,
      expectedPoints: form.expectedPoints.map((p) => p.trim()).filter(Boolean),
    };
    if (isBilingual && form.textHi.trim()) body.textHi = form.textHi.trim();
    if (isMcq) body.mcq = { options: form.mcqOptions.filter((o) => o.text.trim()), multiSelect: form.mcqOptions.filter((o) => o.isCorrect).length > 1 };
    if (isCoding) body.coding = { language: form.codingLanguage || undefined, starterCode: form.starterCode || undefined };
    return body;
  };

  const save = useMutation({
    mutationFn: () => (question ? api.update(question._id, payload()) : api.create(payload())),
    onSuccess: () => {
      toast.success(question ? 'Question updated' : 'Question added');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not save'),
  });

  const answerKey = useMutation({
    mutationFn: () => api.answerKey(question!._id),
    onSuccess: (q) => {
      toast.success('Answer key generated');
      // Fold the generated key points back into the open form.
      setForm((f) => ({ ...f, expectedPoints: q.expectedPoints?.length ? q.expectedPoints : f.expectedPoints }));
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not generate'),
  });

  // Mirrors the server-side guard so the error arrives before the round-trip.
  const mcqInvalid = isMcq && form.mcqOptions.some((o) => o.text.trim()) && !form.mcqOptions.some((o) => o.isCorrect);
  const canSave = form.text.trim().length >= 5 && !mcqInvalid;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={question ? 'Edit question' : 'Add question'}
      size="xl"
      footer={
        <>
          {question && (
            <Button variant="ghost" magnetic={false} loading={answerKey.isPending} onClick={() => answerKey.mutate()} className="mr-auto">
              <Wand2 className="h-4 w-4" /> Generate answer key
            </Button>
          )}
          <Button variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button magnetic={false} loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
            {question ? 'Save changes' : 'Add question'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Type" value={form.type} onChange={(v) => set('type', v)} options={QUESTION_TYPES.map((t) => ({ label: humanize(t), value: t }))} />
          <Select label="Industry" value={form.category} onChange={(v) => set('category', v)} options={INDUSTRIES.map((c) => ({ label: humanize(c), value: c }))} />
          <Select label="Difficulty" value={form.difficulty} onChange={(v) => set('difficulty', v)} options={DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))} />
          <Select label="Language" value={form.language} onChange={(v) => set('language', v)} options={LANGUAGES.map((l) => ({ label: LANGUAGE_LABELS[l], value: l }))} />
        </div>

        <Textarea label="Question text" value={form.text} onChange={(v) => set('text', v)} rows={3} placeholder="Ask something this role actually requires." />

        {isBilingual && (
          <Textarea label="Question text (Hindi)" value={form.textHi} onChange={(v) => set('textHi', v)} rows={3} placeholder="वही प्रश्न हिंदी में" />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Topic" value={form.topic} onChange={(v) => set('topic', v)} placeholder="Databases" />
          <Field label="Job role" value={form.jobRole} onChange={(v) => set('jobRole', v)} placeholder="Backend Engineer" />
          <Select label="Experience" value={form.experienceLevel} onChange={(v) => set('experienceLevel', v)} options={EXPERIENCE_LEVELS.map((e) => ({ label: humanize(e), value: e }))} />
          <Select label="Status" value={form.status} onChange={(v) => set('status', v)} options={STATUSES.map((s) => ({ label: humanize(s), value: s }))} />
        </div>

        <Field
          label="Skills (comma-separated)"
          value={form.skills}
          onChange={(v) => set('skills', v)}
          placeholder="react, system-design"
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          Skills decide which jobs this question is offered for. An untagged question is only ever used as a generic one.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium">Competencies assessed</p>
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCIES.map((c) => {
              const on = form.competencies.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('competencies', on ? form.competencies.filter((x) => x !== c) : [...form.competencies, c])}
                  className={`rounded-full border px-3 py-1 text-xs transition ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {humanize(c)}
                </button>
              );
            })}
          </div>
        </div>

        {isMcq && (
          <ListEditor
            label="Options"
            hint="Mark at least one option correct — an option-less or answer-less MCQ can never be scored."
            error={mcqInvalid ? 'Mark at least one option as correct.' : undefined}
            items={form.mcqOptions.map((o) => o.text)}
            onChange={(texts) => set('mcqOptions', texts.map((t, i) => ({ text: t, isCorrect: form.mcqOptions[i]?.isCorrect ?? false })))}
            renderPrefix={(i) => (
              <input
                type="checkbox"
                checked={form.mcqOptions[i]?.isCorrect ?? false}
                onChange={() => set('mcqOptions', form.mcqOptions.map((o, j) => (j === i ? { ...o, isCorrect: !o.isCorrect } : o)))}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                title="Correct answer"
              />
            )}
          />
        )}

        {isCoding && (
          <div className="space-y-4">
            <Field label="Programming language" value={form.codingLanguage} onChange={(v) => set('codingLanguage', v)} placeholder="javascript" />
            <Textarea label="Starter code" value={form.starterCode} onChange={(v) => set('starterCode', v)} rows={4} />
          </div>
        )}

        <ListEditor
          label="Expected points"
          hint="The ideal-answer key. The AI grades answers against these, so keep them specific and checkable."
          items={form.expectedPoints}
          onChange={(v) => set('expectedPoints', v)}
        />

        {question?.answerKey?.idealAnswer && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" /> AI answer key
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Ideal answer</p>
                <p className="text-muted-foreground">{question.answerKey.idealAnswer}</p>
              </div>
              {!!question.answerKey.strongIndicators?.length && (
                <KeyList title="Strong answer looks like" items={question.answerKey.strongIndicators} />
              )}
              {!!question.answerKey.weakIndicators?.length && (
                <KeyList title="Red flags" items={question.answerKey.weakIndicators} />
              )}
              {!!question.answerKey.followUps?.length && (
                <KeyList title="Suggested follow-ups" items={question.answerKey.followUps} />
              )}
              {question.answerKey.interviewerNotes && (
                <p className="text-xs italic text-muted-foreground">{question.answerKey.interviewerNotes}</p>
              )}
            </div>
          </details>
        )}
      </div>
    </Modal>
  );
}

function KeyList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

/** Small repeating-row editor for string lists. */
function ListEditor({
  label, hint, error, items, onChange, renderPrefix,
}: {
  label: string;
  hint?: string;
  error?: string;
  items: string[];
  onChange: (v: string[]) => void;
  renderPrefix?: (index: number) => React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {renderPrefix?.(i)}
            <input
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              disabled={items.length === 1}
              className="shrink-0 text-muted-foreground transition hover:text-destructive disabled:opacity-30"
              aria-label={`Remove ${label} ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="mt-2 flex items-center gap-1 text-xs text-primary transition hover:opacity-80"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}
