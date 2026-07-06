'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth.store';
import { adminApi } from '@/lib/admin.api';
import { dateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, statusTone } from '@/components/ui/Badge';

export default function ActivityLogsPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'super_admin';
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs', page], queryFn: () => adminApi.auditLogs({ page, limit: 15 }), enabled: isAdmin });

  const columns: Column<any>[] = [
    { key: 'action', header: 'Action', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: 'actor', header: 'Actor', render: (r) => r.actor?.email ?? 'system' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'ip', header: 'IP', render: (r) => r.ip ?? '—' },
    { key: 'createdAt', header: 'When', render: (r) => dateTime(r.createdAt) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Activity Logs" description="Security and account activity trail." />
      {!isAdmin && (
        <GlassCard><p className="text-sm text-muted-foreground">Your account activity is tracked for security. Contact your administrator for the full audit trail.</p></GlassCard>
      )}
      {isAdmin && (
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          emptyText="No activity yet"
          rowKey={(r) => r._id}
          page={data?.meta.page}
          pages={data?.meta.pages}
          total={data?.meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
