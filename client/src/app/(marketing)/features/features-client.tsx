'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Bot, Sparkles, ListOrdered, BarChart3, MessageSquarePlus, GitBranch, Workflow, ListChecks, StickyNote, UserPlus,
  MessagesSquare, Mic, Languages, CalendarClock, SlidersHorizontal, Timer, Video, Captions, Save, Webcam,
  FileText, FileSearch, Gauge, Database, Upload, Tags, Briefcase, Globe, ClipboardList, Users, UserRound,
  CircleUserRound, Mail, LayoutDashboard, Activity, ShieldCheck, Building2, HeartPulse, ScrollText, UserCog,
  KeyRound, ClipboardCheck, FileStack, Server, LayoutTemplate, MousePointerClick, Bell, BellRing, FileBarChart,
  Filter, Radio, Download, Lock, ShieldAlert, BadgeCheck, DatabaseBackup, Cable, Webhook, Code2, CreditCard,
  Ticket, ReceiptText, Layers, Newspaper, MessageSquare, Megaphone, RefreshCw, Smartphone, Hand, MonitorSmartphone,
  Search, Rocket, PhoneCall, PlayCircle,
} from 'lucide-react';
import { MarketingPage } from '@/components/public/MarketingPage';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Reveal } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

type BadgeKind = 'ai' | 'new' | 'popular' | 'enterprise';
type FeatureItem = { icon: LucideIcon; title: string; desc: string; badge?: BadgeKind };
type Category = { key: string; label: string; icon: LucideIcon; features: FeatureItem[] };

const BADGES: Record<BadgeKind, { label: string; cls: string }> = {
  ai: { label: 'AI Powered', cls: 'bg-primary/15 text-primary ring-primary/30' },
  new: { label: 'New', cls: 'bg-accent/15 text-accent ring-accent/30' },
  popular: { label: 'Popular', cls: 'bg-amber-500/15 text-amber-500 ring-amber-500/30' },
  enterprise: { label: 'Enterprise', cls: 'bg-sky-500/15 text-sky-500 ring-sky-500/30' },
};

