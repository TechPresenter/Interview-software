'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from './AiDemo';

type Card = { name: string; role: string; quote: string; rating: number; avatar?: string };

/** Curated fallback — shown only until testimonials are published in Admin → CMS. */
const FALLBACK: Card[] = [
  { name: 'Aarav Mehta', role: 'Head of Talent, Nimbus', quote: 'We cut time-to-shortlist from 3 weeks to 2 days. The AI reports are scarily good — and fair.', rating: 5 },
  { name: 'Sofia Alvarez', role: 'VP Engineering, Cobalt', quote: 'Every candidate gets the same rigorous interview. Our hiring bar has never been more consistent.', rating: 5 },
  { name: 'Daniel Kim', role: 'Recruiting Lead, Vertex', quote: 'The proctoring + scoring combo means I trust the signal. It feels like having 10 senior interviewers.', rating: 5 },
  { name: 'Priya Nair', role: 'CHRO, Lumen', quote: 'Resume analysis alone paid for itself. Setup took an afternoon and it looks stunning.', rating: 5 },
  { name: 'Marco Rossi', role: 'Founder, Drift', quote: 'Candidates actually compliment the experience. That never happened with our old process.', rating: 5 },
];

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '★';

export function Testimonials() {
  const { data } = useQuery({ queryKey: ['public-testimonials'], queryFn: contentApi.testimonials, staleTime: 60_000, retry: 1 });

  const items = useMemo<Card[]>(() => {
    const list = Array.isArray(data) ? data : [];
    if (!list.length) return FALLBACK;
    return list.map((t: any) => ({
      name: t.name,
      role: [t.role, t.company].filter(Boolean).join(', '),
      quote: t.quote,
      rating: t.rating || 5,
      avatar: t.avatar || undefined,
    }));
  }, [data]);

  // Duplicate the list for a seamless marquee loop (need enough cards to fill the row).
  const row = items.length >= 3 ? [...items, ...items] : [...items, ...items, ...items, ...items];

  return (
    <section className="py-24">
      <div className="container mx-auto max-w-2xl text-center">
        <Eyebrow>Loved by teams</Eyebrow>
        <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Hiring teams ship faster with AIPL Hire</h2>
      </div>

      <div className="group relative mt-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex w-max gap-5 animate-[marquee_38s_linear_infinite] group-hover:[animation-play-state:paused]">
          {row.map((t, i) => (
            <GlassCard key={i} className="w-[340px] shrink-0">
              <div className="flex gap-1 text-amber-400">
                {Array.from({ length: Math.max(1, Math.min(5, t.rating)) }).map((_, s) => <Star key={s} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm leading-relaxed">“{t.quote}”</p>
              <div className="mt-5 flex items-center gap-3">
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-semibold text-white">
                    {initialsOf(t.name)}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
