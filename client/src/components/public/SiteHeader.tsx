'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useBranding } from '@/store/branding.store';
import { HEADER_NAV, APPLY_LINK, SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

/** Is `href` the active route for the current pathname? */
function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared marketing header used on the landing page and every public page.
 * Floating/glass-on-scroll, active-link highlighting, and a mobile menu.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  const branding = useBranding((s) => s.branding);
  const name = branding?.platformName || SITE.name;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        aria-label="Primary"
        className={cn(
          'flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300',
          scrolled ? 'glass shadow-lg' : 'border border-transparent',
        )}
      >
        <Link href="/" className="flex items-center gap-2 text-base font-bold" aria-label={`${name} home`}>
          {branding?.logoUrl ? (
            <img src={`${API_ORIGIN}${branding.logoUrl}`} alt={name} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
          )}
          <span className="text-gradient">{name}</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {HEADER_NAV.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {l.label}
                {active && (
                  <motion.span layoutId="nav-underline" className="mx-3 block h-0.5 rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* The candidate's entry point, and the only CTA here not aimed at an
              employer. `outline` on purpose: it must be findable without
              outranking "Get started", which is what the marketing site is for. */}
          <Link href={APPLY_LINK.href} className="hidden sm:block">
            <Button variant="outline" size="sm" magnetic={false} data-cta="apply">{APPLY_LINK.label}</Button>
          </Link>
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm" magnetic={false} data-cta="login">Sign in</Button>
          </Link>
          <Link href="/register" className="hidden sm:block">
            <Button size="sm" data-cta="get_started">Get started</Button>
          </Link>
          <button
            className="grid h-9 w-9 place-items-center rounded-xl border border-border md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass absolute top-20 mx-4 w-[calc(100%-2rem)] max-w-6xl rounded-2xl p-4 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {HEADER_NAV.map((l) => {
                const active = isActive(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-sm transition-colors',
                      active ? 'bg-muted/60 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
              {/* Full width and on its own row rather than crammed in beside the
                  two employer CTAs below: a third button in that row leaves all
                  three too narrow to read on a small phone, which is the device
                  most candidates apply from. */}
              <Link href={APPLY_LINK.href} className="mt-2 block">
                <Button variant="outline" className="w-full" magnetic={false} data-cta="apply">{APPLY_LINK.label}</Button>
              </Link>
              <div className="mt-2 flex gap-2">
                <Link href="/login" className="flex-1"><Button variant="outline" className="w-full" magnetic={false} data-cta="login">Sign in</Button></Link>
                <Link href="/register" className="flex-1"><Button className="w-full" magnetic={false} data-cta="get_started">Get started</Button></Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default SiteHeader;