const CATEGORIES: Category[] = [
  {
    key: 'ai-recruitment', label: 'AI Recruitment', icon: Bot,
    features: [
      { icon: Bot, title: 'Adaptive AI Interviewer', desc: 'Interviews that ask, follow up, and adapt difficulty to each candidate in real time.', badge: 'ai' },
      { icon: Sparkles, title: 'Smart Candidate Matching', desc: 'AI matches candidates to roles by skills, experience, and job fit — no manual sifting.', badge: 'ai' },
      { icon: ListOrdered, title: 'AI Candidate Ranking', desc: 'Automatically rank applicants by objective, evidence-based scores.', badge: 'ai' },
      { icon: BarChart3, title: 'Competency Scoring', desc: 'Score seven competencies with transparent reasoning behind every number.', badge: 'ai' },
      { icon: MessageSquarePlus, title: 'Automated Follow-ups', desc: 'The AI digs deeper with contextual follow-up questions when answers need it.', badge: 'ai' },
    ],
  },
  {
    key: 'ats', label: 'Applicant Tracking System', icon: GitBranch,
    features: [
      { icon: GitBranch, title: 'Visual Pipeline', desc: 'Drag candidates through fully customizable stages with real-time sync.', badge: 'popular' },
      { icon: Workflow, title: 'Stage Automation', desc: 'Auto-advance candidates and trigger actions as they move through hiring.' },
      { icon: ListChecks, title: 'Bulk Actions', desc: 'Move, message, or schedule dozens of candidates in a single click.' },
      { icon: StickyNote, title: 'Notes & Ratings', desc: 'Shared notes and star ratings keep every stakeholder aligned.' },
      { icon: UserPlus, title: 'Candidate Sourcing', desc: 'Applicants flow from your job portal straight into the pipeline.' },
    ],
  },
  {
    key: 'ai-interview', label: 'AI Interview Platform', icon: MessagesSquare,
    features: [
      { icon: Mic, title: 'Voice & Text Interviews', desc: 'Candidates answer by voice or text — whichever they are most comfortable with.' },
      { icon: Languages, title: 'Bilingual — English & हिंदी', desc: 'Run interviews in English or Hindi with region-aware voices and localized scoring.', badge: 'new' },
      { icon: CalendarClock, title: 'Interview Scheduling', desc: 'Invite, schedule, and auto-remind candidates in seconds.' },
      { icon: SlidersHorizontal, title: 'Configurable Settings', desc: 'Control duration, question count, difficulty, and more per interview.' },
      { icon: Timer, title: 'Timers & Auto-submit', desc: 'Per-question timers and auto-submit keep every interview fair and consistent.' },
    ],
  },
  {
    key: 'video-room', label: 'Video Interview Room', icon: Video,
    features: [
      { icon: Bot, title: 'Live AI Avatar', desc: 'A friendly AI interviewer guides candidates through every question.', badge: 'ai' },
      { icon: Video, title: '1080p HD Recording', desc: 'Every interview is recorded in full HD for later review and audit.', badge: 'new' },
      { icon: Captions, title: 'Live Transcript', desc: 'Real-time speech-to-text transcript of every answer as it happens.' },
      { icon: Save, title: 'Autosave & Resume', desc: 'Progress is saved continuously — candidates can reconnect and continue.' },
      { icon: Webcam, title: 'Device Pre-Checks', desc: 'Camera and mic checks ensure a smooth start with no surprises.' },
    ],
  },
  {
    key: 'resume', label: 'Resume Management', icon: FileText,
    features: [
      { icon: FileSearch, title: 'AI Resume Parsing', desc: 'Extract skills, experience, and education from any resume in seconds.', badge: 'ai' },
      { icon: Gauge, title: 'ATS Score & Job Match', desc: 'Instant match percentage against the role, with gap analysis.', badge: 'ai' },
      { icon: Database, title: 'Resume Database', desc: 'A searchable talent pool of every resume you have ever received.' },
      { icon: Upload, title: 'Bulk Upload', desc: 'Drop in PDF, DOC, or DOCX resumes in bulk and parse them all.' },
      { icon: Tags, title: 'Skill Extraction', desc: 'Candidates are auto-tagged by the skills detected in their resume.', badge: 'ai' },
    ],
  },
  {
    key: 'jobs', label: 'Job Management', icon: Briefcase,
    features: [
      { icon: Briefcase, title: 'Job Postings', desc: 'Create and publish roles to your branded careers portal.' },
      { icon: Globe, title: 'Job Portal', desc: 'A public careers page candidates can browse and apply to.' },
      { icon: ClipboardList, title: 'Interview Blueprints', desc: 'Define the interview once per job and reuse it for every applicant.' },
      { icon: Workflow, title: 'Job Workflow', desc: 'Draft, open, pause, and close roles with a clear status flow.' },
    ],
  },
  {
    key: 'candidates', label: 'Candidate Management', icon: Users,
    features: [
      { icon: UserRound, title: 'Rich Candidate Profiles', desc: 'Full profiles with contact details, resume, and complete interview history.' },
      { icon: CircleUserRound, title: 'Candidate Portal', desc: 'Candidates track invites, interviews, and results in one clean place.' },
      { icon: Mail, title: 'Communication History', desc: 'Every email and notification logged against each candidate.' },
      { icon: GitBranch, title: 'Stage Tracking', desc: 'See exactly where each candidate sits in your hiring process.' },
    ],
  },
  {
    key: 'company-dashboard', label: 'Company Dashboard', icon: LayoutDashboard,
    features: [
      { icon: LayoutDashboard, title: 'Overview KPIs', desc: 'Interviews, candidates, and hiring metrics at a glance.' },
      { icon: Activity, title: 'Real-time Metrics', desc: 'Live pipeline and interview activity as it happens.' },
      { icon: Gauge, title: 'Usage & Limits', desc: 'Track plan usage for interviews, jobs, and team seats.' },
    ],
  },
  {
    key: 'admin-dashboard', label: 'Admin Dashboard', icon: ShieldCheck,
    features: [
      { icon: LayoutDashboard, title: 'Platform Overview', desc: 'Companies, revenue, and AI usage across the whole platform.', badge: 'enterprise' },
      { icon: Building2, title: 'Company Management', desc: 'Manage tenants, plans, and access from one console.', badge: 'enterprise' },
      { icon: HeartPulse, title: 'System Health', desc: 'Live database, cache, and service health monitoring.', badge: 'enterprise' },
      { icon: ScrollText, title: 'Audit Logs', desc: 'Every configuration change tracked, searchable, and exportable.', badge: 'enterprise' },
    ],
  },
  {
    key: 'staff-roles', label: 'Staff & Role Management', icon: UserCog,
    features: [
      { icon: KeyRound, title: 'Role-based Access', desc: 'Five built-in roles from super-admin to candidate.' },
      { icon: ShieldCheck, title: 'Custom Roles & Permissions', desc: 'Define granular, least-privilege permissions per role.', badge: 'enterprise' },
      { icon: UserCog, title: 'Staff Management', desc: 'Invite, activate, deactivate, and edit team members with ease.' },
    ],
  },
  {
    key: 'assessment', label: 'Assessment & Question Bank', icon: Database,
    features: [
      { icon: Database, title: 'Question Bank', desc: 'A reusable library of questions by category and difficulty.' },
      { icon: ClipboardCheck, title: 'Assessment Engine', desc: 'Structured assessments scored automatically and consistently.' },
      { icon: FileStack, title: 'Custom Templates', desc: 'Save interview templates and reuse them across roles.' },
      { icon: SlidersHorizontal, title: 'Difficulty Levels', desc: 'Easy to expert — tuned per role and seniority.' },
    ],
  },
  {
    key: 'email', label: 'Email & SMTP Integration', icon: Mail,
    features: [
      { icon: Server, title: 'Custom SMTP', desc: 'Send from your own domain with fully custom SMTP settings.' },
      { icon: Mail, title: 'Gmail OAuth', desc: 'Connect a Gmail account in one click for outgoing email.', badge: 'new' },
      { icon: LayoutTemplate, title: 'Branded Templates', desc: 'Beautiful, on-brand transactional emails out of the box.' },
      { icon: MousePointerClick, title: 'Email Tracking', desc: 'Open and click tracking on every message you send.' },
    ],
  },
  {
    key: 'notifications', label: 'Notifications', icon: Bell,
    features: [
      { icon: Bell, title: 'In-app Notifications', desc: 'Real-time alerts inside the dashboard for every key event.' },
      { icon: Mail, title: 'Email Notifications', desc: 'Timely email updates so nobody misses an interview or result.' },
      { icon: BellRing, title: 'Notification Center', desc: 'One place for all alerts, read and unread.' },
    ],
  },
  {
    key: 'reports', label: 'Reports & Analytics', icon: BarChart3,
    features: [
      { icon: FileBarChart, title: 'Interview Reports', desc: 'Strengths, gaps, and a clear hire recommendation per candidate.' },
      { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Traffic, audience, product usage, and business metrics in one view.', badge: 'new' },
      { icon: Filter, title: 'Conversion Funnel', desc: 'Visitor → sign-up → interview → paid, visualized end to end.' },
      { icon: Radio, title: 'Real-time Visitors', desc: 'See who is on your site right now, live.', badge: 'new' },
      { icon: Download, title: 'CSV / Excel / PDF Export', desc: 'Export any report in the format you need in one click.' },
    ],
  },
  {
    key: 'security', label: 'Security & Compliance', icon: Lock,
    features: [
      { icon: Lock, title: 'Encrypted Data', desc: 'Data encrypted in transit and at rest, with least-privilege access.', badge: 'enterprise' },
      { icon: ShieldAlert, title: 'Anti-cheat Proctoring', desc: 'Tab, blur, paste, and face-presence signals form a live integrity score.', badge: 'ai' },
      { icon: ScrollText, title: 'Audit Logs', desc: 'A full audit trail of sensitive actions across the platform.' },
      { icon: BadgeCheck, title: 'GDPR-friendly', desc: 'Data subject rights, a DPA, and privacy-first data handling.' },
      { icon: KeyRound, title: 'Two-Factor Auth', desc: 'Optional 2FA for an extra layer of account security.' },
      { icon: DatabaseBackup, title: 'Backup & Recovery', desc: 'Automated backups keep your data safe and recoverable.', badge: 'enterprise' },
    ],
  },
  {
    key: 'integrations', label: 'Integrations & APIs', icon: Cable,
    features: [
      { icon: Cable, title: '40+ Tracking Integrations', desc: 'GA4, GTM, Meta Pixel, Clarity, Hotjar, PostHog, and many more.', badge: 'new' },
      { icon: Webhook, title: 'Webhooks', desc: 'Push events to Slack, Discord, Zapier, Make, or your own endpoint.' },
      { icon: KeyRound, title: 'REST API & Keys', desc: 'Automate anything with a secure, key-based REST API.', badge: 'enterprise' },
      { icon: Code2, title: 'Custom Scripts', desc: 'Inject custom header and footer scripts safely from the admin panel.' },
    ],
  },
  {
    key: 'billing', label: 'Billing & Subscription', icon: CreditCard,
    features: [
      { icon: CreditCard, title: 'Multiple Gateways', desc: 'Cashfree, Razorpay, and Stripe supported out of the box.' },
      { icon: Ticket, title: 'Coupons & Discounts', desc: 'Percentage or fixed-amount promo codes with usage limits.' },
      { icon: ReceiptText, title: 'GST Invoices', desc: 'GST-compliant, downloadable PDF invoices for every payment.' },
      { icon: Sparkles, title: 'Free Trial', desc: 'Start free with no credit card required — upgrade when ready.', badge: 'popular' },
      { icon: Layers, title: 'Plan Management', desc: 'Upgrade, downgrade, or cancel anytime with prorated changes.' },
    ],
  },
  {
    key: 'cms', label: 'CMS & Blog Management', icon: Newspaper,
    features: [
      { icon: Newspaper, title: 'Blog with Rich Editor', desc: 'Publish SEO-friendly articles with a full WYSIWYG editor.' },
      { icon: MessageSquare, title: 'FAQs & Testimonials', desc: 'Manage FAQs and customer testimonials without touching code.' },
      { icon: Megaphone, title: 'Announcements', desc: 'Site-wide banners with scheduling and live countdowns.' },
      { icon: RefreshCw, title: 'Dynamic Content', desc: 'Everything you publish appears on the live site within seconds.' },
    ],
  },
  {
    key: 'mobile', label: 'Mobile & Responsive Experience', icon: Smartphone,
    features: [
      { icon: Smartphone, title: 'Fully Responsive', desc: 'Every page adapts cleanly to desktop, tablet, and mobile.', badge: 'new' },
      { icon: Hand, title: 'Touch-friendly', desc: 'Large tap targets and mobile-first interactions throughout.' },
      { icon: Video, title: 'Mobile Interview Room', desc: 'Candidates can complete their interview right from a phone.' },
      { icon: MonitorSmartphone, title: 'Cross-device', desc: 'Pick up exactly where you left off on any device.' },
    ],
  },
];

const TOTAL = CATEGORIES.reduce((n, c) => n + c.features.length, 0);

function FeatureBadge({ kind }: { kind: BadgeKind }) {
  const b = BADGES[kind];
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', b.cls)}>
      {b.label}
    </span>
  );
}

