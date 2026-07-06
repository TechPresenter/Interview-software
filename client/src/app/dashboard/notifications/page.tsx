'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { accountApi } from '@/lib/account.api';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: accountApi.notifications });
  const items = data?.items ?? [];
  const markAll = useMutation({ mutationFn: () => accountApi.markAllRead(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const markOne = useMutation({ mutationFn: (id: string) => accountApi.markRead(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Your alerts and updates."
        action={data?.unread ? <Button size="sm" variant="glass" magnetic={false} loading={markAll.isPending} onClick={() => markAll.mutate()}><CheckCheck className="h-4 w-4" /> Mark all read</Button> : undefined}
      />
      <GlassCard>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 h-6 w-6" /> No notifications yet.</div>
        )}
        <div className="space-y-2">
          {items.map((n: any) => (
            <button
              key={n._id}
              onClick={() => !n.isRead && markOne.mutate(n._id)}
              className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', n.isRead ? 'border-border' : 'border-primary/40 bg-primary/5 hover:bg-primary/10')}
            >
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-muted' : 'bg-primary')} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
