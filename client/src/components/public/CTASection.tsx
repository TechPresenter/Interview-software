import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CTASectionProps {
  title: ReactNode;
  subtitle?: ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}

/** Reusable end-of-page conversion block, shared for consistent branding. */
export function CTASection({
  title,
  subtitle,
  primary = { label: 'Start hiring free', href: '/register' },
  secondary = { label: 'View pricing', href: '/pricing' },
}: CTASectionProps) {
  return (
    <section className="mt-24">
      <div className="relative overflow-hidden rounded-3xl border border-border p-10 text-center md:p-16">
        <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-80" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-background/40" />
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
        {subtitle && <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{subtitle}</p>}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href={primary.href}>
            <Button size="lg">
              {primary.label} <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          {secondary && (
            <Link href={secondary.href}>
              <Button size="lg" variant="glass" magnetic={false}>
                {secondary.label}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default CTASection;
