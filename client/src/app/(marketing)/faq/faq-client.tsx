'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, HelpCircle } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { titleCase } from '@/lib/format';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

type Group = { category: string; items: { q: string; a: string }[] };

/**
 * Curated fallback shown only when no FAQs exist in the CMS yet (or the API is
 * unreachable) — so the marketing page is never blank. Any FAQ published from
 * Admin → CMS → FAQs immediately takes over.
 */
const FALLBACK_GROUPS: Group[] = [
  {
    category: 'Product',
    items: [
      { q: 'What is AIPL Hire?', a: 'AIPL Hire is an enterprise AI interview platform. It screens resumes, runs adaptive AI interviews, scores candidates objectively across seven competencies, and generates hire-ready reports — all in one place.' },
      { q: 'How do AI interviews work?', a: 'Candidates join a private, proctored session where an AI interviewer asks role-relevant questions, follows up on answers, and adapts difficulty in real time. They can respond by voice or text, in English or Hindi.' },
      { q: 'Can candidates interview in Hindi?', a: 'Yes. Interviews can be run in English or Hindi, and the language can be switched mid-interview with region-aware voices and localized scoring.' },
    ],
  },
  {
    category: 'Scoring & fairness',
    items: [
      { q: 'How are candidates scored?', a: 'Every candidate is evaluated against the same competency rubric. Each score includes quoted evidence from the transcript, so decisions are transparent and auditable.' },
      { q: 'How do you reduce bias?', a: 'Structured, consistent questions and a shared rubric mean every candidate is assessed on the same criteria. Scores are evidence-based rather than gut-feel, which helps reduce unconscious bias.' },
      { q: 'What does the integrity score mean?', a: 'During proctored interviews we monitor signals like tab switches, window blur, paste events, and face presence. These combine into a transparent integrity score to flag anomalies — without automatically disqualifying anyone.' },
    ],
  },
  {
    category: 'Billing',
    items: [
      { q: 'Is there a free plan?', a: 'Yes. The Free Trial lets you run AI interviews without a credit card so you can evaluate the platform before upgrading.' },
      { q: 'What counts as one interview?', a: 'One completed candidate session — questions, scoring, and the generated report — counts as a single interview against your monthly quota.' },
      { q: 'Can I cancel anytime?', a: 'Yes — upgrade or cancel at any time from your billing dashboard. Cancelling takes effect immediately and returns your workspace to the Free Trial limits; fees already paid are not refunded except where required by law.' },
    ],
  },
  {
    category: 'Security & data',
    items: [
      { q: 'Is my data secure?', a: 'Data is encrypted in transit and at rest, access is role-based, and we follow least-privilege principles. See our Security page for details.' },
      { q: 'Are you GDPR compliant?', a: 'Yes. We support data subject rights, offer a Data Processing Agreement, and process personal data lawfully. See our GDPR and DPA pages.' },
    ],
  },
];

export default function FaqClient() {
  const { data, isLoading } = useQuery({ queryKey: ['public-faqs'], queryFn: contentApi.faqs, staleTime: 60_000, retry: 1 });
  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [q, setQ] = useState('');

  // Group live FAQs by category (already sorted by `order` server-side). When
  // the CMS has none, fall back to the curated set above.
  const groups = useMemo<Group[]>(() => {
    if (!items.length) return FALLBACK_GROUPS;
    const map = new Map<string, { q: string; a: string }[]>();
    for (const f of items) {
      const cat = titleCase(f.category || 'General');
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ q: f.question, a: f.answer });
    }
    return Array.from(map, ([category, list]) => ({ category, items: list }));
  }, [items]);

  const filtered = useMemo<Group[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((it) => `${it.q} ${it.a}`.toLowerCase().includes(s)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) =>
      g.items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })),
    ),
  };

  return (
    <MarketingPage
      eyebrow="Answers"
      title={<>Frequently asked <span className="text-gradient">questions</span></>}
      lead="Everything you need to know about the product, scoring, billing, and security. Can't find it? Our team is one message away."
      breadcrumb={[{ label: 'FAQs' }]}
      actions={<Link href="/contact"><Button size="lg" variant="glass" magnetic={false}>Ask a question</Button></Link>}
    >
      <div className="mx-auto max-w-3xl">
        {/* Search */}
        <div className="relative mb-10">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search FAQs"
            className="h-12 w-full rounded-xl border border-input bg-card/60 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="No matching questions"
            description="Try a different search, or reach out and we'll answer directly."
            action={<Link href="/contact"><Button variant="glass" magnetic={false}>Contact us</Button></Link>}
          />
        ) : (
          <div className="space-y-12">
            {filtered.map((g) => (
              <section key={g.category}>
                <h2 className="mb-4 text-lg font-semibold">{g.category}</h2>
                <FaqAccordion items={g.items} />
              </section>
            ))}
          </div>
        )}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </MarketingPage>
  );
}
