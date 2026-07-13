import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Telescope, Sparkles, Bot, Users, FileText, ClipboardList, Video, BarChart3, Workflow, LayoutDashboard,
  UserRound, Briefcase, CalendarClock, Mail, ClipboardCheck, Database, Building2, Cloud, Zap, ShieldCheck,
  Lock, Rocket, Activity, Smartphone, UsersRound, KeyRound, Layers, LifeBuoy, Cpu, HeartPulse, GraduationCap,
  Factory, ShoppingBag, Landmark, Truck, Hotel, Building, Mic, MonitorPlay, CircleUserRound, FileSignature,
  Bell, Plug, DatabaseBackup, ScrollText, Fingerprint, Server,
} from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, SectionHeading, CheckList, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { TrustBadges, CompanyIdentityCard, ComplianceCards } from '@/components/public/CompanyIdentity';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/utils';

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description:
    'AIPL Hire is an AI-powered recruitment and applicant tracking platform developed and owned by Ayansh Institute Private Limited (CIN U85499BR2025PTC080635) — an MCA-registered, ISO 9001:2015 certified, NSDC partner company.',
  path: '/about',
  keywords: [
    'Ayansh Institute Private Limited', 'AIPL Hire', 'AI recruitment platform', 'MCA registered',
    'ISO 9001:2015', 'NSDC partner', 'applicant tracking system', 'AI interview software',
  ],
});

type Tile = { icon: LucideIcon; label: string };

const benefits: Tile[] = [
  { icon: Bot, label: 'AI Interview Platform' },
  { icon: Users, label: 'Smart Candidate Matching' },
  { icon: FileText, label: 'Resume Parsing' },
  { icon: ClipboardList, label: 'Applicant Tracking System' },
  { icon: Video, label: 'Live Video Interviews' },
  { icon: BarChart3, label: 'AI Interview Analytics' },
  { icon: Workflow, label: 'Recruitment Automation' },
  { icon: LayoutDashboard, label: 'Company Dashboard' },
  { icon: CircleUserRound, label: 'Candidate Dashboard' },
  { icon: Briefcase, label: 'Job Portal' },
  { icon: CalendarClock, label: 'Interview Scheduling' },
  { icon: Mail, label: 'Email Notifications' },
  { icon: ClipboardCheck, label: 'Assessment Management' },
  { icon: Database, label: 'Resume Database' },
  { icon: Building2, label: 'Multi-company Support' },
  { icon: Cloud, label: 'Secure Cloud Platform' },
];

const whyChoose: Feature[] = [
  { icon: Bot, title: 'AI-powered recruitment', desc: 'Adaptive AI interviews and evidence-based scoring evaluate every candidate consistently.' },
  { icon: Zap, title: 'Faster hiring', desc: 'Automate screening and scheduling to cut time-to-shortlist from weeks to days.' },
  { icon: ShieldCheck, title: 'Secure platform', desc: 'Encryption in transit and at rest with least-privilege access controls.' },
  { icon: Lock, title: 'Enterprise security', desc: 'Role-based access, audit logs, and privacy-first data handling.' },
  { icon: Rocket, title: 'Easy onboarding', desc: 'Go live in an afternoon — guided setup with no complex configuration.' },
  { icon: Sparkles, title: 'Modern UI', desc: 'A clean, premium interface your team actually enjoys using.' },
  { icon: Activity, title: 'Real-time analytics', desc: 'Live dashboards for pipeline, interviews, and hiring performance.' },
  { icon: Workflow, title: 'Automated workflows', desc: 'Trigger invites, reminders, and follow-ups automatically.' },
  { icon: Smartphone, title: 'Responsive design', desc: 'Fully usable on desktop, tablet, and mobile for recruiters and candidates.' },
  { icon: Cloud, title: 'Cloud-based platform', desc: 'Reliable, always-on cloud infrastructure with nothing to install.' },
  { icon: UsersRound, title: 'Multi-user roles', desc: 'Recruiters, hiring managers, and admins collaborate in one workspace.' },
  { icon: KeyRound, title: 'Role-based permissions', desc: 'Grant precise access to features and data by role.' },
  { icon: Layers, title: 'Scalable architecture', desc: 'Built to grow from a single team to a multi-company enterprise.' },
  { icon: LifeBuoy, title: 'Reliable support', desc: 'Responsive help whenever you need it, from setup to scale.' },
];

const industries: Tile[] = [
  { icon: Cpu, label: 'IT' },
  { icon: HeartPulse, label: 'Healthcare' },
  { icon: GraduationCap, label: 'Education' },
  { icon: Factory, label: 'Manufacturing' },
  { icon: ShoppingBag, label: 'Retail' },
  { icon: Landmark, label: 'BFSI' },
  { icon: Truck, label: 'Logistics' },
  { icon: Hotel, label: 'Hospitality' },
  { icon: Building, label: 'Government' },
  { icon: Rocket, label: 'Startups' },
  { icon: Building2, label: 'Enterprises' },
];

