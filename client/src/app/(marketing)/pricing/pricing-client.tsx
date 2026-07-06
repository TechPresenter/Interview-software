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
import { ComparisonTable, type ComparisonRow } from '@/components/public/ComparisonTable';

const compareCols = ['Free Trial', 'Starter', 'Professional', 'Enterprise'];
const compareRows: ComparisonRow[] = [
  { label: 'AI interviews / month', values: ['3 (one-time)', '100', '2,500', 'Unlimited'] },
  { label: 'Active jobs', values: ['1', '10', 'Unlimited', 'Unlimited'] },
  { label: 'Resume analysis & scoring', values: [true, true, true, true] },
  { label: 'AI candidate ranking', values: [false, true, true, true] },
  { label: 'Interview reports', values: ['Basic', true, true, true] },
  { label: 'Anti-cheat monitoring', values: [false, false, true, true] },
  { label: 'Video recording', values: [false, false, true, true] },
  { label: 'Custom templates', values: [false, false, true, true] },
  { label: 'Analytics dashboard', values: [false, 'Basic', true, true] },
  { label: 'Team members', values: ['1', '5', '25', 'Unlimited'] },
  { label: 'ATS / HRMS integrations', values: [false, false, 'Limited', true] },
  { label: 'SSO & advanced security', values: [false, false, false, true] },
  { label: 'API access', values: [false, false, false, true] },
  { label: 'White label', values: [false, false, false, true] },
  { label: 'Support', values: ['Email', 'Email', 'Priority', 'Dedicated'] },
];

const pricingFaqs = [
  { q: 'Do I need a credit card to start?', a: 'No. The Free Trial lets you run AI interviews without any payment details. Upgrade only when you are ready.' },
  { q: 'What counts as one AI interview?', a: 'One completed candidate interview session — including questions, scoring, and the generated report — counts as a single interview against your monthly quota.' },
  { q: 'Can I change plans later?', a: 'Yes. You can upgrade, downgrade, or cancel at any time from your billing dashboard. Changes are prorated automatically.' },
  { q: 'Do you offer annual billing?', a: 'Yes — switch to yearly billing to save roughly 17% compared to paying monthly.' },
];

export default function PricingClient() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data: plans } = useQuery({ queryKey: ['public-plans'], queryFn: contentApi.plans });

  return (
    <main className="relative min-h-screen overflow-x-clip pb-24 pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] mesh-bg opacity-50" />

      <div className="container">
        <Breadcrumbs items={[{ label: 'Pricing' }]} />

        <section className="py-12 text-center">
          <h1 className="text-4xl font-extrabold md:text-6xl">
            Simple, scalable <span className="text-gradient">pricing</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start free. Upgrade as you grow. Cancel anytime.</p>

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
            {(plans ?? []).map((p: any) => {
              const price = cycle === 'yearly' ? p.pricing.yearly : p.pricing.monthly;
              return (
                <GlassCard key={p._id} interactive className={cn(p.isPopular && 'ring-1 ring-primary/40')}>
                  {p.isPopular && <Badge className="mb-3">Most popular</Badge>}
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <p className="mt-3 text-4xl font-bold text-gradient">
                    {price ? money(price, p.pricing.currency) : 'Custom'}
                    {price ? <span className="text-base text-muted-foreground">/{cycle === 'yearly' ? 'yr' : 'mo'}</span> : null}
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                    {(p.features ?? []).map((f: string) => (
                      <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" /> {f}</li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-6 block">
                    <Button className="w-full" variant={p.isPopular ? 'primary' : 'glass'} magnetic={false}>
                      {price ? 'Get started' : 'Contact sales'}
                    </Button>
                  </Link>
                </GlassCard>
              );
            })}
          </div>
          {(plans ?? []).length === 0 && (
            <p className="mt-10 text-sm text-muted-foreground">Plans will appear here once configured by the platform admin.</p>
          )}
        </section>

        <section className="mt-20">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Compare every plan</h2>
          <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-muted-foreground">
            Everything in each tier, side by side. Prices and limits are billed per workspace.
          </p>
          <ComparisonTable columns={compareCols} rows={compareRows} highlightCol={2} firstColLabel="Feature" />
          <div className="mt-8 rounded-2xl border border-border bg-card/40 p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <h3 className="text-lg font-semibold">Need enterprise scale or custom terms?</h3>
              <p className="mt-1 text-sm text-muted-foreground">SSO, custom AI weighting, procurement, and a dedicated manager.</p>
            </div>
            <Link href="/contact" className="mt-4 inline-block sm:mt-0">
              <Button magnetic={false}>Talk to sales</Button>
            </Link>
          </div>
        </section>

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
