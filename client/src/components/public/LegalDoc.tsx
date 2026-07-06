import type { ReactNode } from 'react';
import { MarketingPage } from './MarketingPage';
import { Prose } from './Prose';
import type { Crumb } from './Breadcrumbs';

export type LegalSection = { id: string; heading: string; body: ReactNode };

interface LegalDocProps {
  title: string;
  /** Human-readable last-updated date, e.g. "6 July 2026". */
  updated: string;
  summary?: ReactNode;
  sections: LegalSection[];
  breadcrumb: Crumb[];
}

/**
 * Shared scaffold for legal documents: a sticky table of contents plus numbered
 * sections rendered in a consistent reading column. Server-safe.
 */
export function LegalDoc({ title, updated, summary, sections, breadcrumb }: LegalDocProps) {
  return (
    <MarketingPage eyebrow="Legal" title={title} lead={summary} breadcrumb={breadcrumb}>
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        {/* Table of contents */}
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
            <ol className="mt-4 space-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex gap-2 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <span className="tabular-nums text-muted-foreground/50">{String(i + 1).padStart(2, '0')}</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* Document body */}
        <article className="min-w-0">
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Last updated: <span className="font-medium text-foreground">{updated}</span>
          </p>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-28 first:mt-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                <span className="mr-2 text-primary/60">{String(i + 1).padStart(2, '0')}.</span>
                {s.heading}
              </h2>
              <Prose className="mt-3">{s.body}</Prose>
            </section>
          ))}

          <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            Questions about this document? Contact{' '}
            <a href="mailto:legal@aipl.online" className="font-medium text-primary underline underline-offset-4">
              legal@aipl.online
            </a>
            .
          </p>
        </article>
      </div>
    </MarketingPage>
  );
}

export default LegalDoc;
