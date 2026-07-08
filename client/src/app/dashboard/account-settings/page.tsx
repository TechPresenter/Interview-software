'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { companyApi } from '@/lib/company.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toast';

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

      {user?.role === 'company_admin' && <DangerZone />}
    </div>
  );
}

/** Company-only workspace deletion (owner only, name-confirmed, staff handled). */
function DangerZone() {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [staffAction, setStaffAction] = useState<'delete' | 'deactivate'>('deactivate');

  const del = useMutation({
    mutationFn: () => companyApi.deleteAccount({ confirm: confirm.trim(), staffAction }),
    onSuccess: async () => {
      toast.success('Your workspace and all associated data have been deleted.');
      setOpen(false);
      await logout();
      router.replace('/');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Deletion failed'),
  });

  return (
    <>
      <GlassCard className="border-destructive/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Permanently delete this company workspace — jobs, candidates, interviews, reports, billing, and staff
          accounts. This cannot be undone. Only the workspace owner can do this.
        </p>
        <Button className="mt-4" variant="ghost" magnetic={false} onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete company account
        </Button>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete company account"
        description="This permanently deletes the workspace and all of its data."
        footer={
          <>
            <Button variant="ghost" magnetic={false} onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="glass"
              magnetic={false}
              loading={del.isPending}
              disabled={!confirm.trim()}
              onClick={() => del.mutate()}
              className="!bg-destructive/15 !text-destructive hover:!bg-destructive/25"
            >
              <Trash2 className="h-4 w-4" /> Permanently delete
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            This action is irreversible. All jobs, candidates, interviews, reports, and billing history will be erased.
          </div>
          <Field
            label="Type your exact company / workspace name to confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder="e.g. Acme Talent"
            autoComplete="off"
          />
          <Select
            label="Staff accounts"
            value={staffAction}
            onChange={(v) => setStaffAction(v as 'delete' | 'deactivate')}
            options={[
              { label: 'Deactivate (keep records, block sign-in)', value: 'deactivate' },
              { label: 'Delete permanently', value: 'delete' },
            ]}
          />
        </div>
      </Modal>
    </>
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