const platformFeatures: Tile[] = [
  { icon: FileText, label: 'AI Resume Screening' },
  { icon: Bot, label: 'AI Interview Assistant' },
  { icon: MonitorPlay, label: 'Live Interview Room' },
  { icon: Mic, label: 'Interview Recording' },
  { icon: Database, label: 'Question Bank' },
  { icon: Users, label: 'Candidate Tracking' },
  { icon: FileSignature, label: 'Offer Letter Management' },
  { icon: ClipboardCheck, label: 'Assessment Engine' },
  { icon: BarChart3, label: 'Analytics Dashboard' },
  { icon: Building2, label: 'Company Portal' },
  { icon: CircleUserRound, label: 'Candidate Portal' },
  { icon: UsersRound, label: 'Staff Management' },
  { icon: Mail, label: 'Email Automation' },
  { icon: Bell, label: 'Notification Center' },
  { icon: BarChart3, label: 'Reports' },
  { icon: Plug, label: 'API Integrations' },
];

const security: { icon: LucideIcon; label: string }[] = [
  { icon: Fingerprint, label: 'Secure authentication' },
  { icon: Lock, label: 'Encrypted data (in transit & at rest)' },
  { icon: ShieldCheck, label: 'GDPR-friendly practices' },
  { icon: Fingerprint, label: 'Privacy-first approach' },
  { icon: Server, label: 'Secure cloud infrastructure' },
  { icon: KeyRound, label: 'Role-based access' },
  { icon: ScrollText, label: 'Audit logs' },
  { icon: DatabaseBackup, label: 'Backup & recovery' },
];

/** Compact icon-tile grid for capability lists. */
function TileGrid({ items, className }: { items: Tile[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3.5 transition-colors hover:border-primary/30 hover:bg-card/60">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <it.icon className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow={COMPANY.legalName}
      title={<>AIPL Hire — <span className="text-gradient">AI-powered hiring</span> for modern teams</>}
      lead={COMPANY.ownership}
      breadcrumb={[{ label: 'About Us' }]}
      actions={
        <>
          <Link href="/register"><Button size="lg">Get Started</Button></Link>
          <Link href="/contact"><Button size="lg" variant="glass" magnetic={false}>Contact Us</Button></Link>
        </>
      }
    >
      {/* Hero trust badges */}
      <TrustBadges className="-mt-6 mb-14" />

      {/* Company identity (prominent, for compliance) */}
      <section className="mb-20">
        <CompanyIdentityCard />
      </section>

      {/* About AIPL Hire */}
      <section className="mb-20">
        <SectionHeading
          eyebrow="About AIPL Hire"
          title="An AI-powered recruitment platform"
          lead={
            <>
              AIPL Hire is developed by {COMPANY.legalName} to modernize hiring through intelligent automation — from
              resume parsing and smart candidate matching to adaptive AI interviews, analytics, and end-to-end applicant
              tracking, all in one secure cloud platform.
            </>
          }
        />
        <TileGrid items={benefits} />
      </section>

      {/* Why choose us */}
      <section className="mb-20">
        <SectionHeading eyebrow="Why choose us" title="Built for confident, efficient hiring" />
        <FeatureGrid items={whyChoose} columns={4} />
      </section>

      {/* Certifications & compliance */}
      <section className="mb-20">
        <SectionHeading
          eyebrow="Certifications & compliance"
          title="A registered, certified company"
          lead="AIPL Hire is operated by a legally registered, quality-certified organization you can trust."
        />
        <ComplianceCards />
      </section>

      {/* Vision & Mission */}
      <section className="mb-20 grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <Telescope className="h-6 w-6 text-accent" />
          <h2 className="mt-4 text-xl font-bold">Our Vision</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            To become India&apos;s trusted AI recruitment ecosystem — connecting employers, institutions, and job seekers
            through intelligent technology that makes opportunity more accessible and hiring more transparent.
          </p>
        </GlassCard>
        <GlassCard>
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Our Mission</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            To simplify hiring using AI while ensuring transparency, quality, efficiency, and accessibility — so every
            organization can find the right talent on merit, quickly and fairly.
          </p>
        </GlassCard>
      </section>

      {/* Industries */}
      <section className="mb-20">
        <SectionHeading eyebrow="Industries we serve" title="Trusted across sectors" />
        <div className="flex flex-wrap justify-center gap-3">
          {industries.map((i) => (
            <span key={i.label} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/30 hover:text-primary">
              <i.icon className="h-4 w-4 text-primary" /> {i.label}
            </span>
          ))}
        </div>
      </section>

      {/* Platform features */}
      <section className="mb-20">
        <SectionHeading eyebrow="Platform features" title="Everything you need to hire, in one place" />
        <TileGrid items={platformFeatures} />
      </section>

      {/* Trust & security */}
      <section className="mb-4">
        <SectionHeading eyebrow="Trust & security" title="Security and privacy by design" />
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {security.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <CTASection
        title={<>Hire smarter with <span className="text-gradient">AIPL Hire</span></>}
        subtitle={`An AI-powered recruitment platform by ${COMPANY.legalName}.`}
        primary={{ label: 'Get Started', href: '/register' }}
        secondary={{ label: 'Contact Us', href: '/contact' }}
      />
    </MarketingPage>
  );
}
