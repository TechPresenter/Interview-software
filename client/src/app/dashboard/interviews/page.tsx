'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Send, Link2, XCircle, Activity, Languages } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { knowledgeApi } from '@/lib/knowledge.api';
import { questionSetsApi, questionCountOf, INTERVIEW_ROUNDS } from '@/lib/questionSets.api';
import { useAuth } from '@/store/auth.store';
import { dateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

const TYPES = ['hr', 'technical', 'behavioral', 'aptitude', 'coding'];
const DURATIONS = [15, 30, 45, 60, 90];

/**
 * Drop keys whose value is '' before sending.
 *
 * A <Select> uses '' for its placeholder — "Any", "None", "not chosen" — which
 * is UI state, not data. Sending it means the API has to interpret '' as an
 * experience level, and it (rightly) refuses: the whole scheduling form was
 * dead because DEFAULT_CFG.experienceLevel is '' and nobody had to touch the
 * dropdown to send it. Omitting the key says "unset" in the way JSON has for it.
 */
const omitEmpty = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '')) as Partial<T>;

/** The modal's config state → the shape the API expects. */
function configPayload(cfg: Cfg): Record<string, unknown> {
  const out: Record<string, unknown> = omitEmpty(cfg);
  // introCount is a Select, so it arrives as a string. '' ("Auto") was already
  // dropped by omitEmpty, which is exactly how the server reads "auto"; the rest
  // must go back to numbers or the schema rejects them.
  if (typeof out.introCount === 'string') out.introCount = Number(out.introCount);
  return out;
}

/**
 * Render a 400 from the API. The validator returns `details` keyed by field path
 * ('config.experienceLevel'); showing only `message` is what turned every one of
 * these into an unactionable "Validation failed".
 */
function apiErrorMessage(e: any): string {
  const data = e?.response?.data;
  const details = data?.details as Record<string, string> | undefined;
  if (details && typeof details === 'object') {
    const lines = Object.entries(details).map(([field, msg]) => `${field}: ${msg}`);
    if (lines.length) return lines.join('\n');
  }
  return data?.message || 'Something went wrong. Please try again.';
}

type Cfg = {
  // A Select with three meanings, so it is a string here: '' = auto, '0' = off,
  // '1'..'3' = exactly that many. configPayload() converts it back to a number.
  introCount: string;
  language: string; allowLanguageChange: boolean; durationMinutes: number; questionCount: number; difficulty: string; experienceLevel: string;
  passingScore: number; timePerQuestionSeconds: number; maxRetries: number;
  adaptiveDifficulty: boolean; followUps: boolean; randomOrder: boolean; autoSubmit: boolean;
  voiceEnabled: boolean; videoEnabled: boolean; cameraRequired: boolean; micRequired: boolean;
  proctoring: boolean; resumeBased: boolean; jdBased: boolean;
};
const DEFAULT_CFG: Cfg = {
  introCount: '',
  language: 'en', allowLanguageChange: false, durationMinutes: 30, questionCount: 8, difficulty: 'medium', experienceLevel: '',
  passingScore: 50, timePerQuestionSeconds: 0, maxRetries: 0,
  adaptiveDifficulty: true, followUps: true, randomOrder: false, autoSubmit: true,
  voiceEnabled: true, videoEnabled: true, cameraRequired: true, micRequired: true,
  proctoring: true, resumeBased: false, jdBased: true,
};

