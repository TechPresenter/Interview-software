'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

const script = [
  { role: 'ai', text: 'Welcome! Let’s start — tell me about a system you scaled recently.' },
  { role: 'user', text: 'We moved our monolith to event-driven services and cut latency by 60%.' },
  { role: 'ai', text: 'Nice. How did you handle data consistency across services?' },
  { role: 'user', text: 'Outbox pattern with idempotent consumers and a saga for orchestration.' },
];

const scores = [
  { label: 'Technical', value: 92 },
  { label: 'Communication', value: 86 },
  { label: 'Problem Solving', value: 90 },
];

export function AiDemo() {
  const [step, setStep] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s >= script.length ? 1 : s + 1)), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="container py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Live AI interview</Eyebrow>
        <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">See the AI interviewer in action</h2>
        <p className="mt-4 text-muted-foreground">Adaptive questions, real-time transcription, and instant competency scoring.</p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-5">
        {/* Conversation */}
        <GlassCard className="lg:col-span-3">
          <div className="mb-5 flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))]">
              <Bot className="h-5 w-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-card" />
            </span>
            <div>
              <p className="text-sm font-semibold">Sense AI</p>
              <p className="text-xs text-muted-foreground">Senior Backend Engineer · live</p>
            </div>
            {/* waveform */}
            <div className="ml-auto flex h-8 items-end gap-[3px]">
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-primary to-accent"
                  animate={{ height: [6, 22, 10, 26, 8][i % 5] }}
                  transition={{ duration: 0.7, repeat: Infinity, repeatType: 'mirror', delay: i * 0.06 }}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[220px] space-y-3">
            <AnimatePresence initial={false}>
              {script.slice(0, step).map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${m.role === 'ai' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {m.role === 'ai' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </span>
                  <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'ai' ? 'bg-primary/10' : 'bg-muted/60'}`}>{m.text}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </GlassCard>

        {/* Live scoring */}
        <GlassCard className="lg:col-span-2">
          <p className="text-sm font-semibold">Real-time evaluation</p>
          <p className="mt-1 text-xs text-muted-foreground">Scored as the candidate speaks</p>
          <div className="mt-6 space-y-5">
            {scores.map((s, i) => (
              <div key={s.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-7 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Recommendation</p>
            <p className="mt-1 text-lg font-bold text-emerald-400">Strong Hire · 89/100</p>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

export default AiDemo;
