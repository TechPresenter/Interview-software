'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, Bell, KeyRound, ScrollText, LogOut } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

/** Role-agnostic account hub: details, security (2FA), sessions, and quick links. */
export default function AccountPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { data: me, refetch } = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get('/auth/me')).data.data });
  const twoFa = me?.user?.twoFactor?.enabled;
  const [setup, setSetup] = useState<any>(null);
  const [code, setCode] = useState('');

  const startSetup = useMutation({
    mutationFn: async () => (await api.post('/auth/2fa/setup')).data.data,
    onSuccess: (d) => setSetup(d),
    onError: () => toast.error('Could not start 2FA setup'),
  });
  const enable = useMutation({
    mutationFn: async () => (await api.post('/auth/2fa/enable', { token: code })).data,
    onSuccess: () => { toast.success('Two-factor authentication enabled'); setSetup(null); setCode(''); refetch(); },
    onError: () => toast.error('Invalid code — try again'),
  });
  const disable = useMutation({
    mutationFn: async () => (await api.post('/auth/2fa/disable')).data,
    onSuccess: () => { toast.success('Two-factor authentication disabled'); refetch(); },
    onError: () => toast.error('Failed to disable 2FA'),
  });
  const logoutAll = useMutation({
    mutationFn: async () => (await api.post('/auth/logout-all')).data,
    onSuccess: async () => { toast.success('Signed out of all devices'); await logout(); },
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Account" description="Your profile, security, and account settings." />

      <GlassCard>
        <h2 className="mb-4 text-lg font-semibold">Account details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Info label="Name" value={user?.name} />
          <Info label="Email" value={user?.email} />
          <Info label="Role" value={user?.role?.replace('_', ' ')} />
          <Info label="Email verified" value={user?.isEmailVerified ? 'Yes' : 'No'} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">To change your account details, contact your administrator.</p>
      </GlassCard>

      <GlassCard id="security">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Security center</h2>
          {twoFa != null && <Badge tone={twoFa ? 'success' : 'muted'} className="ml-auto">{twoFa ? '2FA on' : '2FA off'}</Badge>}
        </div>

        {!twoFa && !setup && (
          <Button magnetic={false} loading={startSetup.isPending} onClick={() => startSetup.mutate()}>Enable two-factor auth</Button>
        )}
        {setup && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Scan this QR in your authenticator app, then enter the 6-digit code to confirm.</p>
            {setup.qr && <img src={setup.qr} alt="2FA QR code" className="h-40 w-40 rounded-xl bg-white p-2" />}
            <p className="break-all text-xs text-muted-foreground">Secret: <code>{setup.secret}</code></p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="h-10 w-32 rounded-xl border border-input bg-card/60 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
              <Button magnetic={false} loading={enable.isPending} onClick={() => enable.mutate()}>Confirm</Button>
              <Button variant="ghost" magnetic={false} onClick={() => setSetup(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {twoFa && <Button variant="glass" magnetic={false} loading={disable.isPending} onClick={() => disable.mutate()}>Disable two-factor auth</Button>}

        <div className="mt-5 border-t border-border pt-4">
          <Button variant="ghost" magnetic={false} loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
            <LogOut className="h-4 w-4" /> Sign out of all devices
          </Button>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard id="notifications">
          <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><h2 className="font-semibold">Notifications</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">Real-time alerts appear in-app. Email notifications follow your configured templates.</p>
        </GlassCard>
        <GlassCard id="api">
          <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><h2 className="font-semibold">API keys</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.role === 'super_admin' ? <>Manage AI provider keys in <Link href="/dashboard/ai" className="text-primary">AI Management</Link>.</> : 'API access is managed by your administrator.'}
          </p>
        </GlassCard>
        <GlassCard id="activity">
          <div className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-primary" /><h2 className="font-semibold">Activity logs</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.role === 'super_admin' ? <>View the full audit trail in <Link href="/dashboard/system" className="text-primary">System</Link>.</> : 'Your recent account activity is tracked for security.'}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium capitalize">{value || '—'}</p>
    </div>
  );
}
