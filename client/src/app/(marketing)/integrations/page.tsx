import type { Metadata } from 'next';
import Link from 'next/link';
import { Plug, Webhook, KeyRound, ArrowRight, Users, Bell, RefreshCw, ShieldCheck } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, Steps, SectionHeading, CheckList, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'Integrations',
  description:
    'Connect AIPL Hire to your stack with a clean REST API, webhooks, and self-serve API keys. Build exactly the hiring workflow you need — no lock-in.',
  path: '/integrations',
  keywords: ['recruitment API', 'hiring API', 'webhooks', 'API keys', 'ATS integration', 'HRMS integration'],
});

const primitives: Feature[] = [
  { icon: Plug, title: 'REST API', desc: 'Create jobs, invite candidates, and pull scored reports programmatically over clean JSON endpoints.' },
  { icon: Webhook, title: 'Webhooks', desc: 'Subscribe to events like interview.completed and react in real time — signed payloads for verification.' },
  { icon: KeyRound, title: 'Scoped API keys', desc: 'Generate and revoke your own keys from the dashboard. Each request is authenticated with a Bearer token.' },
];

const buildIdeas = [
  'Sync candidates and statuses into your existing ATS or HRMS',
  'Push interview scores and reports into your data warehouse',
  'Trigger Slack, email, or SMS alerts when an interview completes',
  'Automate offer workflows based on the hire recommendation',
];

const steps = [
  { title: 'Generate an API key', desc: 'Company admins create scoped keys from Dashboard → API Keys. The secret is shown once.' },
  { title: 'Call the API', desc: 'Authenticate with your key as a Bearer token and hit the documented REST endpoints.' },
  { title: 'Subscribe to webhooks', desc: 'Receive real-time events so your systems stay in sync automatically.' },
];

export default function IntegrationsPage() {
  return (
    <MarketingPage
      eyebrow="Integrations"
      title={<>Connect AIPL Hire to your <span className="text-gradient">stack</span></>}
      lead="No fake connectors or checkbox logos — just a clean, documented REST API, webhooks, and self-serve API keys so you can build exactly the workflow you need."
      breadcrumb={[{ label: 'Integrations' }]}
      actions={
        <>
          <Link href="/api-docs"><Button size="lg">Explore the API</Button></Link>
          <Link href="/register"><Button size="lg" variant="glass" magnetic={false}>Get an API key</Button></Link>
        </>
      }
    >
      <FeatureGrid items={primitives} />

      <section className="mt-20 grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading
            center={false}
            eyebrow="What you can build"
            title="Your workflow, your way"
            lead="Everything in the product is available programmatically, so you can wire AIPL Hire into the tools your team already uses."
          />
          <CheckList items={buildIdeas} />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/api-docs"><Button variant="glass" magnetic={false}>Read API docs</Button></Link>
            <Link href="/contact"><Button variant="ghost" magnetic={false}>Talk to our team</Button></Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: RefreshCw, title: 'Two-way sync', desc: 'Keep candidates and statuses aligned across systems.' },
            { icon: Bell, title: 'Real-time events', desc: 'Act the moment an interview finishes.' },
            { icon: Users, title: 'Team-ready', desc: 'Scoped keys per environment and integration.' },
            { icon: ShieldCheck, title: 'Secure by default', desc: 'Hashed keys, revocable anytime, signed webhooks.' },
          ].map((c) => (
            <GlassCard key={c.title}>
              <c.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <SectionHeading eyebrow="How it works" title="Live in three steps" />
        <Steps steps={steps} />
      </section>

      <CTASection
        title={<>Build your <span className="text-gradient">integration</span></>}
        subtitle="Generate an API key and start connecting AIPL Hire to your stack today."
        primary={{ label: 'Get started', href: '/register' }}
        secondary={{ label: 'Read API docs', href: '/api-docs' }}
      />
    </MarketingPage>
  );
}
