import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';

/** Centered or left-aligned section heading with optional eyebrow + lead. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  center = true,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center && 'mx-auto max-w-2xl text-center', 'mb-12', className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      {lead && <p className="mt-4 text-muted-foreground">{lead}</p>}
    </div>
  );
}

export type Feature = { icon: LucideIcon; title: string; desc: ReactNode };

/** Responsive grid of icon feature cards. */
export function FeatureGrid({ items, columns = 3 }: { items: Feature[]; columns?: 2 | 3 | 4 }) {
  const cols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns];
  return (
    <div className={cn('grid gap-6', cols)}>
      {items.map((f, i) => (
        <GlassCard key={f.title} tilt delay={i * 0.04} className="group">
          <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow transition-transform duration-300 group-hover:scale-110">
            <f.icon className="h-6 w-6 text-white" />
          </span>
          <h3 className="text-lg font-semibold">{f.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
        </GlassCard>
      ))}
    </div>
  );
}

/** Bulleted list of short benefit strings with check icons. */
export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Row of headline statistics inside a glass panel. */
export function StatStrip({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <GlassCard className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <p className="text-4xl font-extrabold text-gradient md:text-5xl">{s.value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </GlassCard>
  );
}

export type Step = { title: string; desc: ReactNode };

/** Numbered vertical/step timeline. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <div key={s.title} className="relative rounded-2xl border border-border bg-card/40 p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-bold text-white">
            {i + 1}
          </span>
          <h3 className="mt-4 font-semibold">{s.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}
