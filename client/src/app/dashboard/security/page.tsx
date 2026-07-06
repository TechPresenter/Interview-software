'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, LogOut } from 'lucide-react';
import { accountApi } from '@/lib/account.api';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';

export default function SecurityPage() {
  const logout = useAuth((s) => s.logout);
  const { data: me, refetch } = useQuery({ queryKey: ['me'], queryFn: accountApi.me });
  const twoFa = me?.user?.twoFactor?.enabled;
  const [setup, setSetup] = useState<any>(null);
  const [code, setCode] = useState('');

  const startSetup = useMutation({ mutationFn: () => accountApi.twoFactorSetup(), onSuccess: (d: any) => setSetup(d), onError: () => toast.error('Could not start 2FA setup') });
  const enable = useMutation({ mutationFn: () => accountApi.twoFactorEnable(code), onSuccess: () => { toast.success('Two-factor enabled'); setSetup(null); setCode(''); refetch(); }, onError: () => toast.error('Invalid code — try again') });
  const disable = useMutation({ mutationFn: () => accountApi.twoFactorDisable(), onSuccess: () => { toast.success('Two-factor disabled'); refetch(); }, onError: () => toast.error('Failed to disable') });
  const logoutAll = useMutation({ mutationFn: () => accountApi.logoutAll(), onSuccess: async () => { toast.success('Signed out of all devices'); await logout(); } });

  return (
    <div className="space-y-8">
      <PageHeader title="Security Center" description="Two-factor authentication and active sessions." />

      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Two-factor authentication</h2>
          {twoFa != null && <Badge tone={twoFa ? 'success' : 'muted'} className="ml-auto">{twoFa ? 'On' : 'Off'}</Badge>}
        </div>
        {!twoFa && !setup && <Button magnetic={false} loading={startSetup.isPending} onClick={() => startSetup.mutate()}>Enable 2FA</Button>}
        {setup && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Scan the QR in your authenticator app, then enter the 6-digit code.</p>
            {setup.qr && <img src={setup.qr} alt="2FA QR code" className="h-40 w-40 rounded-xl bg-white p-2" />}
            <p className="break-all text-xs text-muted-foreground">Secret: <code>{setup.secret}</code></p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="h-10 w-32 rounded-xl border border-input bg-card/60 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
              <Button magnetic={false} loading={enable.isPending} onClick={() => enable.mutate()}>Confirm</Button>
              <Button variant="ghost" magnetic={false} onClick={() => setSetup(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {twoFa && <Button variant="glass" magnetic={false} loading={disable.isPending} onClick={() => disable.mutate()}>Disable 2FA</Button>}
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold">Active sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign out everywhere you're currently logged in.</p>
        <Button className="mt-4" variant="ghost" magnetic={false} loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
          <LogOut className="h-4 w-4" /> Sign out of all devices
        </Button>
      </GlassCard>
    </div>
  );
}
