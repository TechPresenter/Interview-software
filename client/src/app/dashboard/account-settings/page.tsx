'use client';

import Link from 'next/link';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';

export default function AccountSettingsPage() {
  const user = useAuth((s) => s.user);
  return (
    <div className="space-y-8">
      <PageHeader title="Account Settings" description="Your personal preferences." />

      <GlassCard>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
          <ThemeToggle />
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Name" value={user?.name} />
          <Row label="Email" value={user?.email} />
          <Row label="Role" value={user?.role?.replace('_', ' ')} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard/profile-details"><Button size="sm" variant="glass" magnetic={false}>Profile Details</Button></Link>
          <Link href="/dashboard/security"><Button size="sm" variant="glass" magnetic={false}>Security Center</Button></Link>
          <Link href="/dashboard/notifications"><Button size="sm" variant="ghost" magnetic={false}>Notifications</Button></Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">To change your name or email, contact your administrator.</p>
      </GlassCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value || '—'}</span>
    </div>
  );
}
