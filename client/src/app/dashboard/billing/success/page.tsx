'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Download, ReceiptText, XCircle } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { useAuth } from '@/store/auth.store';
import { money, date, titleCase } from '@/lib/format';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/billing/Confetti';

/**
 * The page the gateway returns the browser to after a subscription payment.
 *
 * The redirect itself proves nothing — anyone can type this URL. Everything
 * shown here comes from the server verifying the order against the gateway:
 * POST /billing/cashfree/verify (company admins; also the activation fallback
 * when the webhook is late/lost) or, for roles that may not activate,
 * GET /billing/receipt polling until the webhook lands. While the payment is
 * settling we re-check every 3s for up to a minute.
 */

type Receipt = {
  _id: string;
  invoiceNumber?: string;
  amount: number;
  currency?: string;
  status: string;
  method?: string;
  provider?: string;
  providerPaymentId?: string;
  planKey?: string;
  billingCycle?: string;
  paidAt?: string;
};

type Phase = 'checking' | 'paid' | 'pending' | 'failed' | 'slow';

const POLL_MS = 3000;
const GIVE_UP_MS = 60_000;

function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get('cf_order_id') || params.get('order_id') || '';
  // Stripe returns with session_id instead of an order id — its activation is
  // webhook-only, so that path polls our own records rather than verifying.
  const stripeSession = params.get('session_id') || '';
  const qc = useQueryClient();
  const userName = useAuth((s) => s.user?.name);

  const [phase, setPhase] = useState<Phase>('checking');
  const [payment, setPayment] = useState<Receipt | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const celebrate = useCallback(
    (p: Receipt, sub: any) => {
      if (done.current) return;
      done.current = true;
      setPayment(p);
      setSubscription(sub);
      setPhase('paid');
      // The plan is live server-side the moment activation ran; these three
      // keys are every surface that renders it — no re-login needed.
      qc.invalidateQueries({ queryKey: ['billing'] });
      qc.invalidateQueries({ queryKey: ['billing-invoices'] });
      qc.invalidateQueries({ queryKey: ['company-overview'] });
    },
    [qc],
  );

  useEffect(() => {
    if (!orderId && !stripeSession) {
      setPhase('failed');
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    /** Schedule the next poll — or settle on the calm 'slow' screen. */
    const again = (fn: () => Promise<void>) => {
      if (cancelled || done.current) return;
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setPhase('slow');
        return;
      }
      setPhase('pending');
      timer = setTimeout(fn, POLL_MS);
    };

    /**
     * Stripe path: activation is webhook-driven, so poll our own records until
     * the fresh stripe invoice appears. Time-boxed like the Cashfree path.
     */
    const checkStripe = async () => {
      if (cancelled || done.current) return;
      try {
        const [summary, invoices] = await Promise.all([companyApi.billing(), companyApi.billingInvoices()]);
        const fresh = (invoices as any[] | undefined)?.find(
          (p) => p.provider === 'stripe' && p.status === 'paid'
            && new Date(p.paidAt || p.createdAt).getTime() > startedAt.current - 15 * 60_000,
        );
        if (fresh) return celebrate(fresh, (summary as any)?.subscription);
      } catch {
        /* transient — keep polling */
      }
      again(checkStripe);
    };

    const check = async () => {
      if (cancelled || done.current) return;
      try {
        // Admins verify (which also activates when the webhook is late)…
        const res: any = await companyApi.verifyCashfree(orderId);
        if (cancelled) return;
        if (res?.status === 'paid' && res.payment) return celebrate(res.payment, res.subscription);
        // Only the gateway's own explicit verdict is terminal.
        if (res?.status === 'failed') return setPhase('failed');
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        const code = err?.response?.data?.code;
        if (status === 403 && code === 'ORDER_TENANT_MISMATCH') {
          // Honest and terminal: this order was paid by a different workspace.
          setFailReason('This payment belongs to a different workspace. Sign in to the workspace that made the purchase to see its receipt.');
          return setPhase('failed');
        }
        if (status === 403) {
          // …other billing-read roles fall back to the read-only receipt,
          // which appears as soon as the webhook lands.
          try {
            const r: any = await companyApi.billingReceipt(orderId);
            if (r?.status === 'paid' && r.payment) return celebrate(r.payment, r.subscription);
          } catch {
            /* 404 = not landed yet — keep polling */
          }
        }
        // Everything else — a transient Cashfree read failure, a network blip,
        // a 404 — must NOT tell a possibly-charged customer their payment
        // failed. Keep polling; the webhook activates regardless.
      }
      again(check);
    };

    void (orderId ? check() : checkStripe());
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, stripeSession, celebrate]);

  if (phase === 'checking' || phase === 'pending') {
    return (
      <CenterCard>
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <h1 className="mt-6 font-display text-2xl font-bold">Confirming your payment…</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          This usually takes a few seconds. Please don&apos;t close this tab — we&apos;re activating your plan.
        </p>
      </CenterCard>
    );
  }

  if (phase === 'slow') {
    return (
      <CenterCard>
        <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-6 font-display text-2xl font-bold">Taking a little longer than usual</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Your payment is still being confirmed by the gateway. If you were charged, your plan will activate
          automatically — check back on the billing page in a minute.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard/billing"><Button magnetic={false}>Go to billing <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </CenterCard>
    );
  }

  if (phase === 'failed') {
    return (
      <CenterCard>
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-6 font-display text-2xl font-bold">Payment not completed</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {failReason
            || (orderId || stripeSession
              ? "This payment didn't go through. If the money left your account it will be auto-refunded by the gateway — otherwise you have not been charged."
              : 'This page confirms a payment, but no order was referenced. Start an upgrade from the billing page.')}
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard/billing"><Button magnetic={false}>Back to billing <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </CenterCard>
    );
  }

  /* ── Paid: the celebration ─────────────────────────────────────────────── */
  const expiry = subscription?.currentPeriodEnd;
  const rows: Array<[string, React.ReactNode]> = [
    ['Name', userName || '—'],
    ['Activated plan', payment?.planKey ? titleCase(payment.planKey) : titleCase(subscription?.plan || '—')],
    ['Plan duration', payment?.billingCycle === 'yearly' ? '12 months' : payment?.billingCycle === 'monthly' ? '1 month' : '—'],
    ['Activation date', date(payment?.paidAt)],
    ['Expiry / renews on', expiry ? date(expiry) : '—'],
    ['Amount paid', payment ? money(payment.amount, payment.currency) : '—'],
    ['Payment method', (payment?.method || payment?.provider || '—').toUpperCase()],
    ['Transaction ID', payment?.providerPaymentId || '—'],
    ['Invoice number', payment?.invoiceNumber || '—'],
    ['Payment status', <Badge key="st" tone="success">Success</Badge>],
  ];

  return (
    <div className="relative">
      <Confetti />
      <div className="mx-auto max-w-2xl py-6">
        {/* Animated checkmark: circle sweep + tick draw. */}
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-brand shadow-xl shadow-primary/40">
          <svg viewBox="0 0 52 52" className="h-14 w-14">
            <motion.circle
              cx="26" cy="26" r="23" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <motion.path
              d="M14 27 L22.5 35.5 L38 18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="mt-6 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Congratulations{userName ? `, ${userName.split(' ')[0]}` : ''}! 🎉
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Thank you for your purchase. Your <span className="font-semibold text-foreground">{payment?.planKey ? titleCase(payment.planKey) : 'new'}</span> plan
            is active — every limit and feature is live right now, no sign-out needed.
          </p>
        </motion.div>

        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
          <GlassCard className="mt-8">
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
              <ReceiptText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Payment receipt</h2>
            </div>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 sm:border-0 sm:pb-0">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right text-sm font-medium" title={typeof value === 'string' ? value : undefined}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button className="w-full sm:w-auto" magnetic={false} onClick={() => payment && companyApi.downloadInvoice(payment._id)}>
                <Download className="h-4 w-4" /> Download Invoice (PDF)
              </Button>
              <Link href="/dashboard" className="w-full sm:w-auto"><Button variant="glass" magnetic={false} className="w-full">Go to Dashboard</Button></Link>
              <Link href="/dashboard/billing" className="w-full sm:w-auto"><Button variant="ghost" magnetic={false} className="w-full">Manage billing</Button></Link>
            </div>
          </GlassCard>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-4 text-center text-xs text-muted-foreground">
          A confirmation email with your PDF invoice attached is on its way to your billing address.
        </motion.p>
      </div>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <GlassCard className="p-8">{children}</GlassCard>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-16 h-64 max-w-lg animate-pulse rounded-2xl bg-muted/40" />}>
      <SuccessInner />
    </Suspense>
  );
}
