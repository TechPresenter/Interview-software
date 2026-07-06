'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Rocket, Video, CreditCard, Users, ShieldCheck, Settings, ArrowRight, LifeBuoy, Search, SearchX } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

const categories = [
  { icon: Rocket, title: 'Getting started', desc: 'Set up your workspace, create a job, and invite your first candidates.', href: '/docs#getting-started' },
  { icon: Video, title: 'Running interviews', desc: 'Configure AI interviews, languages, proctoring, and the interview room.', href: '/docs#interviews' },
  { icon: Users, title: 'Candidates & pipeline', desc: 'Import candidates, move stages, and collaborate with your team.', href: '/docs#pipeline' },
  { icon: CreditCard, title: 'Billing & plans', desc: 'Manage your subscription, invoices, and interview quotas.', href: '/docs#billing' },
  { icon: ShieldCheck, title: 'Security & privacy', desc: 'Data protection, access controls, and compliance.', href: '/security' },
  { icon: Settings, title: 'Account & settings', desc: 'Profiles, roles, notifications, and workspace preferences.', href: '/docs#account' },
];

const popular = [
  { q: 'How do I create my first AI interview?', href: '/docs#getting-started' },
  { q: 'What do the competency scores mean?', href: '/docs#interviews' },
  { q: 'How does proctoring and the integrity score work?', href: '/faq' },
  { q: 'How do I upgrade or change my plan?', href: '/docs#billing' },
  { q: 'Can candidates interview in Hindi?', href: '/faq' },
];

export default function HelpCenterClient() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const cats = useMemo(
    () => (q ? categories.filter((c) => `${c.title} ${c.desc}`.toLowerCase().includes(q)) : categories),
    [q],
  );
  const faqs = useMemo(() => (q ? popular.filter((p) => p.q.toLowerCase().includes(q)) : popular), [q]);
  const nothing = q && cats.length === 0 && faqs.length === 0;

  return (
    <div>
      {/* Search */}
      <div className="relative mx-auto max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          aria-label="Search help articles"
          className="h-12 w-full rounded-2xl border border-input bg-card/60 pl-12 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {nothing ? (
        <EmptyState
          className="mt-12"
          icon={SearchX}
          title="No results found"
          description={<>We could not find anything for “{query}”. Try different keywords or <Link href="/contact" className="text-primary underline underline-offset-4">contact support</Link>.</>}
        />
      ) : (
        <>
          {cats.length > 0 && (
            <section className="mt-12">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {cats.map((c) => (
                  <Link key={c.title} href={c.href}>
                    <GlassCard interactive className="group h-full">
                      <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
                        <c.icon className="h-6 w-6 text-white" />
                      </span>
                      <h3 className="text-lg font-semibold">{c.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {faqs.length > 0 && (
            <section className="mt-14">
              <h2 className="mb-4 text-lg font-semibold">Popular questions</h2>
              <div className="divide-y divide-border rounded-2xl border border-border">
                {faqs.map((p) => (
                  <Link key={p.q} href={p.href} className="flex items-center justify-between gap-4 px-5 py-4 text-sm transition-colors hover:bg-muted/40">
                    <span>{p.q}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Support CTA */}
      <section className="mt-16">
        <GlassCard className="flex flex-col items-center gap-4 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10"><LifeBuoy className="h-6 w-6 text-primary" /></span>
            <div>
              <h3 className="text-lg font-semibold">Still need a hand?</h3>
              <p className="text-sm text-muted-foreground">Our support team replies within one business day.</p>
            </div>
          </div>
          <Link href="/contact"><Button magnetic={false}>Contact us</Button></Link>
        </GlassCard>
      </section>
    </div>
  );
}
