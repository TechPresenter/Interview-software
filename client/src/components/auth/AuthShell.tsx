'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Bot, BarChart3, Check } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useBranding } from '@/store/branding.store';
import { SITE } from '@/lib/site';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

const HIGHLIGHTS = [
  { icon: Bot, text: 'Adaptive AI interviews that ask, follow up & adapt in real time' },
  { icon: BarChart3, text: 'Objective competency scoring with transparent reasoning' },
  { icon: ShieldCheck, text: 'Proctoring & anti-cheat with a live integrity score' },
];

const BARS = [
  { label: 'Technical', v: 92 },
  { label: 'Communication', v: 86 },
  { label: 'Problem solving', v: 90 },
];

/**
 * Premium, fully-responsive split-screen chrome shared by login / register /
 * forgot-password.
 *
 * Layout rules that keep it bulletproof across devices:
 *  - Mobile / tablet (<lg): single centered column. The form column uses
 *    `flex … justify-center` with vertical padding so it *centers when short*
 *    but *grows & lets the page scroll when tall* (register form on a small
 *    phone). Decorative blobs live in their own `overflow-hidden` layer so they
 *    never clip the form or cause horizontal scroll.
 *  - Desktop (lg+): 2-column grid — branded showcase on the left, form on the
 *    right.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const branding = useBranding((s) => s.branding);
  const name = branding?.platformName || SITE.name;

  const Brand = ({ className = '' }: { className?: string }) => (
    <Link href="/" className={`inline-flex items-center gap-2 text-xl font-bold ${className}`} aria-label={`${name} home`}>
      {branding?.logoUrl ? (
        <img src={`${API_ORIGIN}${branding.logoUrl}`} alt={name} className="h-9 w-9 rounded-xl object-contain" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
          <Sparkles className="h-5 w-5 text-white" />
        </span>
      )}
      <span className="text-gradient">{name}</span>
    </Link>
  );

  return (
    <main className="relative min-h-screen w-full overflow-x-clip lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: branded showcase (desktop only) ── */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 mesh-bg opacity-80" />
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-primary/25 blur-[130px] animate-pulse-glow" />
          <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-accent/20 blur-[120px] animate-float-slow" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        </div>

        <Brand />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md"
        >
          <h2 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
            Hire the right people, <span className="text-gradient-3">10× faster</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg glass">
                  <h.icon className="h-4 w-4 text-primary" />
                </span>
                <span className="text-sm text-muted-foreground">{h.text}</span>
              </motion.li>
            ))}
          </ul>

          {/* Mini live-scoring motif */}
          <div className="mt-10 max-w-xs rounded-2xl glass gradient-border p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live competency scoring</p>
            <div className="mt-3 space-y-3">
              {BARS.map((b, i) => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs">
                    <span>{b.label}</span>
                    <span className="text-muted-foreground">{b.v}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]"
                      initial={{ width: 0 }}
                      animate={{ width: `${b.v}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Recommendation: <strong>Strong Hire</strong>
            </p>
          </div>
        </motion.div>

        <p className="text-xs text-muted-foreground">
          Trusted by modern hiring teams · Bias-aware &amp; explainable AI
        </p>
      </aside>

      {/* ── Right: form column (scroll-safe centering) ── */}
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-12 sm:px-6">
        {/* Decorative backdrop — isolated & clipped so it never affects the form or causes scroll */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 mesh-bg opacity-40 lg:opacity-0" />
          <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] max-w-[130vw] -translate-x-1/2 -translate-y-1/2 aurora opacity-40 lg:opacity-25" />
        </div>

        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <Brand className="mb-8 flex w-full justify-center lg:hidden" />
          {children}
        </motion.div>
      </div>
    </main>
  );
}

export default AuthShell;
