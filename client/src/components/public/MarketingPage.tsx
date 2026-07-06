import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';

interface MarketingPageProps {
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title: ReactNode;
  /** Supporting sentence under the title. */
  lead?: ReactNode;
  breadcrumb: Crumb[];
  /** Optional actions (buttons) rendered under the lead. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared scaffold for public content pages: ambient mesh background, header
 * clearance, breadcrumb, eyebrow, title, and lead — giving every marketing page
 * consistent branding, spacing, and typography. Server-safe (no hooks).
 */
export function MarketingPage({ eyebrow, title, lead, breadcrumb, actions, children }: MarketingPageProps) {
  return (
    <main className="relative min-h-screen overflow-x-clip pb-24 pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] mesh-bg opacity-50" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-bg" />
      <div className="pointer-events-none absolute left-1/2 top-[-6%] -z-10 h-[440px] w-[960px] -translate-x-1/2 aurora opacity-60" />

      <div className="container">
        <Breadcrumbs items={breadcrumb} />

        <header className="mt-8 max-w-3xl">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {eyebrow}
            </span>
          )}
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            {title}
          </h1>
          {lead && <p className="mt-5 text-lg text-muted-foreground">{lead}</p>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
        </header>

        <div className="mt-14">{children}</div>
      </div>
    </main>
  );
}

export default MarketingPage;
