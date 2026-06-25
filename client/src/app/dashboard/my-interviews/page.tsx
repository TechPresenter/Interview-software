'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, PlayCircle, CheckCircle2 } from 'lucide-react';
import { candidateApi } from '@/lib/candidate.api';
import { dateTime, titleCase } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function MyInterviewsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['my-interviews'], queryFn: candidateApi.interviews });

  return (
    <div className="space-y-8">
      <PageHeader title="My Interviews" description="Your upcoming and completed interviews." />

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CalendarCheck className="h-5 w-5 text-primary" /> Upcoming
        </h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
        ) : (data?.upcoming ?? []).length === 0 ? (
          <GlassCard><p className="text-sm text-muted-foreground">No upcoming interviews.</p></GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.upcoming.map((i: any) => (
              <GlassCard key={i.id} interactive>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{i.job}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{(i.types || []).map(titleCase).join(', ')}</p>
                  </div>
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {i.scheduledAt ? `Scheduled ${dateTime(i.scheduledAt)}` : 'Available now'}
                </p>
                {i.link && (
                  <a href={i.link} target="_blank" rel="noreferrer" className="mt-4 inline-block">
                    <Button size="sm" magnetic={false}>
                      <PlayCircle className="h-4 w-4" /> {i.status === 'in_progress' ? 'Resume' : 'Start interview'}
                    </Button>
                  </a>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="h-5 w-5 text-accent" /> Completed
        </h2>
        {(data?.completed ?? []).length === 0 ? (
          <GlassCard><p className="text-sm text-muted-foreground">No completed interviews yet.</p></GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.completed.map((i: any) => (
              <GlassCard key={i.id}>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{i.job}</h3>
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Completed {dateTime(i.completedAt)}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