function FeatureCard({ f }: { f: FeatureItem }) {
  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/60 hover:shadow-[0_18px_50px_-24px_hsl(var(--primary)/0.5)]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
          <f.icon className="h-5 w-5 text-white" />
        </span>
        {f.badge && <FeatureBadge kind={f.badge} />}
      </div>
      <h3 className="mt-4 font-semibold">{f.title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.desc}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        active ? 'border-transparent bg-gradient-brand text-white shadow-glow' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function FeaturesClient() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATEGORIES
      .filter((c) => cat === 'all' || c.key === cat)
      .map((c) => ({ ...c, features: c.features.filter((f) => !s || `${f.title} ${f.desc} ${c.label}`.toLowerCase().includes(s)) }))
      .filter((c) => c.features.length > 0);
  }, [q, cat]);

  const shown = results.reduce((n, c) => n + c.features.length, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AIPL Hire',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', category: 'SaaS' },
    featureList: CATEGORIES.flatMap((c) => c.features.map((f) => f.title)),
  };

  return (
    <MarketingPage
      eyebrow="Platform"
      title={<>Everything you need to <span className="text-gradient">hire with AI</span></>}
      lead={`One premium platform — ${TOTAL}+ capabilities across ${CATEGORIES.length} areas, from first resume to final offer, for recruiters, HR teams, and candidates.`}
      breadcrumb={[{ label: 'Features' }]}
      actions={
        <>
          <Link href="/register"><Button size="lg"><Rocket className="h-4 w-4" /> Start Free Trial</Button></Link>
          <Link href="/contact"><Button size="lg" variant="glass" magnetic={false}><PlayCircle className="h-4 w-4" /> Request Demo</Button></Link>
        </>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Search + category filter */}
      <div className="mb-12 space-y-5">
        <div className="relative mx-auto max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${TOTAL}+ features…`}
            aria-label="Search features"
            className="h-12 w-full rounded-xl border border-input bg-card/60 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>
          ))}
        </div>
      </div>

      {/* Feature sections */}
      {shown === 0 ? (
        <EmptyState icon={Search} title="No features match your search" description="Try a different keyword or clear the filter to see everything." />
      ) : (
        <div className="space-y-16">
          {results.map((c) => (
            <Reveal as="section" key={c.key} id={c.key} className="scroll-mt-28">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight md:text-2xl">{c.label}</h2>
                  <p className="text-xs text-muted-foreground">{c.features.length} {c.features.length === 1 ? 'feature' : 'features'}</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {c.features.map((f) => <FeatureCard key={f.title} f={f} />)}
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* CTA */}
      <section className="mt-24">
        <GlassCard className="gradient-border relative overflow-hidden text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 aurora opacity-40" />
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">See the complete platform in action</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start free in minutes, or talk to our team about an enterprise rollout with SSO, custom AI weighting, and onboarding support.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/register"><Button size="lg"><Rocket className="h-4 w-4" /> Start Free Trial</Button></Link>
            <Link href="/contact"><Button size="lg" variant="glass" magnetic={false}><PlayCircle className="h-4 w-4" /> Request Demo</Button></Link>
            <Link href="/contact"><Button size="lg" variant="outline" magnetic={false}><PhoneCall className="h-4 w-4" /> Contact Sales</Button></Link>
          </div>
        </GlassCard>
      </section>
    </MarketingPage>
  );
}
