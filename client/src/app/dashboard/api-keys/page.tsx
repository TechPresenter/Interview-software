'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { adminApi } from '@/lib/admin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function ApiKeysPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'super_admin';
  const { data } = useQuery({ queryKey: ['ai-providers'], queryFn: adminApi.aiProviders, enabled: isAdmin });
  const providers = data?.providers ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="API Keys" description="AI provider keys and integrations." />
      {!isAdmin && (
        <GlassCard><p className="text-sm text-muted-foreground">API access and keys are managed by your platform administrator.</p></GlassCard>
      )}
      {isAdmin && (
        <GlassCard>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI provider keys</h2>
            <Link href="/dashboard/ai" className="ml-auto"><Button size="sm" magnetic={false}>Manage in AI Management</Button></Link>
          </div>
          {providers.length === 0 && <p className="text-sm text-muted-foreground">No providers configured. The built-in key from your server environment is used by default.</p>}
          <div className="space-y-2">
            {providers.map((p: any) => (
              <div key={p._id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                <span className="font-medium">{p.label} <span className="ml-1 text-xs uppercase text-muted-foreground">{p.type}</span></span>
                <div className="flex gap-2">
                  <Badge tone={p.hasKey ? 'success' : 'warning'}>{p.hasKey ? 'key set' : 'no key'}</Badge>
                  {p.isDefault && <Badge tone="default">default</Badge>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
