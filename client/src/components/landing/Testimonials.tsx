'use client';

import { Star } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from './AiDemo';

const items = [
  { name: 'Aarav Mehta', role: 'Head of Talent, Nimbus', quote: 'We cut time-to-shortlist from 3 weeks to 2 days. The AI reports are scarily good — and fair.', initials: 'AM' },
  { name: 'Sofia Alvarez', role: 'VP Engineering, Cobalt', quote: 'Every candidate gets the same rigorous interview. Our hiring bar has never been more consistent.', initials: 'SA' },
  { name: 'Daniel Kim', role: 'Recruiting Lead, Vertex', quote: 'The proctoring + scoring combo means I trust the signal. It feels like having 10 senior interviewers.', initials: 'DK' },
  { name: 'Priya Nair', role: 'CHRO, Lumen', quote: 'Resume analysis alone paid for itself. Setup took an afternoon and it looks stunning.', initials: 'PN' },
  { name: 'Marco Rossi', role: 'Founder, Drift', quote: 'Candidates actually compliment the experience. That never happened with our old process.', initials: 'MR' },
];

export function Testimonials() {
  // Duplicate the list for a seamless marquee loop.
  const row = [...items, ...items];
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
                {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm leading-relaxed">“{t.quote}”</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-semibold text-white">{t.initials}</span>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
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
