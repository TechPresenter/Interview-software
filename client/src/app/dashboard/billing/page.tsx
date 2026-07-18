'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Download } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { openCashfreeCheckout } from '@/lib/cashfree';
import { money, date, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

/**
 * The ?status=cancelled return from a gateway the user backed out of. Its own
 * component (inside Suspense) because useSearchParams demands a boundary, and
 * the whole page should not de-opt into client-side rendering for one toast.
 * Successful returns never land here — the gateway sends those to
 * /dashboard/billing/success, which verifies server-side.
 */
function CancelledNotice() {
  const status = useSearchParams().get('status');
  const announced = useRef(false);
  useEffect(() => {
    if (status === 'cancelled' && !announced.current) {
      announced.current = true;
      toast.info('Payment cancelled — you have not been charged.');
    }
  }, [status]);
  return null;
}

export default function BillingPage() {
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data } = useQuery({ queryKey: ['billing'], queryFn: companyApi.billing });
  const { data: invoices } = useQuery({ queryKey: ['billing-invoices'], queryFn: companyApi.billingInvoices });

  const currentPlan = data?.subscription?.plan || 'free';
  // Cashfree is the platform default gateway; fall back to any configured provider.
  const provider = data?.defaultProvider || data?.providers?.[0] || 'cashfree';

  const checkout = useMutation({
    mutationFn: (planKey: string) => companyApi.checkout({ provider, plan: planKey, billingCycle: cycle }),
    onSuccess: async (res: any) => {
      if (res?.provider === 'cashfree' && res?.paymentSessionId) {
        try {
          // Shared SDK loader (lib/cashfree) — full-tab redirect; the gateway
          // returns the browser to /dashboard/billing/success for verification.
          await openCashfreeCheckout(res.paymentSessionId, res.mode);
        } catch (err: any) {
          toast.error(err?.message || 'Could not open the Cashfree checkout — please try again.');
        }
      } else if (res?.url) {
        window.location.href = res.url; // Stripe hosted checkout
      } else if (res?.orderId) {
        toast.info('Order created — complete the payment in the checkout window.');
      } else {
        toast.error('Could not start the payment flow.');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Checkout unavailable'),
  });

  const cancel = useMutation({
    mutationFn: () => companyApi.cancelBilling(),
    onSuccess: () => {
      toast.success('Subscription cancelled');
      // All three surfaces that show the plan: billing page, invoice history,
      // and the dashboard's usage meters/onboarding step.
      qc.invalidateQueries({ queryKey: ['billing'] });
      qc.invalidateQueries({ queryKey: ['billing-invoices'] });
      qc.invalidateQueries({ queryKey: ['company-overview'] });
    },
  });

  const invoiceCols: Column<any>[] = [
    { key: 'invoiceNumber', header: 'Invoice', render: (r) => r.invoiceNumber || '—' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount, r.currency) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'paidAt', header: 'Date', render: (r) => date(r.paidAt || r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <button onClick={() => companyApi.downloadInvoice(r._id)} title="Download PDF invoice" className="ml-auto block text-muted-foreground transition hover:text-foreground">
          <Download className="ml-auto h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <CancelledNotice />
      </Suspense>
      <PageHeader
        title="Billing"
        description="Manage your plan, usage, and invoices."
        action={
          <div className="inline-flex rounded-xl border border-border p-1">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn('rounded-lg px-4 py-1.5 text-sm capitalize', cycle === c ? 'bg-gradient-brand text-white' : 'text-muted-foreground')}
              >
                {c}
              </button>
            ))}
          </div>
        }
      />

      {/* Usage */}
      <div className="grid gap-5 sm:grid-cols-3">
        <UsageCard label="Plan" value={titleCase(currentPlan)} sub={data?.subscription?.status} />
        <UsageMeter label="Active jobs" used={data?.usage?.usage?.activeJobs} limit={data?.usage?.limits?.activeJobs} />
        <UsageMeter label={currentPlan === 'free' ? 'Interviews (one-time)' : 'Interviews this month'} used={data?.usage?.usage?.interviewsUsed ?? data?.usage?.usage?.interviewsThisMonth} limit={data?.usage?.limits?.interviewsPerMonth} />
      </div>

      {/* Plans */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {(data?.plans ?? []).map((p: any) => {
          const price = cycle === 'yearly' ? p.pricing.yearly : p.pricing.monthly;
          const isCurrent = p.key === currentPlan;
          return (
            <GlassCard key={p._id} className={cn(p.isPopular && 'ring-1 ring-primary/40')}>
              {p.isPopular && <Badge className="mb-3">Popular</Badge>}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-2 text-3xl font-bold text-gradient">
                {price ? money(price, p.pricing.currency) : 'Custom'}
                {price ? <span className="text-sm text-muted-foreground">/{cycle === 'yearly' ? 'yr' : 'mo'}</span> : null}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {(p.features ?? []).map((f: string) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" /> {f}</li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                magnetic={false}
                variant={isCurrent ? 'glass' : 'primary'}
                disabled={isCurrent || !price || !provider || checkout.isPending}
                onClick={() => checkout.mutate(p.key)}
              >
                {isCurrent ? 'Current plan' : !price ? 'Contact sales' : <><CreditCard className="h-4 w-4" /> Upgrade</>}
              </Button>
            </GlassCard>
          );
        })}
      </div>

      {data && !(data.providers?.length) && (
        <p className="text-sm text-yellow-400">
          Cashfree isn’t configured on the server yet — add <code>CASHFREE_APP_ID</code> and <code>CASHFREE_SECRET_KEY</code> to enable checkout.
        </p>
      )}

      {/* Invoices */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoices</h2>
          {currentPlan !== 'free' && (
            <Button size="sm" variant="ghost" magnetic={false} onClick={() => cancel.mutate()}>Cancel subscription</Button>
          )}
        </div>
        <DataTable columns={invoiceCols} rows={invoices ?? []} emptyText="No invoices yet" rowKey={(r) => r._id} />
      </div>
    </div>
  );
}

function UsageCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <Badge tone={statusTone(sub)} className="mt-2">{sub}</Badge>}
    </GlassCard>
  );
}

function UsageMeter({ label, used = 0, limit }: { label: string; used?: number; limit?: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <GlassCard>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{used}{limit != null ? <span className="text-base text-muted-foreground"> / {limit}</span> : ''}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', pct > 90 ? 'bg-destructive' : 'bg-gradient-brand')} style={{ width: `${pct}%` }} />
      </div>
    </GlassCard>
  );
}
