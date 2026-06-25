'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';

export default function PricingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data: plans } = useQuery({ queryKey: ['public-plans'], queryFn: contentApi.plans });

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-50" />
      <header className="container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-gradient">HireSense</span>
        </Link>
        <Link href="/login"><Button size="sm" variant="glass" magnetic={false}>Sign in</Button></Link>
      </header>

      <section className="container py-16 text-center">
        <h1 className="text-4xl font-extrabold md:text-6xl">Simple, scalable <span className="text-gradient">pricing</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start free. Upgrade as you grow. Cancel anytime.</p>

        <div className="mx-auto mt-8 inline-flex rounded-xl border border-border p-1">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button key={c} onClick={() => setCycle(c)} className={cn('rounded-lg px-5 py-2 text-sm capitalize', cycle === c ? 'bg-gradient-brand text-white' : 'text-muted-foreground')}>
              {c} {c === 'yearly' && <span className="text-xs text-accent">save ~17%</span>}
            </button>
          ))}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {(plans ?? []).map((p: any) => {
            const price = cycle === 'yearly' ? p.pricing.yearly : p.pricing.monthly;
            return (
              <GlassCard key={p._id} interactive className={cn('text-left', p.isPopular && 'ring-1 ring-primary/40')}>
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
    </main>
  );
}
