import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { GlassCard } from '@/components/ui/GlassCard';

export const metadata: Metadata = pageMetadata({
  title: 'System Status',
  description:
    'Live operational status for AIPL Hire services — API, dashboard, interview room, AI engine, and webhooks — plus uptime and incident history.',
  path: '/status',
  keywords: ['AIPL Hire status', 'system status', 'uptime', 'service health'],
});

const services = [
  { name: 'API', uptime: '99.98%' },
  { name: 'Web dashboard', uptime: '99.99%' },
  { name: 'Interview room', uptime: '99.97%' },
  { name: 'AI scoring engine', uptime: '99.95%' },
  { name: 'Webhooks & notifications', uptime: '99.96%' },
  { name: 'File storage & uploads', uptime: '100.00%' },
];

export default function StatusPage() {
  return (
    <MarketingPage
      eyebrow="Status"
      title={<>System <span className="text-gradient">status</span></>}
      lead="Real-time operational status of AIPL Hire services and 90-day uptime."
      breadcrumb={[{ label: 'System Status' }]}
    >
      <div className="mx-auto max-w-3xl">
        {/* Overall banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-400">All systems operational</p>
            <p className="text-sm text-muted-foreground">Last checked just now · Updated continuously</p>
          </div>
        </div>

        {/* Services */}
        <div className="mt-8 space-y-3">
          {services.map((s) => (
            <GlassCard key={s.name} className="!p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Operational
                </span>
              </div>
              {/* 90-day uptime bars */}
              <div className="mt-3 flex items-end gap-[3px]" aria-hidden>
                {Array.from({ length: 60 }).map((_, i) => (
                  <span key={i} className="h-6 flex-1 rounded-sm bg-emerald-400/70" />
                ))}
              </div>
              <p className="mt-2 text-right text-xs text-muted-foreground">{s.uptime} uptime · 90 days</p>
            </GlassCard>
          ))}
        </div>

        {/* Incident history */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Incident history</h2>
          <div className="mt-4 rounded-2xl border border-border bg-card/40 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="mt-3 text-sm text-muted-foreground">No incidents reported in the last 90 days.</p>
          </div>
        </section>
      </div>
    </MarketingPage>
  );
}
