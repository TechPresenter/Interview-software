import type { Metadata } from 'next';
import Link from 'next/link';
import { Plug, KeyRound, Webhook, ArrowRight } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { SectionHeading } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = pageMetadata({
  title: 'Integrations',
  description:
    'Connect AIPL Hire to your ATS, HRMS, SSO, and communication tools — or build your own with a REST API and webhooks. One hiring workflow, fully connected.',
  path: '/integrations',
  keywords: ['ATS integration', 'HRMS integration', 'SSO', 'webhooks', 'recruitment API', 'Greenhouse Lever Workday'],
});

type Status = 'Available' | 'Beta' | 'Coming soon';
const statusStyle: Record<Status, string> = {
  Available: 'bg-emerald-400/15 text-emerald-400',
  Beta: 'bg-amber-400/15 text-amber-400',
  'Coming soon': 'bg-muted text-muted-foreground',
};

const groups: { category: string; items: { name: string; desc: string; status: Status }[] }[] = [
  {
    category: 'Applicant Tracking (ATS)',
    items: [
      { name: 'Greenhouse', desc: 'Sync jobs & push interview scores back to candidates.', status: 'Beta' },
      { name: 'Lever', desc: 'Two-way candidate sync and stage automation.', status: 'Coming soon' },
      { name: 'Workday', desc: 'Enterprise req sync and reporting.', status: 'Coming soon' },
    ],
  },
  {
    category: 'HRMS & Onboarding',
    items: [
      { name: 'BambooHR', desc: 'Hand off hires directly into onboarding.', status: 'Coming soon' },
      { name: 'Zoho People', desc: 'Sync employee records post-hire.', status: 'Coming soon' },
    ],
  },
  {
    category: 'Single Sign-On',
    items: [
      { name: 'Google Workspace', desc: 'One-click SSO for your whole team.', status: 'Available' },
      { name: 'Okta / SAML', desc: 'Enterprise SSO and SCIM provisioning.', status: 'Beta' },
    ],
  },
  {
    category: 'Communication',
    items: [
      { name: 'Slack', desc: 'Get interview-complete alerts in channel.', status: 'Beta' },
      { name: 'Email & SMS', desc: 'Automated candidate invites and reminders.', status: 'Available' },
      { name: 'WhatsApp', desc: 'Reach candidates on their preferred channel.', status: 'Available' },
    ],
  },
];

export default function IntegrationsPage() {
  return (
    <MarketingPage
      eyebrow="Integrations"
      title={<>Fits right into your <span className="text-gradient">hiring stack</span></>}
      lead="Connect the tools your team already uses — or build exactly what you need on our API and webhooks."
      breadcrumb={[{ label: 'Integrations' }]}
      actions={
        <>
          <Link href="/api-docs"><Button size="lg">Explore the API</Button></Link>
          <Link href="/contact"><Button size="lg" variant="glass" magnetic={false}>Request an integration</Button></Link>
        </>
      }
    >
      {groups.map((group) => (
        <section key={group.category} className="mb-12">
          <h2 className="mb-5 text-lg font-semibold">{group.category}</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((it) => (
              <GlassCard key={it.name} interactive className="flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-muted/40 text-sm font-bold">
                    {it.name.slice(0, 2)}
                  </span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusStyle[it.status])}>{it.status}</span>
                </div>
                <h3 className="mt-4 font-semibold">{it.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-16">
        <SectionHeading eyebrow="Build your own" title="Developer-friendly by default" lead="Everything in the product is available programmatically." />
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Plug, title: 'REST API', desc: 'Create jobs, invite candidates, and pull scored reports.', href: '/api-docs' },
            { icon: Webhook, title: 'Webhooks', desc: 'Subscribe to interview.completed and pipeline events.', href: '/api-docs' },
            { icon: KeyRound, title: 'API keys & scopes', desc: 'Scoped keys with per-environment access controls.', href: '/dashboard/api-keys' },
          ].map((c) => (
            <GlassCard key={c.title} className="group">
              <c.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              <Link href={c.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Learn more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </GlassCard>
          ))}
        </div>
      </section>

      <CTASection
        title={<>Don&apos;t see your tool?</>}
        subtitle="Tell us what you need — our team ships new integrations every month."
        primary={{ label: 'Request an integration', href: '/contact' }}
        secondary={{ label: 'Read API docs', href: '/api-docs' }}
      />
    </MarketingPage>
  );
}
