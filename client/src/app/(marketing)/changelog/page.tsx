import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { cn } from '@/lib/utils';

export const metadata: Metadata = pageMetadata({
  title: 'Changelog',
  description:
    "What's new in HireSense — the latest features, improvements, and fixes shipped across the platform.",
  path: '/changelog',
  keywords: ['HireSense changelog', 'release notes', 'product updates', "what's new"],
});

type Tag = 'New' | 'Improved' | 'Fixed';
const tagStyle: Record<Tag, string> = {
  New: 'bg-primary/15 text-primary',
  Improved: 'bg-accent/15 text-accent',
  Fixed: 'bg-amber-400/15 text-amber-400',
};

const releases: { version: string; date: string; items: { tag: Tag; text: string }[] }[] = [
  {
    version: 'v2.4',
    date: 'June 2026',
    items: [
      { tag: 'New', text: 'Custom AI interviewer profiles — set a name, avatar, voice, and personality per company.' },
      { tag: 'New', text: 'Re-speak question in the interview room for better accessibility.' },
      { tag: 'Improved', text: 'Faster report generation and clearer competency evidence quotes.' },
    ],
  },
  {
    version: 'v2.3',
    date: 'May 2026',
    items: [
      { tag: 'New', text: 'Dedicated profile pages and a real-time notifications feed.' },
      { tag: 'New', text: 'India/INR pricing with Free Trial, Starter, Professional, and Enterprise plans.' },
      { tag: 'Improved', text: 'Refined dashboard navigation and account settings.' },
    ],
  },
  {
    version: 'v2.2',
    date: 'April 2026',
    items: [
      { tag: 'New', text: 'White-label branding — logo, colors, favicon, and custom CSS.' },
      { tag: 'New', text: 'Bilingual interview room (English / Hindi) with region-aware voices.' },
      { tag: 'Fixed', text: 'Improved recording quality and echo cancellation in the interview room.' },
    ],
  },
  {
    version: 'v2.1',
    date: 'March 2026',
    items: [
      { tag: 'New', text: 'Anti-cheat proctoring with a live integrity score.' },
      { tag: 'Improved', text: 'Pipeline board performance for large candidate volumes.' },
      { tag: 'Fixed', text: 'CSV candidate import edge cases and resume parsing reliability.' },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MarketingPage
      eyebrow="Product"
      title={<>What&apos;s <span className="text-gradient">new</span></>}
      lead="A running log of the features, improvements, and fixes we ship. Follow along as the platform evolves."
      breadcrumb={[{ label: 'Changelog' }]}
    >
      <div className="mx-auto max-w-3xl">
        <ol className="relative border-l border-border">
          {releases.map((r) => (
            <li key={r.version} className="mb-12 ml-6">
              <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-background bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))]" />
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-bold">{r.version}</h2>
                <time className="text-sm text-muted-foreground">{r.date}</time>
              </div>
              <ul className="mt-4 space-y-3">
                {r.items.map((it) => (
                  <li key={it.text} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', tagStyle[it.tag])}>{it.tag}</span>
                    <span>{it.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </MarketingPage>
  );
}
