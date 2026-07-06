import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquare, Mic, Gauge, ShieldCheck, Languages, Clock, Bot, ListChecks } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, Steps, SectionHeading, CheckList, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'AI Interviews',
  description:
    'Adaptive, proctored AI interviews that adjust in real time. Voice or text, English or Hindi, with objective competency scoring and an instant hire recommendation.',
  path: '/ai-interviews',
  keywords: ['AI interviews', 'automated interview', 'adaptive interview', 'video interview software', 'AI interviewer'],
});

const capabilities: Feature[] = [
  { icon: Bot, title: 'Adaptive questioning', desc: 'The interviewer follows up on real answers and raises or lowers difficulty based on performance.' },
  { icon: Mic, title: 'Voice or text', desc: 'Candidates speak or type. Live speech-to-text and natural TTS make it feel like a real conversation.' },
  { icon: Languages, title: 'Bilingual', desc: 'Switch between English and Hindi mid-interview with localized voices and rubrics.' },
  { icon: ShieldCheck, title: 'Proctored', desc: 'Tab, blur, paste, and face-presence signals produce a transparent integrity score.' },
  { icon: Gauge, title: 'Objective scoring', desc: 'Seven competencies scored with evidence — no gut feel, no unconscious bias.' },
  { icon: Clock, title: 'Anytime, anywhere', desc: 'A private link lets candidates interview 24/7 across timezones — no scheduling ping-pong.' },
];

const steps = [
  { title: 'Create a job', desc: 'Define the role and let AI build a tailored interview blueprint.' },
  { title: 'Invite candidates', desc: 'Share a private link — candidates join a proctored AI interview instantly.' },
  { title: 'AI interviews & scores', desc: 'Adaptive questions, live transcript, and competency scoring in real time.' },
  { title: 'Get a recommendation', desc: 'An instant, evidence-backed report with a clear hire recommendation.' },
];

export default function AiInterviewsPage() {
  return (
    <MarketingPage
      eyebrow="Product"
      title={<>AI interviews that feel <span className="text-gradient">human</span>, scored like a machine</>}
      lead="Give every candidate a fair, consistent interview — adaptive, proctored, and explainable from the first question to the final report."
      breadcrumb={[{ label: 'AI Interviews' }]}
      actions={
        <>
          <Link href="/register"><Button size="lg">Run a free interview</Button></Link>
          <Link href="/reports"><Button size="lg" variant="glass" magnetic={false}>See the reports</Button></Link>
        </>
      }
    >
      <FeatureGrid items={capabilities} />

      <section className="mt-20">
        <SectionHeading eyebrow="How it works" title="From job post to hire in four steps" />
        <Steps steps={steps} />
      </section>

      <section className="mt-20 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading center={false} eyebrow="Fair by design" title="Structured, bias-aware interviews" lead="Every candidate answers a consistent, role-relevant interview, scored against the same rubric." />
          <CheckList
            items={[
              'Identical competency rubric applied to every candidate',
              'Evidence quotes attached to each score for auditability',
              'Adaptive follow-ups probe depth without leading questions',
              'Integrity signals flag anomalies without penalizing nerves',
            ]}
          />
        </div>
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ListChecks className="h-4 w-4 text-accent" /> Live competency read-out
          </div>
          <div className="mt-5 space-y-4">
            {[['Technical depth', 88], ['Communication', 82], ['Problem solving', 91], ['Culture add', 76]].map(([label, v]) => (
              <div key={label as string}>
                <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{v}/100</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-emerald-400/10 px-4 py-3 text-sm">
            <MessageSquare className="h-4 w-4 text-emerald-400" /> Recommendation: <strong className="text-emerald-400">Strong Hire</strong>
          </div>
        </GlassCard>
      </section>

      <CTASection
        title={<>Interview smarter, <span className="text-gradient">not harder</span></>}
        subtitle="Launch your first adaptive AI interview today."
        secondary={{ label: 'Compare plans', href: '/pricing' }}
      />
    </MarketingPage>
  );
}