export default function InterviewsPage() {
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [types, setTypes] = useState<string[]>(['hr']);
  const [sendInvite, setSendInvite] = useState(true);
  const [cfg, setCfg] = useState<Cfg>({ ...DEFAULT_CFG });
  const [knowledgeBase, setKnowledgeBase] = useState('');
  // A fixed set makes every candidate face the same questions, which is what
  // makes comparing two of them fair. room.service serves it ahead of the bank.
  const [questionSet, setQuestionSet] = useState('');
  const [round, setRound] = useState('');
  const [customDuration, setCustomDuration] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const setC = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const { data, isLoading } = useQuery({ queryKey: ['interviews', page], queryFn: () => companyApi.interviews({ page, limit: 10 }) });
  const { data: candidates } = useQuery({ queryKey: ['candidates-mini'], queryFn: () => companyApi.candidates({ limit: 100 }) });
  const { data: kbs } = useQuery({ queryKey: ['kb-mini'], queryFn: () => knowledgeApi.list(role) });
  const { data: sets } = useQuery({ queryKey: ['question-sets-mini'], queryFn: () => questionSetsApi.list({ limit: 100 }) });

  const openModal = () => { setCfg({ ...DEFAULT_CFG }); setCandidate(''); setTypes(['hr']); setKnowledgeBase(''); setQuestionSet(''); setRound(''); setScheduledAt(''); setExpiresAt(''); setCustomDuration(false); setOpen(true); };

  const schedule = useMutation({
    mutationFn: () => companyApi.schedule({
      candidate, types, sendInvite,
      // configPayload, not cfg: an unselected dropdown ('' = "Any") is not a value.
      config: configPayload(cfg),
      knowledgeBase: knowledgeBase || undefined,
      questionSet: questionSet || undefined,
      round: round || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }),
    onSuccess: async (res: any) => {
      toast.success(`Interview scheduled${cfg.language === 'hi' ? ' (Hindi)' : ''}`);
      if (res?.link && navigator.clipboard) { await navigator.clipboard.writeText(res.link); toast.info('Link copied to clipboard'); }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['interviews'] });
    },
    onError: (e: any) => toast.error(apiErrorMessage(e)),
  });

  const invite = useMutation({ mutationFn: (id: string) => companyApi.invite(id), onSuccess: () => toast.success('Invitation sent') });
  const cancel = useMutation({ mutationFn: (id: string) => companyApi.cancelInterview(id), onSuccess: () => { toast.success('Interview cancelled'); qc.invalidateQueries({ queryKey: ['interviews'] }); } });

  const copyLink = async (id: string) => {
    const full = await companyApi.interview(id);
    if (full?.link && navigator.clipboard) { await navigator.clipboard.writeText(full.link); toast.info('Link copied'); }
  };

  const columns: Column<any>[] = [
    { key: 'candidate', header: 'Candidate', render: (r) => r.candidate?.name ?? '—' },
    { key: 'job', header: 'Job', render: (r) => r.job?.title ?? '—' },
    { key: 'types', header: 'Type', render: (r) => <span className="text-xs">{(r.types || []).map(titleCase).join(', ')}</span> },
    { key: 'lang', header: 'Lang', render: (r) => <Badge tone="muted">{r.config?.language === 'hi' ? 'हिं' : 'EN'}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'scheduledAt', header: 'Scheduled', render: (r) => (r.scheduledAt ? dateTime(r.scheduledAt) : '—') },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-3">
          <button onClick={() => copyLink(r._id)} title="Copy link" className="text-muted-foreground hover:text-foreground"><Link2 className="h-4 w-4" /></button>
          <button onClick={() => invite.mutate(r._id)} title="Send invite" className="text-primary hover:text-primary/80"><Send className="h-4 w-4" /></button>
          {['in_progress', 'paused', 'flagged'].includes(r.status) && (
            <Link href={`/dashboard/interviews/${r._id}/monitor`} title="Monitor live" className="text-accent hover:text-accent/80"><Activity className="h-4 w-4" /></Link>
          )}
          {['scheduled', 'in_progress', 'paused'].includes(r.status) && (
            <button onClick={() => cancel.mutate(r._id)} title="Cancel" className="text-destructive hover:text-destructive/80"><XCircle className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  const toggleType = (t: string) => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  return (
    <div>
      <PageHeader title="Interviews" description="Schedule AI interviews (English or Hindi) and send invitations."
        action={<Button size="sm" magnetic={false} onClick={openModal}><Plus className="h-4 w-4" /> Schedule</Button>} />
      <DataTable columns={columns} rows={data?.items ?? []} loading={isLoading} rowKey={(r) => r._id} page={data?.meta.page} pages={data?.meta.pages} total={data?.meta.total} onPageChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} size="3xl" title="Schedule interview"
        description="Configure the language, format, and rules — everything stays consistent through the whole session."
        footer={<><Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button><Button magnetic={false} loading={schedule.isPending} disabled={!candidate} onClick={() => schedule.mutate()}>Schedule</Button></>}
      >
        <div className="space-y-5">
          <Select label="Candidate" value={candidate} onChange={setCandidate}
            options={[{ label: 'Select a candidate…', value: '' }, ...(candidates?.items ?? []).map((c: any) => ({ label: `${c.name} (${c.email})`, value: c._id }))]} />

          {/* Language — headline setting */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium"><Languages className="h-4 w-4 text-primary" /> Interview language</span>
            <div className="flex gap-2">
              {[['en', 'English'], ['hi', 'हिन्दी (Hindi)']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setC('language', v)}
                  className={cn('flex-1 rounded-lg border px-4 py-2 text-sm transition', cfg.language === v ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Questions, conversation, voice, answers, scoring, feedback, and the report all use this language.</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cfg.allowLanguageChange} onChange={(e) => setC('allowLanguageChange', e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Let the candidate switch language mid-interview <span className="text-xs text-muted-foreground">(off = locked; changes are logged)</span>
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Interview type</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} type="button" onClick={() => toggleType(t)}
                  className={cn('rounded-full border px-4 py-1.5 text-sm transition', types.includes(t) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>{titleCase(t)}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Select multiple for a mixed interview.</p>
          </div>

          <Section title="Questions" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Question set (fixed)"
              value={questionSet}
              onChange={setQuestionSet}
              options={[
                { label: 'None — pick questions automatically', value: '' },
                ...(sets?.items ?? []).map((s: any) => ({
                  label: `${s.name} · ${questionCountOf(s)} question${questionCountOf(s) === 1 ? '' : 's'}`,
                  value: s._id,
                })),
              ]}
            />
            <Select
              label="Round"
              value={round}
              onChange={setRound}
              options={[
                { label: 'Not specified', value: '' },
                ...INTERVIEW_ROUNDS.map((r) => ({ label: titleCase(r), value: r })),
              ]}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            A set asks every candidate the same questions in the same order — the only way to compare two people fairly.
            Leave it empty and the AI picks from your approved question bank, then writes its own if nothing fits.
          </p>

          <div>
            <Select
              label="Ground questions in a Knowledge Base"
              value={knowledgeBase}
              onChange={setKnowledgeBase}
              options={[
                { label: 'None — AI generates from the role / JD', value: '' },
                ...(kbs ?? []).filter((k: any) => k.status === 'active').map((k: any) => ({ label: k.category ? `${k.name} · ${titleCase(k.category)}` : k.name, value: k._id })),
              ]}
            />
            <p className="mt-1 text-xs text-muted-foreground">Questions are grounded in this collection; the AI still adds dynamic follow-ups based on the candidate’s answers.</p>
          </div>

          <Section title="Format" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Select label="Duration" value={customDuration ? 'custom' : String(cfg.durationMinutes)}
                onChange={(v) => { if (v === 'custom') setCustomDuration(true); else { setCustomDuration(false); setC('durationMinutes', Number(v)); } }}
                options={[...DURATIONS.map((d) => ({ label: `${d} min`, value: String(d) })), { label: 'Custom…', value: 'custom' }]} />
              {customDuration && <input type="number" min={5} max={600} value={cfg.durationMinutes} onChange={(e) => setC('durationMinutes', Number(e.target.value) || 30)} placeholder="Minutes" className="mt-2 h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus:border-primary" />}
            </div>
            <NumField label="Number of questions" value={cfg.questionCount} onChange={(v) => setC('questionCount', v)} min={1} max={50} />
            {/* Background questions are ADDITIVE — they don't come out of the
                question count above, so this never shrinks the real interview. */}
            <Select label="Background questions" value={cfg.introCount} onChange={(v) => setC('introCount', v)}
              options={[['', 'Auto (recommended)'], ['0', 'None — go straight to questions'], ['1', '1 · background'], ['2', '2 · + projects'], ['3', '3 · + motivation']].map(([v, l]) => ({ label: l, value: v }))} />
            <Select label="Difficulty" value={cfg.difficulty} onChange={(v) => setC('difficulty', v)} options={[['easy', 'Beginner'], ['medium', 'Intermediate'], ['hard', 'Advanced'], ['expert', 'Expert']].map(([v, l]) => ({ label: l, value: v }))} />
            {/* 'junior' is a real EXPERIENCE_LEVEL and was missing here, so the
                one level between fresher and mid could not be picked at all. */}
            <Select label="Experience level" value={cfg.experienceLevel} onChange={(v) => setC('experienceLevel', v)} options={[['', 'Any'], ['fresher', 'Fresher'], ['junior', 'Junior'], ['mid', 'Mid-level'], ['senior', 'Senior'], ['lead', 'Lead']].map(([v, l]) => ({ label: l, value: v }))} />
            <NumField label="Passing score (%)" value={cfg.passingScore} onChange={(v) => setC('passingScore', v)} min={0} max={100} />
            <NumField label="Time / question (sec, 0 = none)" value={cfg.timePerQuestionSeconds} onChange={(v) => setC('timePerQuestionSeconds', v)} min={0} max={3600} />
            <NumField label="Max retry attempts" value={cfg.maxRetries} onChange={(v) => setC('maxRetries', v)} min={0} max={10} />
          </div>

          <Section title="Behaviour" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle label="AI follow-up questions" checked={cfg.followUps} onChange={(v) => setC('followUps', v)} />
            <Toggle label="Adaptive difficulty" checked={cfg.adaptiveDifficulty} onChange={(v) => setC('adaptiveDifficulty', v)} />
            <Toggle label="Random question order" checked={cfg.randomOrder} onChange={(v) => setC('randomOrder', v)} />
            <Toggle label="Auto-submit on time expiry" checked={cfg.autoSubmit} onChange={(v) => setC('autoSubmit', v)} />
            <Toggle label="Resume-based questions" checked={cfg.resumeBased} onChange={(v) => setC('resumeBased', v)} />
            <Toggle label="Job-description-based questions" checked={cfg.jdBased} onChange={(v) => setC('jdBased', v)} />
          </div>

          <Section title="Media & anti-cheating" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle label="Voice interview" checked={cfg.voiceEnabled} onChange={(v) => setC('voiceEnabled', v)} />
            <Toggle label="Video interview" checked={cfg.videoEnabled} onChange={(v) => setC('videoEnabled', v)} />
            <Toggle label="Camera required" checked={cfg.cameraRequired} onChange={(v) => setC('cameraRequired', v)} />
            <Toggle label="Microphone required" checked={cfg.micRequired} onChange={(v) => setC('micRequired', v)} />
            <Toggle label="Anti-cheating / proctoring" checked={cfg.proctoring} onChange={(v) => setC('proctoring', v)} />
          </div>

          <Section title="Schedule window" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">Start (optional)</span>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus:border-primary" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">Expiry (optional)</span>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus:border-primary" /></label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Send invitation email immediately
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
    </label>
  );
}
function NumField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus:border-primary" />
    </label>
  );
}
