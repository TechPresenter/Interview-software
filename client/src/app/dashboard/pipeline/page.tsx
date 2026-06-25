'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { companyApi } from '@/lib/company.api';
import { titleCase } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';

const STAGE_TONE: Record<string, string> = {
  applied: 'border-t-sky-500',
  screening: 'border-t-yellow-500',
  interview: 'border-t-primary',
  shortlisted: 'border-t-accent',
  hired: 'border-t-green-500',
  rejected: 'border-t-destructive',
};

export default function PipelinePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['pipeline'], queryFn: () => companyApi.pipeline() });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => companyApi.moveStage(id, stage),
    onSuccess: () => {
      toast.success('Candidate moved');
      qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: () => toast.error('Move failed'),
  });

  const columns = data?.columns ?? [];

  return (
    <div>
      <PageHeader title="Pipeline" description="Drag candidates through your hiring stages." />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col: any) => (
            <div key={col.stage} className="min-w-[260px] flex-1">
              <div className={`glass rounded-2xl border-t-4 ${STAGE_TONE[col.stage] || 'border-t-border'} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold capitalize">{col.stage}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {col.candidates.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {col.candidates.map((c: any) => (
                    <motion.div
                      key={c._id}
                      layout
                      className="rounded-xl border border-border bg-card/60 p-3"
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                      {c.resumeAnalysis?.jobMatch != null && (
                        <p className="mt-1 text-xs text-accent">Match {c.resumeAnalysis.jobMatch}%</p>
                      )}
                      <select
                        value={col.stage}
                        onChange={(e) => move.mutate({ id: c._id, stage: e.target.value })}
                        className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2 py-1 text-xs outline-none"
                      >
                        {columns.map((s: any) => (
                          <option key={s.stage} value={s.stage} className="bg-card">
                            {titleCase(s.stage)}
                          </option>
                        ))}
                      </select>
                    </motion.div>
                  ))}
                  {col.candidates.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">Empty</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
