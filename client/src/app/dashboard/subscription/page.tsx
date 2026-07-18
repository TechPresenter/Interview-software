'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { companyApi } from '@/lib/company.api';
import { titleCase, date, money } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function SubscriptionPage() {
  const role = useAuth((s) => s.user?.role);
  const isCompany = role === 'company_admin' || role === 'recruiter' || role === 'hr_manager';
  const { data } = useQuery({ queryKey: ['billing'], queryFn: companyApi.billing, enabled: isCompany });

  if (role === 'super_admin') {
    return (
      <div className="space-y-8">
        <PageHeader title="Subscription" description="Platform subscription management." />
        <GlassCard>
          <p className="text-sm text-muted-foreground">As the platform owner, you manage every company's subscription and the plan catalog.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard/subscriptions"><Button magnetic={false}>Open Subscriptions</Button></Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const sub = data?.subscription;
  return (
    <div className="space-y-8">
      <PageHeader title="Subscription" description="Your current plan." />
      <GlassCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <h2 className="text-2xl font-bold">{titleCase(sub?.plan || 'free')}</h2>
          </div>
          {sub?.status && <Badge tone={statusTone(sub.status)}>{sub.status}</Badge>}
        </div>
        {sub?.currentPeriodEnd && <p className="mt-2 text-sm text-muted-foreground">Renews {date(sub.currentPeriodEnd)}</p>}
        <Link href="/dashboard/billing" className="mt-4 inline-block"><Button magnetic={false}>Manage billing &amp; upgrade</Button></Link>
      </GlassCard>

      <PaymentHistory enabled={isCompany} />
    </div>
  );
}

/** Every invoice, downloadable right here — not only on the billing page. */
function PaymentHistory({ enabled }: { enabled: boolean }) {
  const { data: invoices } = useQuery({ queryKey: ['billing-invoices'], queryFn: companyApi.billingInvoices, enabled });

  const cols: Column<any>[] = [
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
    <div>
      <h2 className="mb-4 text-lg font-semibold">Payment history</h2>
      <DataTable columns={cols} rows={invoices ?? []} emptyText="No payments yet" rowKey={(r) => r._id} />
    </div>
  );
}
