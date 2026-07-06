import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale, Eye, Zap, HeartHandshake, Users, Sparkles, Telescope } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, StatStrip, SectionHeading, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description:
    'HireSense is on a mission to make hiring faster and fairer with explainable AI. Learn about our story, mission, vision, leadership, values, and milestones.',
  path: '/about',
  keywords: ['about HireSense', 'AI hiring company', 'fair hiring', 'leadership', 'company mission'],
});

const values: Feature[] = [
  { icon: Scale, title: 'Fairness first', desc: 'Every candidate deserves a consistent, bias-aware evaluation. Fairness is a feature, not an afterthought.' },
  { icon: Eye, title: 'Explainable by default', desc: 'No black boxes. Every score comes with the evidence and reasoning behind it.' },
  { icon: Zap, title: 'Speed with rigor', desc: 'We remove busywork so teams move faster — without cutting corners on quality.' },
  { icon: HeartHandshake, title: 'Candidate respect', desc: 'A great hiring experience is a great candidate experience. We build for both sides.' },
];

const stats = [
  { value: '120k+', label: 'Interviews run' },
  { value: '30+', label: 'Countries' },
  { value: '7', label: 'Competencies scored' },
  { value: '98%', label: 'Recruiter satisfaction' },
];

const timeline = [
  { year: '2023', title: 'Founded', desc: 'HireSense starts with a simple belief: hiring should be fair, fast, and explainable.' },
  { year: '2024', title: 'First AI interviews', desc: 'We launch the adaptive AI interviewer and evidence-based competency scoring.' },
  { year: '2025', title: 'Scaling globally', desc: 'Proctoring, multilingual interviews, and enterprise controls ship to teams in 30+ countries.' },
  { year: '2026', title: 'AI-native platform', desc: 'Custom AI interviewers, white-label branding, and deeper analytics make HireSense a full hiring OS.' },
];

const leaders = [
  { name: 'A. Sharma', title: 'Co-founder & CEO', bio: 'Former talent leader obsessed with fair, structured hiring at scale.' },
  { name: 'R. Iyer', title: 'Co-founder & CTO', bio: 'Builds reliable AI systems; ex-platform engineer for high-scale products.' },
  { name: 'M. Verma', title: 'VP, Product', bio: 'Turns complex AI into simple, delightful hiring workflows.' },
  { name: 'S. Nair', title: 'Head of AI', bio: 'Leads scoring, fairness, and evaluation research for the interviewer.' },
];

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="Company"
      title={<>Making hiring <span className="text-gradient">faster and fairer</span></>}
      lead="We started HireSense because hiring is too important to be slow, inconsistent, or biased. Our AI gives every candidate a fair shot and every team the evidence to decide with confidence."
      breadcrumb={[{ label: 'About Us' }]}
      actions={
        <>
          <Link href="/careers"><Button size="lg">Join the team</Button></Link>
          <Link href="/contact"><Button size="lg" variant="glass" magnetic={false}>Talk to us</Button></Link>
        </>
      }
    >
      {/* Mission / Vision / Story */}
      <section className="mb-20 grid gap-6 lg:grid-cols-3">
        <GlassCard>
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Mission</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Give every organization access to structured, explainable interviews at scale — so the best person for the
            role is found on merit, not on who had time to screen them.
          </p>
        </GlassCard>
        <GlassCard>
          <Telescope className="h-6 w-6 text-accent" />
          <h2 className="mt-4 text-xl font-bold">Vision</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            A world where hiring is fair by default — where AI widens opportunity instead of narrowing it, and every
            decision can be explained and trusted.
          </p>
        </GlassCard>
        <GlassCard>
          <Users className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Our story</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Built by engineers and talent leaders tired of resumes lost in inboxes and interviews that varied from one
            panelist to the next, we pair a state-of-the-art AI interviewer with rigorous, evidence-based scoring.
          </p>
        </GlassCard>
      </section>

      {/* Values */}
      <section className="mb-20">
        <SectionHeading eyebrow="What we value" title="Principles that guide every decision" />
        <FeatureGrid items={values} columns={4} />
      </section>

      {/* Timeline */}
      <section className="mb-20">
        <SectionHeading eyebrow="Our journey" title="Milestones so far" />
        <ol className="relative mx-auto max-w-3xl border-l border-border">
          {timeline.map((t) => (
            <li key={t.year} className="mb-10 ml-6 last:mb-0">
              <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-background bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))]" />
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">{t.year}</span>
                <h3 className="text-lg font-semibold">{t.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Leadership */}
      <section className="mb-4">
        <SectionHeading eyebrow="Leadership" title="The people behind HireSense" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {leaders.map((l) => (
            <GlassCard key={l.name} interactive className="text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-lg font-bold text-white glow">
                {l.name.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2)}
              </span>
              <h3 className="mt-4 font-semibold">{l.name}</h3>
              <p className="text-sm text-primary">{l.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{l.bio}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <SectionHeading eyebrow="By the numbers" title="Trusted by modern hiring teams" />
        <StatStrip stats={stats} />
      </section>

      <CTASection
        title={<>Build the future of hiring <span className="text-gradient">with us</span></>}
        subtitle="Whether you want to hire with HireSense or work here, we'd love to talk."
        primary={{ label: 'See open roles', href: '/careers' }}
        secondary={{ label: 'Contact us', href: '/contact' }}
      />
    </MarketingPage>
  );
}
