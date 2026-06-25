'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Download } from 'lucide-react';
import { companyApi } from '@/lib/company.api';
import { money, date, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

export default function BillingPage() {
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data } = useQuery({ queryKey: ['billing'], queryFn: companyApi.billing });
  const { data: invoices } = useQuery({ queryKey: ['billing-invoices'], queryFn: companyApi.billingInvoices });

  const currentPlan = data?.subscription?.plan || 'free';
  const provider = data?.providers?.[0]; // default to first configured provider

  const checkout = useMutation({
    mutationFn: (planKey: string) => companyApi.checkout({ provider, plan: planKey, billingCycle: cycle }),
    onSuccess: (res: any) => {
      if (res?.url) {
        window.location.href = res.url; // Stripe hosted checkout
      } else if (res?.orderId) {
        toast.info('Razorpay order created — open the Razorpay checkout widget to complete.');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Checkout unavailable'),
  });

  const cancel = useMutation({
    mutationFn: () => companyApi.cancelBilling(),
    onSuccess: () => {
      toast.success('Subscription cancelled');
      qc.invalidateQueries({ queryKey: ['billing'] });
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
      render: (r) => r.invoiceUrl ? (
        <a href={r.invoiceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
          <Download className="ml-auto h-4 w-4" />
        </a>
      ) : null,
    },
  ];

  return (
    <div className="space-y-8">
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
        <UsageMeter label="Interviews this month" used={data?.usage?.usage?.interviewsThisMonth} limit={data?.usage?.limits?.interviewsPerMonth} />
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

      {!provider && (
        <p className="text-sm text-yellow-400">No payment provider is configured. Set Stripe or Razorpay keys to enable checkout.</p>
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
