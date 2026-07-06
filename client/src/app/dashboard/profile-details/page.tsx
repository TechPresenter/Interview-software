'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth.store';
import { accountApi } from '@/lib/account.api';
import { date } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';

export default function ProfileDetailsPage() {
  const user = useAuth((s) => s.user);
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: accountApi.me });
  const u = me?.user || user;
  const initial = u?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="space-y-8">
      <PageHeader title="Profile Details" description="Your identity on the platform." />
      <GlassCard>
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-2xl font-bold text-white">{initial}</span>
          <div>
            <h2 className="text-xl font-bold">{u?.name}</h2>
            <p className="text-sm text-muted-foreground">{u?.email}</p>
            <Badge tone="default" className="mt-1 capitalize">{u?.role?.replace('_', ' ')}</Badge>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Info label="Full name" value={u?.name} />
          <Info label="Email" value={u?.email} />
          <Info label="Role" value={u?.role?.replace('_', ' ')} />
          <Info label="Email verified" value={u?.isEmailVerified ? 'Yes' : 'No'} />
          <Info label="Member since" value={u?.createdAt ? date(u.createdAt) : '—'} />
          <Info label="Two-factor" value={me?.user?.twoFactor?.enabled ? 'Enabled' : 'Disabled'} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">To update your name or email, contact your administrator.</p>
      </GlassCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium capitalize">{value || '—'}</p>
    </div>
  );
}
