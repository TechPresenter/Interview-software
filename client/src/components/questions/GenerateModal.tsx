'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ShieldCheck, Filter, Check } from 'lucide-react';
import type { QuestionsApi } from '@/lib/questions.api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';
import {
  DIFFICULTIES, DIFFICULTY_LABELS, INDUSTRIES, LANGUAGES, LANGUAGE_LABELS,
  EXPERIENCE_LEVELS, QUESTION_TYPES, humanize,
  type GenerateResult, type Question,
} from '@/types/question';

/**
 * AI question generation.
 *
 * Two steps on purpose: generate a PREVIEW, then save. Nothing reaches the bank
 * (and nothing can reach a candidate) until a human has read it — and even when
 * saved it lands as `pending_review`.
 */
export function GenerateModal({ open, api, onClose, onSaved }: { open: boolean; api: QuestionsApi; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    jobTitle: '', jobDescription: '', department: '', industry: 'software_development',
    skills: '', experienceLevel: 'mid', difficulty: 'medium', count: 10,
    language: 'en', types: [] as string[], durationMinutes: 30,
  });
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [keep, setKeep] = useState<Record<number, boolean>>({});

  const body = () => ({
    jobTitle: form.jobTitle || undefined,
    jobDescription: form.jobDescription || undefined,
    department: form.department || undefined,
    industry: form.industry || undefined,
    skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    experienceLevel: form.experienceLevel as never,
    difficulty: form.difficulty as never,
    count: Number(form.count) || 10,
    durationMinutes: Number(form.durationMinutes) || undefined,
    language: form.language as never,
    types: form.types.length ? (form.types as never) : undefined,
  });

  const preview = useMutation({
    mutationFn: () => api.generate({ ...body(), save: false }),
    onSuccess: (r) => {
      setResult(r);
      // Everything the gate let through is kept by default.
      setKeep(Object.fromEntries(r.questions.map((_, i) => [i, true])));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Generation failed'),
  });

  const save = useMutation({
    mutationFn: () => {
      const chosen = (result?.questions ?? []).filter((_, i) => keep[i]);
      return api.bulkCreate(
        chosen.map((q) => ({ ...q, status: 'pending_review', source: 'ai' })),
      );
    },
    onSuccess: (r) => {
      toast.success(`${r.inserted} questions added — pending review`);
      reset();
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not save'),
  });

  function reset() {
    setResult(null);
    setKeep({});
    onClose();
  }

  const keptCount = Object.values(keep).filter(Boolean).length;
  const anyDropped = (result?.dropped ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={reset}
      title={result ? 'Review generated questions' : 'Generate questions with AI'}
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
            <Button variant="ghost" magnetic={false} onClick={reset}>Cancel</Button>
            <Button
              magnetic={false}
              loading={preview.isPending}
              disabled={!form.jobTitle && !form.jobDescription && !form.skills}
              onClick={() => preview.mutate()}
            >
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
              <strong>{result.questions.length}</strong> question{result.questions.length === 1 ? '' : 's'} passed the
              relevance check.
            </span>
            {anyDropped && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                {result.dropped} filtered out
                {result.reasons?.duplicate ? ` · ${result.reasons.duplicate} duplicate` : ''}
                {result.reasons?.invalid ? ` · ${result.reasons.invalid} irrelevant or unusable` : ''}
              </span>
            )}
          </div>

          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {result.questions.map((q, i) => (
              <PreviewCard key={i} q={q} checked={!!keep[i]} onToggle={() => setKeep((k) => ({ ...k, [i]: !k[i] }))} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            These are saved as <strong>pending review</strong> and are not asked in any interview until approved.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" value={form.jobTitle} onChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))} placeholder="Senior Backend Engineer" />
            <Field label="Department" value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))} placeholder="Engineering" />
          </div>

          <Textarea
            label="Job description"
            value={form.jobDescription}
            onChange={(v) => setForm((f) => ({ ...f, jobDescription: v }))}
            rows={3}
            placeholder="Paste the JD — questions are grounded in what the role actually requires."
          />

          <Field
            label="Key skills (comma-separated)"
            value={form.skills}
            onChange={(v) => setForm((f) => ({ ...f, skills: v }))}
            placeholder="node, postgres, system-design"
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Industry" value={form.industry} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} options={INDUSTRIES.map((c) => ({ label: humanize(c), value: c }))} />
            <Select label="Experience level" value={form.experienceLevel} onChange={(v) => setForm((f) => ({ ...f, experienceLevel: v }))} options={EXPERIENCE_LEVELS.map((c) => ({ label: humanize(c), value: c }))} />
            <Select label="Difficulty" value={form.difficulty} onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))} options={DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABELS[d], value: d }))} />
            <Select label="Language" value={form.language} onChange={(v) => setForm((f) => ({ ...f, language: v }))} options={LANGUAGES.map((l) => ({ label: LANGUAGE_LABELS[l], value: l }))} />
            <Field label="How many" type="number" value={String(form.count)} onChange={(v) => setForm((f) => ({ ...f, count: Number(v) }))} />
            <Field label="Interview length (min)" type="number" value={String(form.durationMinutes)} onChange={(v) => setForm((f) => ({ ...f, durationMinutes: Number(v) }))} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Question types <span className="font-normal text-muted-foreground">(optional — leave empty to let the AI choose a suitable mix)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {QUESTION_TYPES.map((t) => {
                const on = form.types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, types: on ? f.types.filter((x) => x !== t) : [...f.types, t] }))}
                    className={`rounded-full border px-3 py-1 text-xs transition ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {humanize(t)}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Give the AI at least a job title, a description, or some skills — it needs something to make the questions
            relevant to. Anything generic, off-topic, duplicated or unfair is rejected before you see it.
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
        {/* The model must justify every question against a named input. */}
        {q.rationale && <p className="text-xs italic text-muted-foreground">Why: {q.rationale}</p>}
        {!!q.expectedPoints?.length && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              {q.expectedPoints.length} expected points
            </summary>
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
