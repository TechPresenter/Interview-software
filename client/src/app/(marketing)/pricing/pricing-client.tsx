'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { CTASection } from '@/components/public/CTASection';
import { PlanLimitsTable, type PublicPlan } from '@/components/public/PlanLimitsTable';
import { IncludedFeatures, type CapabilityGroup } from '@/components/public/IncludedFeatures';

/**
 * /content/plans is moving from a bare plan array to an envelope that also carries
 * the shared capability list. Both shapes are accepted so the page keeps rendering
 * plans while that API change ships.
 */
type PlansPayload = PublicPlan[] | { plans: PublicPlan[]; platformFeatures: CapabilityGroup[] };

const pricingFaqs = [
  {
    q: "What's the difference between the plans?",
    a: 'Only how much you can use. Every plan includes every platform feature — adaptive AI interviews, proctoring and integrity scoring, recordings, reports, analytics, and the full question bank. Plans differ on four things: interviews per month, active jobs, team members, and monthly AI usage. Support response times also vary by plan.',
  },
  {
    q: 'Is any feature held back for higher tiers?',
    a: 'No. There is no feature that unlocks by upgrading. If a capability exists in the product, it works the same on the Free Trial as it does on Enterprise — you upgrade for volume, not for access.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free Trial lets you run AI interviews without any payment details. Upgrade only when you are ready.',
  },
  {
    q: 'What counts as one AI interview?',
    a: 'One completed candidate interview session — including questions, scoring, and the generated report. Paid plans get a fresh allowance each calendar month; the Free Trial has a one-time total that does not reset.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. You can upgrade or cancel at any time from your billing dashboard. Cancelling takes effect immediately and returns your workspace to the Free Trial limits.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — switch to yearly billing to save roughly 17% compared to paying monthly.',
  },
];

export default function PricingClient() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data } = useQuery<PlansPayload>({ queryKey: ['public-plans'], queryFn: contentApi.plans });

  const plans: PublicPlan[] = Array.isArray(data) ? data : data?.plans ?? [];
  const included: CapabilityGroup[] = Array.isArray(data) ? [] : data?.platformFeatures ?? [];

  return (
    <main className="relative min-h-screen overflow-x-clip pb-24 pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] mesh-bg opacity-50" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-bg" />
      <div className="pointer-events-none absolute left-1/2 top-[-6%] -z-10 h-[440px] w-[960px] -translate-x-1/2 aurora opacity-60" />

      <div className="container">
        <Breadcrumbs items={[{ label: 'Pricing' }]} />

        <section className="py-12 text-center">
          <h1 className="text-4xl font-extrabold md:text-6xl">
            Simple, scalable <span className="text-gradient-animate">pricing</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Every plan includes every feature — you only choose how much you need.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Start free. No credit card. Cancel anytime.</p>

          <div className="mx-auto mt-8 inline-flex rounded-xl border border-border p-1">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn('rounded-lg px-5 py-2 text-sm capitalize transition', cycle === c ? 'bg-gradient-brand text-white' : 'text-muted-foreground')}
              >
                {c} {c === 'yearly' && <span className="text-xs text-accent">save ~17%</span>}
              </button>
            ))}
          </div>

          <div className="mt-12 grid gap-6 text-left md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const price = cycle === 'yearly' ? p.pricing.yearly : p.pricing.monthly;
              // Free and Enterprise are both priced at zero, so the tier key rather
              // than the number decides whether a card reads "Free" or "Custom".
              const isFree = p.key === 'free';
              return (
                <GlassCard key={p._id} interactive className={cn(p.isPopular && 'gradient-border glow ring-1 ring-primary/40 lg:scale-[1.03]')}>
                  {p.isPopular && <Badge className="mb-3">Most popular</Badge>}
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <p className="mt-3 text-4xl font-bold text-gradient">
                    {isFree ? 'Free' : price ? money(price, p.pricing.currency) : 'Custom'}
                    {!isFree && price ? <span className="text-base text-muted-foreground">/{cycle === 'yearly' ? 'yr' : 'mo'}</span> : null}
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                    {(p.features ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" /> {f}</li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-6 block">
                    <Button className="w-full" variant={p.isPopular ? 'primary' : 'glass'} magnetic={false}>
                      {isFree || price ? 'Get started' : 'Contact sales'}
                    </Button>
                  </Link>
                </GlassCard>
              );
            })}
          </div>
          {plans.length === 0 && (
            <p className="mt-10 text-sm text-muted-foreground">Plans will appear here once configured by the platform admin.</p>
          )}
        </section>

        <section className="mt-20">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">How the plans differ</h2>
          <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-muted-foreground">
            Usage is the only thing that changes between tiers. Limits apply per workspace.
          </p>
          <PlanLimitsTable plans={plans} />
          <div className="mt-8 rounded-2xl border border-border bg-card/40 p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <h3 className="text-lg font-semibold">Need higher volume or custom terms?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Procurement, invoicing, onboarding support, and a dedicated account manager.</p>
            </div>
            <Link href="/contact" className="mt-4 inline-block sm:mt-0">
              <Button magnetic={false}>Talk to sales</Button>
            </Link>
          </div>
        </section>

        {included.length > 0 && (
          <section className="mt-20">
            <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Every plan includes everything</h2>
            <p className="mx-auto mb-10 mt-3 max-w-2xl text-center text-muted-foreground">
              One list, not a matrix. Every capability below is on the Free Trial and on Enterprise alike.
            </p>
            <IncludedFeatures groups={included} />
          </section>
        )}

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Pricing questions</h2>
          <FaqAccordion items={pricingFaqs} />
        </section>

        <CTASection
          title={<>Ready to <span className="text-gradient">transform</span> your hiring?</>}
          subtitle="Join modern teams interviewing smarter with AI. Free to start."
          primary={{ label: 'Get started for free', href: '/register' }}
          secondary={{ label: 'Talk to sales', href: '/contact' }}
        />
      </div>
    </main>
  );
}
