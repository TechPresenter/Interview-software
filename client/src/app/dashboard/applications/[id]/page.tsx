'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Download, Printer, Trash2, Loader2, AlertTriangle, Eye, FileText,
  ShieldCheck, StickyNote,
} from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import {
  applicationsApi, isPaid, APPLICATION_STATUSES, PAYMENT_VERDICTS,
  PAYMENT_LABELS, PAYMENT_TONES, STATUS_LABELS, STATUS_TONES,
  type Application, type ApplicationFile, type ApplicationNote, type ApplicationPaymentStatus,
  type ApplicationStatus,
} from '@/lib/applications.api';
import { date, dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';

const controlCls =
  'rounded-xl border border-input bg-card/60 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

/**
 * The application fee.
 *
 * `payment.amount` is frozen from the `applications.fee` setting, which an admin
 * types in whole currency units — unlike the billing Payment model's minor
 * units, so lib/format's money() would render a ₹500 fee as ₹5.
 */
function fee(amount?: number, currency = 'INR') {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    // `currency` is a free-text setting, so it is not necessarily an ISO code.
    return `${amount} ${currency}`;
  }
}

const fileSize = (b?: number) =>
  b == null ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/**
 * Load an applicant file for inline display.
 *
 * The bytes sit behind GET /admin/applications/:id/file/:kind, which requires
 * the Bearer token that lib/api.ts's request interceptor injects. `<img src>` is
 * a browser-issued subresource fetch: it carries cookies but no Authorization
 * header, so it would simply 401 — and the token lives in memory (the httpOnly
 * cookie is only the refresh token), so there is no cookie for the browser to
 * fall back on either. Signed URLs would defeat the point of the route existing:
 * a URL that works without a session is a URL that leaks.
 *
 * So we fetch through the same axios instance as everything else — inheriting
 * the header injection and the single-flight 401 refresh — and hand the element
 * a local blob: URL instead.
 */
