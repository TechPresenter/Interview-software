import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { SITE } from '@/lib/site';

export type Crumb = { label: string; href?: string };

/**
 * Accessible breadcrumb trail with matching BreadcrumbList JSON-LD for SEO.
 * Server-safe (no hooks) so it can render inside server pages. The final crumb
 * is treated as the current page and is not linked.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, ...items];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE.url}${c.href === '/' ? '' : c.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />}
              {last || !c.href ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {i === 0 && <Home className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />}
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="inline-flex items-center transition-colors hover:text-foreground"
                >
                  {i === 0 && <Home className="mr-1 h-3.5 w-3.5" aria-hidden />}
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}

export default Breadcrumbs;
