import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, BarChart3, ShieldCheck, FileSearch, Video, Sparkles, Workflow, Globe, Users } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, StatStrip, SectionHeading, type Feature } from '@/components/public/blocks';
import { ComparisonTable, type ComparisonRow } from '@/components/public/ComparisonTable';
import { CTASection } from '@/components/public/CTASection';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'Features',
  description:
    'Explore the AIPL Hire platform: adaptive AI interviewer, competency scoring, resume intelligence, proctoring & anti-cheat, a live interview room, and instant hire-ready reports.',
  path: '/features',
  keywords: ['AI interview features', 'competency scoring', 'resume screening', 'proctoring', 'candidate ranking'],
});

const features: Feature[] = [
  { icon: Bot, title: 'Adaptive AI Interviewer', desc: 'Claude-powered interviews that ask, follow up, and adapt difficulty in real time to each candidate.' },
  { icon: BarChart3, title: 'Competency Scoring', desc: 'Objective scores across seven competencies with transparent, evidence-based reasoning behind every number.' },
  { icon: FileSearch, title: 'Resume Intelligence', desc: 'ATS score, skill extraction, gap analysis, and job-match percentage generated in seconds.' },
  { icon: ShieldCheck, title: 'Proctoring & Anti-Cheat', desc: 'Tab, blur, copy/paste, and face-presence signals combine into a live integrity score.' },
  { icon: Video, title: 'Live Interview Room', desc: 'AI avatar, voice & text questions, HD recording, live transcript, and autosave — bilingual EN/हिं.' },
  { icon: Sparkles, title: 'Instant Reports', desc: 'Strengths, gaps, and a hire recommendation the moment the interview ends — export to PDF or Excel.' },
  { icon: Workflow, title: 'Pipeline & Stages', desc: 'Drag candidates through customizable stages and keep every stakeholder aligned automatically.' },
  { icon: Globe, title: 'Multilingual', desc: 'Run interviews in English or Hindi with region-aware voices and localized scoring rubrics.' },
  { icon: Users, title: 'Team Collaboration', desc: 'Role-based access for recruiters, HR, and hiring managers with shared notes and rankings.' },
];

const stats = [
  { value: '92%', label: 'Faster screening' },
  { value: '4×', label: 'More candidates reached' },
  { value: '120k+', label: 'Interviews run' },
  { value: '98%', label: 'Recruiter satisfaction' },
];

const compareCols = ['AIPL Hire', 'LinkedIn Talent', 'Ashby', 'Greenhouse', 'Lever', 'Workable'];
const compareRows: ComparisonRow[] = [
  { label: 'Adaptive AI interviewer', values: [true, false, false, false, false, false] },
  { label: 'AI voice interviewer', values: [true, false, false, false, false, false] },
  { label: 'Objective AI scoring', values: [true, false, 'Limited', false, false, false] },
  { label: 'Anti-cheat proctoring', values: [true, false, false, false, false, false] },
  { label: 'Resume intelligence', values: [true, 'Limited', true, true, 'Limited', true] },
  { label: 'Automatic candidate ranking', values: [true, 'Limited', true, 'Limited', 'Limited', 'Limited'] },
  { label: 'Multilingual (EN / हिं)', values: [true, false, false, false, false, false] },
  { label: 'Instant hire reports', values: [true, false, 'Limited', 'Limited', false, false] },
  { label: 'White-label branding', values: [true, false, false, false, false, 'Add-on'] },
  { label: 'Transparent public pricing', values: [true, false, false, false, false, true] },
];

export default function FeaturesPage() {
  return (
    <MarketingPage
      eyebrow="Platform"
      title={<>Everything you need to <span className="text-gradient">hire with AI</span></>}
      lead="From first resume to final offer — one premium platform for recruiters, HR teams, and candidates."
      breadcrumb={[{ label: 'Features' }]}
      actions={
        <>
          <Link href="/register"><Button size="lg">Start hiring free</Button></Link>
          <Link href="/ai-interviews"><Button size="lg" variant="glass" magnetic={false}>See AI interviews</Button></Link>
        </>
      }
    >
      <FeatureGrid items={features} />

      <section className="mt-20">
        <SectionHeading eyebrow="Proven results" title="Outcomes teams can measure" />
        <StatStrip stats={stats} />
      </section>

      <section className="mt-20">
        <SectionHeading
          eyebrow="How we compare"
          title="Built for AI hiring — not bolted on"
          lead="Legacy ATS platforms added AI as an afterthought. AIPL Hire is AI-native from screening to scoring."
        />
        <ComparisonTable columns={compareCols} rows={compareRows} highlightCol={0} firstColLabel="Capability" />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Comparison based on publicly documented capabilities as of 2026. Trademarks belong to their respective owners.
        </p>
      </section>

      <CTASection
        title={<>Ready to hire <span className="text-gradient">10× faster</span>?</>}
        subtitle="Spin up your first AI interview in minutes — no credit card required."
      />
    </MarketingPage>
  );
}
