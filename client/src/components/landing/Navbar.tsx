'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useBranding } from '@/store/branding.store';
import { cn } from '@/lib/utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Blog', href: '/blog' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const branding = useBranding((s) => s.branding);
  const name = branding?.platformName || 'HireSense';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          'flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300',
          scrolled ? 'glass shadow-lg' : 'border border-transparent',
        )}
      >
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
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
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm" magnetic={false}>Sign in</Button>
          </Link>
          <Link href="/register" className="hidden sm:block">
            <Button size="sm">Get started</Button>
          </Link>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-border md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
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
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2">
                <Link href="/login" className="flex-1"><Button variant="outline" className="w-full" magnetic={false}>Sign in</Button></Link>
                <Link href="/register" className="flex-1"><Button className="w-full" magnetic={false}>Get started</Button></Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default Navbar;
