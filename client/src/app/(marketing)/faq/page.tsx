import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'FAQs',
  description:
    'Frequently asked questions about AIPL Hire — how AI interviews work, scoring and fairness, proctoring, pricing, data security, and getting started.',
  path: '/faq',
  keywords: ['AIPL Hire FAQ', 'AI interview questions', 'hiring software FAQ'],
});

const groups: { category: string; items: { q: string; a: string }[] }[] = [
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
      { q: 'Can I cancel anytime?', a: 'Absolutely. Upgrade, downgrade, or cancel at any time from your billing dashboard; changes are prorated automatically.' },
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

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) =>
      g.items.map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
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
      <div className="mx-auto max-w-3xl space-y-12">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="mb-4 text-lg font-semibold">{g.category}</h2>
            <FaqAccordion items={g.items} />
          </section>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </MarketingPage>
  );
}