function useAuthedFile(id: string, kind: 'resume' | 'photo', enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let objectUrl: string | null = null;
    setError(false);

    applicationsApi
      .fileBlob(id, kind)
      .then((blob) => {
        const next = URL.createObjectURL(blob);
        // Resolving after unmount still allocates — revoke rather than orphan it.
        if (cancelled) { URL.revokeObjectURL(next); return; }
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      // The blob is pinned in memory until revoked; an admin working through a
      // queue would otherwise leak a file per application opened.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [id, kind, enabled]);

  return { url, error };
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = useAuth((s) => s.user?.role) === 'super_admin';

  const [status, setStatus] = useState<ApplicationStatus>('pending');
  const [verdict, setVerdict] = useState<ApplicationPaymentStatus | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmNote, setConfirmNote] = useState<ApplicationNote | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.get(id),
    enabled: isAdmin && !!id,
  });

  useEffect(() => { if (app) setStatus(app.status); }, [app]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['application', id] });
    qc.invalidateQueries({ queryKey: ['applications'] });
  };
  const fail = (e: any, fallback: string) => toast.error(e?.response?.data?.message || fallback);

  const saveStatus = useMutation({
    mutationFn: () => applicationsApi.setStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); refresh(); },
    onError: (e) => fail(e, 'Could not update the status'),
  });

  const savePayment = useMutation({
    mutationFn: () => applicationsApi.setPayment(id, verdict as ApplicationPaymentStatus, paymentNote || undefined),
    onSuccess: () => { toast.success('Payment verdict recorded'); setVerdict(''); setPaymentNote(''); refresh(); },
    onError: (e) => fail(e, 'Could not record the verdict'),
  });

  const addNote = useMutation({
    mutationFn: () => applicationsApi.addNote(id, note.trim()),
    onSuccess: () => { toast.success('Note added'); setNote(''); refresh(); },
    onError: (e) => fail(e, 'Could not add the note'),
  });

  const removeNote = useMutation({
    mutationFn: (noteId: string) => applicationsApi.deleteNote(id, noteId),
    onSuccess: () => { toast.success('Note deleted'); refresh(); },
    onError: (e) => fail(e, 'Could not delete the note'),
  });

  const del = useMutation({
    mutationFn: () => applicationsApi.remove(id),
    onSuccess: () => {
      toast.success('Application deleted');
      qc.invalidateQueries({ queryKey: ['applications'] });
      router.push('/dashboard/applications');
    },
    onError: (e) => fail(e, 'Could not delete the application'),
  });

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Application" />
        <GlassCard><p className="text-sm text-muted-foreground">This area is available to platform administrators.</p></GlassCard>
      </div>
    );
  }

  if (isLoading) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/applications')}>
          <ArrowLeft className="h-4 w-4" /> Back to applications
        </Button>
        <GlassCard><p className="text-sm text-muted-foreground">Application not found.</p></GlassCard>
      </div>
    );
  }

  const downloadPdf = async () => {
    setDownloading(true);
    try { await applicationsApi.downloadPdf(id, `${app.applicationId}.pdf`); }
    catch { toast.error('Could not generate the PDF'); }
    finally { setDownloading(false); }
  };

  const paid = isPaid(app.payment);
  const claimed = app.payment?.status === 'claimed';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={app.fullName}
          description={`${app.applicationId} · submitted ${dateTime(app.submittedAt)}`}
        />
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="ghost" size="sm" magnetic={false} onClick={() => router.push('/dashboard/applications')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="ghost" size="sm" magnetic={false} onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" variant="glass" magnetic={false} loading={downloading} onClick={downloadPdf}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button size="sm" variant="ghost" magnetic={false} className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONES[app.status]} className="normal-case">{STATUS_LABELS[app.status]}</Badge>
        <Badge tone={PAYMENT_TONES[app.payment?.status ?? 'unpaid']} className="normal-case">
          {claimed && <AlertTriangle className="h-3 w-3" />}
          {PAYMENT_LABELS[app.payment?.status ?? 'unpaid']}
        </Badge>
        {app.convertedCandidate && <Badge tone="info" className="normal-case">Converted to candidate</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Personal">
            <Facts
              rows={[
                ['Full name', app.fullName],
                ['Email', <a key="e" href={`mailto:${app.email}`} className="text-primary hover:underline">{app.email}</a>],
                ['Mobile', app.mobile],
                ['Alternate mobile', app.altMobile],
                ['Date of birth', app.dob ? date(app.dob) : undefined],
                ['Gender', app.gender],
              ]}
            />
          </Section>

          <Section title="Address">
            <Facts
              rows={[
                ['Address', app.address],
                ['City', app.city],
                ['State', app.state],
                ['Country', app.country],
                ['PIN code', app.pinCode],
              ]}
            />
          </Section>

          <Section title="Education">
            <Facts
              rows={[
                ['Highest qualification', app.highestQualification],
                ['College', app.college],
                ['Passing year', app.passingYear],
              ]}
            />
          </Section>

          <Section title="Professional">
            <Facts
              rows={[
                ['Preferred job role', app.preferredJobRole],
                ['Interview language', app.preferredLanguage === 'hi' ? 'Hindi' : 'English'],
                ['Experience', app.experienceType === 'experienced' ? 'Experienced' : 'Fresher'],
                ['Total experience', app.totalExperienceYears != null ? `${app.totalExperienceYears} years` : undefined],
                ['Current company', app.currentCompany],
                ['Current job title', app.currentJobTitle],
                ['Current salary', app.currentSalary],
                ['Expected salary', app.expectedSalary],
                ['Notice period', app.noticePeriod],
                ['LinkedIn', app.linkedin ? <ExtLink key="l" href={app.linkedin} /> : undefined],
                ['Portfolio', app.portfolio ? <ExtLink key="p" href={app.portfolio} /> : undefined],
                ['Skills', app.skills?.length
                  ? <div key="s" className="flex flex-wrap gap-1.5">{app.skills.map((s) => <Badge key={s} tone="muted" className="normal-case">{s}</Badge>)}</div>
                  : undefined],
              ]}
            />
          </Section>

          <Section title="Documents">
            <div className="space-y-5">
              <PhotoPreview id={id} photo={app.photo} />
              <ResumePreview id={id} resume={app.resume} />
            </div>
          </Section>

          <Section title="Declaration">
            {app.declaration?.accepted ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm text-accent">
                  <ShieldCheck className="h-4 w-4" /> Accepted {app.declaration.acceptedAt ? `on ${dateTime(app.declaration.acceptedAt)}` : ''}
                </p>
                {/* The wording frozen at submission — not today's text. */}
                {app.declaration.text && (
                  <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">{app.declaration.text}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not accepted.</p>
            )}
          </Section>

          <Section title="Payment">
            {claimed && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">The applicant says they paid.</span>{' '}
                  Nothing has confirmed it — the Pay Now button is a redirect and reports nothing back. Check the
                  reference against the provider before recording a verdict.
                </p>
              </div>
            )}
            <Facts
              rows={[
                ['State', <Badge key="s" tone={PAYMENT_TONES[app.payment?.status ?? 'unpaid']} className="normal-case">{PAYMENT_LABELS[app.payment?.status ?? 'unpaid']}</Badge>],
                ['Fee charged', fee(app.payment?.amount, app.payment?.currency)],
                ['Reference (their claim)', app.payment?.reference ? <span key="r" className="font-mono text-xs">{app.payment.reference}</span> : undefined],
                ['Claimed at', app.payment?.claimedAt ? dateTime(app.payment.claimedAt) : undefined],
                ['Verified at', app.payment?.verifiedAt ? dateTime(app.payment.verifiedAt) : undefined],
                ['Verified by', typeof app.payment?.verifiedBy === 'object' ? app.payment?.verifiedBy?.name : undefined],
                ['Admin note', app.payment?.note],
              ]}
            />
          </Section>

          {(app.statusHistory?.length ?? 0) > 0 && (
            <Section title="Status history">
              <div className="space-y-2">
                {[...(app.statusHistory ?? [])].reverse().map((h, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 text-sm last:border-0">
                    <span>
                      <span className="text-muted-foreground">{h.from ? STATUS_LABELS[h.from] : '—'} → </span>
                      <span className="font-medium">{STATUS_LABELS[h.to]}</span>
                      {h.byName && <span className="text-xs text-muted-foreground"> · {h.byName}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateTime(h.at)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Review controls */}
        <div className="space-y-6 print:hidden">
          <GlassCard>
            <h2 className="mb-4 text-sm font-semibold">Review status</h2>
            <div className="space-y-3">
              <Select
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as ApplicationStatus)}
                options={APPLICATION_STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s }))}
              />
              <Button
                size="sm"
                magnetic={false}
                className="w-full"
                loading={saveStatus.isPending}
                disabled={status === app.status}
                onClick={() => saveStatus.mutate()}
              >
                Update status
              </Button>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="mb-1 text-sm font-semibold">Payment verification</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Only a verdict here can mark this application paid.
            </p>
            <div className="space-y-3">
              <Select
                label="Verdict"
                value={verdict}
                onChange={(v) => setVerdict(v as ApplicationPaymentStatus | '')}
                options={[
                  { label: 'Select a verdict…', value: '' },
                  ...PAYMENT_VERDICTS.map((s) => ({ label: PAYMENT_LABELS[s], value: s })),
                ]}
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Note</span>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Why it was rejected or waived…"
                  className={cn(controlCls, 'w-full resize-y')}
                />
              </label>
              <Button
                size="sm"
                magnetic={false}
                className="w-full"
                loading={savePayment.isPending}
                // Never send the empty string an unselected option produces.
                disabled={!verdict}
                onClick={() => savePayment.mutate()}
              >
                Record verdict
              </Button>
              <p className={cn('text-xs', paid ? 'text-accent' : 'text-muted-foreground')}>
                {paid
                  ? `Counted as paid (${PAYMENT_LABELS[app.payment.status].toLowerCase()}).`
                  : 'Not counted as paid.'}
              </p>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <StickyNote className="h-4 w-4 text-primary" /> Internal notes
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">Never shown to the applicant.</p>
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Add a note for the review team…"
                className={cn(controlCls, 'w-full resize-y')}
              />
              <Button
                size="sm"
                variant="glass"
                magnetic={false}
                className="w-full"
                loading={addNote.isPending}
                disabled={!note.trim()}
                onClick={() => addNote.mutate()}
              >
                Add note
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {(app.notes?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              {[...(app.notes ?? [])].reverse().map((n) => (
                <div key={n._id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {n.byName || (typeof n.by === 'object' ? n.by?.name : '') || 'Unknown'} · {dateTime(n.at)}
                    </span>
                    <button
                      onClick={() => setConfirmNote(n)}
                      title="Delete note"
                      aria-label="Delete note"
                      className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); del.mutate(); }}
        title={`Delete ${app.applicationId}?`}
        description="This permanently removes the application, its notes, and its uploaded resume and photo. The applicant is not told. If you only want it out of the queue, reject it instead — that also frees them to apply again."
        confirmLabel="Delete"
        loading={del.isPending}
        danger
      />

      <ConfirmDialog
        open={!!confirmNote}
        onClose={() => setConfirmNote(null)}
        onConfirm={() => { if (confirmNote) removeNote.mutate(confirmNote._id); setConfirmNote(null); }}
        title="Delete this note?"
        description="The note is removed for everyone on the review team."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

/* ── Documents ────────────────────────────────────────────────────────────── */

function PhotoPreview({ id, photo }: { id: string; photo?: ApplicationFile | null }) {
  // Small, capped at 3 MB by the upload middleware, and the first thing a
  // reviewer looks for — so unlike the resume it loads without being asked.
  const { url, error } = useAuthedFile(id, 'photo', !!photo);

  if (!photo) return <FileRow label="Photo" empty />;
  return (
    <div>
      <FileRow label="Photo" file={photo} onDownload={() => applicationsApi.downloadFile(id, 'photo', photo.originalName || 'photo')} />
      <div className="mt-2 h-40 w-32 overflow-hidden rounded-xl border border-border bg-muted/20">
        {error ? (
          <p className="grid h-full place-items-center px-2 text-center text-xs text-muted-foreground">Could not load</p>
        ) : url ? (
          <img src={url} alt="Applicant photo" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        )}
      </div>
    </div>
  );
}

function ResumePreview({ id, resume }: { id: string; resume?: ApplicationFile | null }) {
  // Up to 15 MB, so it is fetched only when asked for — an admin skimming a
  // queue should not pull a CV per page view.
  const [show, setShow] = useState(false);
  const { url, error } = useAuthedFile(id, 'resume', show && !!resume);

  if (!resume) return <FileRow label="Resume" empty />;

  const type = resume.mimeType || '';
  const isImage = type.startsWith('image/'); // a phone photo of a CV — the upload filter allows it
  const inline = type === 'application/pdf' || type === 'text/plain' || isImage;

  return (
    <div>
      <FileRow
        label="Resume"
        file={resume}
        onDownload={() => applicationsApi.downloadFile(id, 'resume', resume.originalName || 'resume')}
        action={
          inline ? (
            <button onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
              <Eye className="h-3.5 w-3.5" /> {show ? 'Hide preview' : 'Preview'}
            </button>
          ) : undefined
        }
      />
      {!inline && (
        // Word documents have no in-browser viewer; pretending otherwise would
        // render an empty frame and read as a broken file.
        <p className="mt-2 text-xs text-muted-foreground">No in-browser preview for this format — download it to read.</p>
      )}
      {show && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-muted/20">
          {error ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Could not load the resume.</p>
          ) : !url ? (
            <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : isImage ? (
            <img src={url} alt="Resume" className="max-h-[520px] w-full object-contain" />
          ) : (
            <iframe src={url} title="Resume" className="h-[520px] w-full" />
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({
  label, file, empty, onDownload, action,
}: {
  label: string;
  file?: ApplicationFile;
  empty?: boolean;
  onDownload?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">{label}</span>
      {empty ? (
        <span className="text-muted-foreground">Not provided</span>
      ) : (
        <>
          <span className="min-w-0 break-all text-muted-foreground">{file?.originalName || file?.filename}</span>
          {file?.sizeBytes != null && <span className="text-xs text-muted-foreground">{fileSize(file.sizeBytes)}</span>}
          {action}
          <button onClick={onDownload} className="inline-flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </>
      )}
    </div>
  );
}

/* ── Layout primitives ────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <h2 className="mb-4 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </GlassCard>
  );
}

/**
 * Blanks render as '—' rather than being dropped: which fields an applicant
 * skipped is part of what a reviewer is judging.
 */
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(140px,180px)_1fr]">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v === undefined || v === null || v === '' ? <span className="text-muted-foreground">—</span> : v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function ExtLink({ href }: { href: string }) {
  // Applicant-supplied, so it is untrusted: noreferrer stops the target learning
  // where the link was clicked from, and noopener denies it window.opener.
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary hover:underline">
      {href}
    </a>
  );
}
