'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Copy, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { applyApi } from '@/lib/apply.api';
import { openCashfreeCheckout } from '@/lib/cashfree';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

/**
 * The page an applicant lands on returning from Cashfree.
 *
 * It never trusts the redirect as proof of payment: it asks the server, which
 * reconciles the order against the gateway. While the (signed) webhook is still
 * in flight the status reads `pending`, so this polls for a few seconds before
 * settling — and offers a Retry that re-opens checkout for anyone who bailed out.
 */
export function ApplyStatus() {
  const code = useSearchParams().get('code') || '';
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['apply-status', code],
    queryFn: () => applyApi.status(code),
    enabled: !!code,
    // Keep asking while the payment is still settling; stop the moment it lands
    // on any terminal state so we are not polling the gateway forever.
    refetchInterval: (query) => (query.state.data?.payment?.status === 'pending' ? 3000 : false),
  });

  const retry = async () => {
    setBusy(true);
    try {
      const session = await applyApi.checkout(code);
      if (session.paid || !session.paymentSessionId) {
        await refetch();
        return;
      }
      await openCashfreeCheckout(session.paymentSessionId, session.mode);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not reopen the payment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyId = async (id: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(id);
    toast.info('Application ID copied');
  };

  if (!code) {
    return (
      <Shell tone="error" icon={ShieldAlert} title="No application referenced">
        This link is missing its application code. If you were paying an application fee, use the link from your email.
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell tone="muted" icon={Clock} title="Checking your payment…" spinner>
        One moment while we confirm the status of your application.
      </Shell>
    );
  }

  if (isError || !data) {
    return (
      <Shell tone="error" icon={ShieldAlert} title="We couldn't load your application">
        Please refresh in a moment. If this keeps happening, contact us with your application ID.
      </Shell>
    );
  }

  const pay = data.payment.status;
  const paid = pay === 'verified' || pay === 'waived';

  if (paid) {
    return (
      <Shell tone="success" icon={CheckCircle2} title="Payment received — application submitted">
        <p>
          Thanks{data.name ? `, ${data.name.split(' ')[0]}` : ''}. Your fee is paid and your application is now in the review
          queue. We&apos;ve emailed a confirmation.
        </p>
        <IdChip id={data.applicationId} onCopy={copyId} />
      </Shell>
    );
  }

  if (pay === 'pending') {
    return (
      <Shell tone="muted" icon={Clock} title="Confirming your payment…" spinner>
        <p>
          This usually takes a few seconds. If you didn&apos;t finish paying, you can reopen the secure payment below — your
          application details are saved.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={retry} loading={busy} magnetic={false}>
            <RefreshCw className="h-4 w-4" /> Retry payment
          </Button>
          <Button variant="glass" onClick={() => refetch()} magnetic={false}>Refresh status</Button>
        </div>
        <IdChip id={data.applicationId} onCopy={copyId} />
      </Shell>
    );
  }

  // failed / unpaid / claimed
  return (
    <Shell tone="error" icon={XCircle} title="Your payment didn't go through">
      <p>No money was taken. You can try the payment again — nothing else you entered has been lost.</p>
      <div className="mt-5 flex justify-center">
        <Button onClick={retry} loading={busy} magnetic={false}>
          <RefreshCw className="h-4 w-4" /> Try payment again
        </Button>
      </div>
      <IdChip id={data.applicationId} onCopy={copyId} />
    </Shell>
  );
}

/* ── Presentational bits ─────────────────────────────── */

const TONES: Record<string, string> = {
  success: 'border-border bg-card/40',
  muted: 'border-border bg-card/40',
  error: 'border-destructive/40 bg-destructive/5',
};

function Shell({
  tone, icon: Icon, title, spinner, children,
}: {
  tone: 'success' | 'muted' | 'error';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  spinner?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto max-w-lg rounded-2xl border p-8 text-center ${TONES[tone]}`}>
      {spinner ? (
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      ) : (
        <Icon className={`mx-auto h-12 w-12 ${tone === 'success' ? 'text-accent' : tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
      )}
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function IdChip({ id, onCopy }: { id: string; onCopy: (id: string) => void }) {
  if (!id) return null;
  return (
    <div className="mx-auto mt-6 inline-flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="font-mono text-sm font-bold tracking-tight text-primary">{id}</span>
      <button type="button" onClick={() => onCopy(id)} title="Copy application ID"
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground">
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

export default ApplyStatus;
