'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track, trackCta } from '@/lib/track';

/**
 * Zero-config event auto-instrumentation, mounted app-wide:
 *  - CTA clicks: any element with a `data-cta="name"` attribute is tracked.
 *  - Outbound links: clicks on <a> to a different origin.
 *  - Scroll depth: 25/50/75/100% milestones on public pages (once per route).
 *
 * Ad-hoc events elsewhere use `track()` / `trackFeature()` from lib/track.
 */
export function EventTracker() {
  const pathname = usePathname();

  // CTA + outbound click delegation (capture phase so it runs before nav).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || typeof el.closest !== 'function') return;

      const cta = el.closest<HTMLElement>('[data-cta]');
      if (cta) {
        trackCta(cta.dataset.cta || 'cta', {
          label: (cta.textContent || '').trim().slice(0, 60),
          href: cta.getAttribute('href') || undefined,
        });
        return;
      }

      const link = el.closest<HTMLAnchorElement>('a[href]');
      if (link) {
        try {
          const url = new URL(link.href, window.location.origin);
          if (url.origin !== window.location.origin) {
            track('outbound_link', { href: url.href.slice(0, 300), host: url.hostname }, 'outbound');
          }
        } catch {
          /* ignore unparseable hrefs */
        }
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Scroll-depth milestones — public/marketing pages only (dashboards are noisy).
  useEffect(() => {
    if (!pathname || pathname.startsWith('/dashboard') || pathname.startsWith('/interview')) return;
    const seen = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable < 200) return;
      const pct = Math.round(((doc.scrollTop || document.body.scrollTop) / scrollable) * 100);
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !seen.has(m)) {
          seen.add(m);
          track('scroll_depth', { depth: m, path: pathname }, 'scroll');
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return null;
}

export default EventTracker;
