'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Bot, BarChart3, Check } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AuthCredit } from '@/components/auth/AuthCredit';
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
 * Premium split-screen auth chrome shared by login / register / forgot-password.
 * Left = branded showcase (hidden on mobile); right = the form card (children).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const branding = useBranding((s) => s.branding);
  const name = branding?.platformName || SITE.name;

  const Brand = ({ className = '' }: { className?: string }) => (
    <Link href="/" className={`flex items-center gap-2 text-xl font-bold ${className}`} aria-label={`${name} home`}>
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
    <main className="relative min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: branded showcase ── */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-80" />
        <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-60" />
        <div className="pointer-events-none absolute -left-24 top-1/4 -z-10 h-96 w-96 rounded-full bg-primary/25 blur-[130px] animate-pulse-glow" />
        <div className="pointer-events-none absolute -right-16 bottom-10 -z-10 h-80 w-80 rounded-full bg-accent/20 blur-[120px] animate-float-slow" />
        <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

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
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg glass">
                  <h.icon className="h-4 w-4 text-primary" />
                </span>
                <span className="text-sm text-muted-foreground">{h.text}</span>
              </li>
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
                      transition={{ duration: 1, delay: 0.4 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
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

      {/* ── Right: form column ── */}
      <div className="relative grid min-h-screen place-items-center overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-40 lg:hidden" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 aurora opacity-40 lg:hidden" />
        <div className="absolute right-6 top-6"><ThemeToggle /></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <Brand className="mb-8 justify-center lg:hidden" />
          {children}
          <AuthCredit />
        </motion.div>
      </div>
    </main>
  );
}

export default AuthShell;
