'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/store/auth.store';
import { companyApi } from '@/lib/company.api';
import { titleCase, date } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
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
    </div>
  );
}
