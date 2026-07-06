import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, FileText, TrendingUp, Download, Users, Target, PieChart, Trophy } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, SectionHeading, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'Reports & Analytics',
  description:
    'Turn every interview into an objective, exportable report. Competency scores, candidate ranking, funnel analytics, and PDF/Excel exports for stakeholders.',
  path: '/reports',
  keywords: ['interview reports', 'hiring analytics', 'candidate ranking', 'recruitment dashboard', 'talent analytics'],
});

const features: Feature[] = [
  { icon: FileText, title: 'Evidence-based scorecards', desc: 'Every competency score is backed by quoted evidence from the transcript — fully auditable.' },
  { icon: Trophy, title: 'Automatic ranking', desc: 'Candidates are ranked by fit so your shortlist builds itself as interviews complete.' },
  { icon: Target, title: 'Hire recommendations', desc: 'A clear Strong Hire → No Hire recommendation with the reasoning that drove it.' },
  { icon: PieChart, title: 'Funnel analytics', desc: 'See conversion at every stage — invited, completed, shortlisted, hired — in one dashboard.' },
  { icon: TrendingUp, title: 'Trends over time', desc: 'Track quality-of-hire, time-to-screen, and pipeline velocity across jobs and teams.' },
  { icon: Download, title: 'PDF & Excel export', desc: 'One-click exports for hiring managers, stakeholders, and compliance records.' },
];

export default function ReportsPage() {
  return (
    <MarketingPage
      eyebrow="Analytics"
      title={<>Reports that turn interviews into <span className="text-gradient">decisions</span></>}
      lead="Objective scorecards, automatic ranking, and funnel analytics — so you always know who to advance and why."
      breadcrumb={[{ label: 'Reports & Analytics' }]}
      actions={<Link href="/register"><Button size="lg">Generate your first report</Button></Link>}
    >
      <section className="mb-20 grid items-center gap-8 lg:grid-cols-2">
        <GlassCard className="order-2 p-6 lg:order-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /> Candidate report</span>
            <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-emerald-400">Overall 87</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[['Technical', 88], ['Communication', 82], ['Problem solving', 91], ['Ownership', 84]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 text-2xl font-bold text-gradient">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-28 items-end gap-1.5 rounded-xl border border-border bg-muted/20 p-3">
            {[45, 62, 70, 58, 80, 72, 90, 66, 84].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-[linear-gradient(180deg,hsl(var(--primary)),hsl(var(--accent)/0.4))]" style={{ height: `${h}%` }} />
            ))}
          </div>
        </GlassCard>
        <div className="order-1 lg:order-2">
          <SectionHeading
            center={false}
            eyebrow="One source of truth"
            title="Every stakeholder, the same evidence"
            lead="Reports are generated the instant an interview ends — no manual write-ups, no recency bias, no lost notes. Share a link or export a polished PDF in a click."
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/ai-interviews"><Button variant="glass" magnetic={false}>How scoring works</Button></Link>
            <Link href="/security"><Button variant="ghost" magnetic={false}><Users className="h-4 w-4" /> Access controls</Button></Link>
          </div>
        </div>
      </section>

      <FeatureGrid items={features} />

      <CTASection
        title={<>See your pipeline <span className="text-gradient">clearly</span></>}
        subtitle="Start free and generate your first evidence-based report today."
      />
    </MarketingPage>
  );
}
