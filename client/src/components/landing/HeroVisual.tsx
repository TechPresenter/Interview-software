'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Bot, ShieldCheck, Sparkles, FileCheck2 } from 'lucide-react';

const comps = [
  { label: 'Technical', v: 88 },
  { label: 'Communication', v: 82 },
  { label: 'Problem solving', v: 91 },
];

// Static heights for the voice waveform bars (0–1).
const BARS = [0.45, 0.9, 0.4, 1, 0.6, 0.85, 0.5, 0.75, 0.45, 0.8, 0.55, 0.7, 0.5, 0.9];

/**
 * Animated, AI-themed hero centerpiece: a live-interview panel with a pulsing
 * AI orb, an animated voice waveform, and competency scores filling in — framed
 * by floating accent cards. Respects prefers-reduced-motion.
 */
export function HeroVisual() {
  const rm = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto mt-16 w-full max-w-3xl pb-16"
    >
      <div className="glass gradient-border rounded-3xl p-6 md:p-8">
        {/* Window header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 truncate">Live AI interview · Senior Frontend Engineer</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-400/15 px-2 py-0.5 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Integrity 98
          </span>
        </div>

        <div className="mt-6 grid items-center gap-6 md:grid-cols-2">
          {/* AI orb + waveform */}
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-muted/20 p-6">
            <div className="relative grid h-24 w-24 place-items-center">
              {!rm &&
                [0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute inset-0 rounded-full border border-primary/40"
                    animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: 'easeOut' }}
                  />
                ))}
              <div className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
                <Bot className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Voice waveform */}
            <div className="flex h-10 items-center gap-1" aria-hidden>
              {BARS.map((h, i) => (
                <motion.span
                  key={i}
                  className="w-1 origin-bottom rounded-full bg-[linear-gradient(180deg,hsl(var(--primary)),hsl(var(--accent)))]"
                  style={{ height: `${h * 100}%` }}
                  animate={rm ? undefined : { scaleY: [1, 0.4, 1] }}
                  transition={rm ? undefined : { duration: 1.1, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 text-accent">●</span> Analyzing response…
            </p>
          </div>

          {/* Live scoring */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live competency scoring</p>
            <div className="mt-4 space-y-3.5">
              {comps.map((c, i) => (
                <div key={c.label}>
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="text-muted-foreground">{c.v}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${c.v}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.4 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-emerald-400/10 px-3 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-emerald-400" /> Recommendation:{' '}
              <strong className="text-emerald-400">Strong Hire</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent cards */}
      <div className="absolute -left-5 top-16 hidden animate-float lg:block" style={{ animationDelay: '0.4s' }}>
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm shadow-lg">
          <FileCheck2 className="h-4 w-4 text-accent" /> Resume match <strong className="text-gradient">94%</strong>
        </div>
      </div>
      <div className="absolute -right-4 bottom-6 hidden animate-float lg:block" style={{ animationDelay: '1.3s' }}>
        <div className="glass rounded-2xl px-4 py-3 text-sm shadow-lg">
          <p className="text-xs text-muted-foreground">Bias-aware</p>
          <p className="font-semibold text-gradient">Fair scoring</p>
        </div>
      </div>
    </motion.div>
  );
}

export default HeroVisual;
