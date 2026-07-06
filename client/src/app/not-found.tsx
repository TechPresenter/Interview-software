import Link from 'next/link';
import { Sparkles, Home, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SITE } from '@/lib/site';

const quickLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Help Center', href: '/help-center' },
  { label: 'Contact', href: '/contact' },
];

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-60" />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg" />

      <Link href="/" className="absolute left-6 top-6 flex items-center gap-2 text-base font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <span className="text-gradient">{SITE.name}</span>
      </Link>

      <div className="text-center">
        <p className="text-[7rem] font-extrabold leading-none text-gradient md:text-[10rem]">404</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">This page took a different interview</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          The page you are looking for was moved, removed, or never existed. Let us get you back on track.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/"><Button size="lg"><Home className="h-5 w-5" /> Back home</Button></Link>
          <Link href="/help-center"><Button size="lg" variant="glass" magnetic={false}><Compass className="h-5 w-5" /> Help Center</Button></Link>
        </div>

        <div className="mt-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Popular pages</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {quickLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                {l.label}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
