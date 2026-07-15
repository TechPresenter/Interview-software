'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bot, BarChart3, ShieldCheck, FileSearch, Video, Sparkles, ArrowRight, Check,
  Workflow, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BookDemoButton } from '@/components/landing/BookDemoButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { AiDemo, Eyebrow } from '@/components/landing/AiDemo';
import { Testimonials } from '@/components/landing/Testimonials';
import { Faq } from '@/components/landing/Faq';
import { HeroVisual } from '@/components/landing/HeroVisual';
import { contentApi } from '@/lib/content.api';
import { money } from '@/lib/format';
import type { PublicPlan } from '@/components/public/PlanLimitsTable';
import { Reveal, Parallax } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

const features = [
  { icon: Bot, title: 'Adaptive AI Interviewer', desc: 'AI-powered interviews that ask, follow up, and adapt difficulty in real time.' },
  { icon: BarChart3, title: 'Competency Scoring', desc: 'Objective scores across 7 competencies with transparent, evidence-based reasoning.' },
  { icon: FileSearch, title: 'Resume Intelligence', desc: 'ATS score, skill extraction, gap analysis, and job-match % in seconds.' },
  { icon: ShieldCheck, title: 'Proctoring & Anti-Cheat', desc: 'Tab, blur, paste, and face detection with a live integrity score.' },
  { icon: Video, title: 'Live Interview Room', desc: 'AI avatar, voice & text questions, recording, transcript, and autosave.' },
  { icon: Sparkles, title: 'Instant Reports', desc: 'Strengths, gaps, and a hire recommendation the moment the interview ends.' },
];

const steps = [
  { icon: FileSearch, title: 'Create a job & add candidates', desc: 'Define the role, import candidates by CSV, and let AI analyze resumes against requirements.' },
  { icon: Video, title: 'Candidates interview with AI', desc: 'A private link launches an adaptive, proctored AI interview — voice or text, anytime.' },
  { icon: BarChart3, title: 'Get scored reports instantly', desc: 'Competency scores, strengths, gaps, and a hire recommendation — ranked automatically.' },
  { icon: Workflow, title: 'Move winners down the pipeline', desc: 'Drag candidates through stages and export PDF/Excel reports for stakeholders.' },
];

const stats = [
  { value: 92, suffix: '%', label: 'Faster screening' },
  { value: 4, suffix: '×', label: 'More candidates' },
  { value: 120000, label: 'Interviews run', compact: true },
  { value: 98, suffix: '%', label: 'Recruiter satisfaction' },
];


export default function LandingPage() {
  const [yearly, setYearly] = useState(false);
  // Served from the same endpoint as /pricing. This section used to hardcode its
  // own copy of the tiers, which drifted: it invented feature gates the product
  // does not enforce and priced in rupees against the API's paise.
  const { data, isLoading } = useQuery({ queryKey: ['public-plans'], queryFn: contentApi.plans });
  const plans: PublicPlan[] = Array.isArray(data) ? data : data?.plans ?? [];

  return (
    <main className="relative overflow-x-clip">
      <SiteHeader />

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-32 text-center">
        {/* Parallax ambient backdrop */}
        <Parallax offset={80} className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 mesh-bg opacity-70" />
          <div className="absolute left-1/2 top-[-8%] h-[620px] w-[1100px] -translate-x-1/2 aurora opacity-80" />
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
          <div className="absolute right-[8%] top-[30%] h-72 w-72 rounded-full bg-accent/25 blur-[120px] animate-pulse-glow" />
          <div className="absolute left-[6%] top-[52%] h-64 w-64 rounded-full bg-[hsl(var(--sunset))]/20 blur-[120px] animate-float-slow" />
        </Parallax>
        <div className="pointer-events-none absolute inset-0 -z-10 grid-bg" />

        <div className="mx-auto w-full max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="group mx-auto mb-7 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-conic-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              <Zap className="h-3 w-3" /> New
            </span>
            Powered by advanced AI — adaptive, fair &amp; explainable
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-balance text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]"
          >
            Hire the right people<br />
            <span className="text-gradient-animate">10× faster</span> with AI interviews
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground"
          >
            Screen resumes, run adaptive AI interviews, score candidates objectively, and get a
            hire-ready report — all in one beautifully crafted platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/register"><Button size="lg" data-cta="start_free_trial">Start hiring free <ArrowRight className="h-5 w-5" /></Button></Link>
            <BookDemoButton />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
            className="mt-8 text-xs text-muted-foreground"
          >
            No credit card required · Free forever plan
          </motion.p>
        </div>

        {/* AI-themed hero visual */}
        <HeroVisual />
      </section>

      {/* ── AI demo ────────────────────────────────────── */}
      <AiDemo />

      {/* ── Features ───────────────────────────────────── */}
      <section id="features" className="container relative py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Platform</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Everything you need to hire <span className="text-gradient-3">with AI</span></h2>
          <p className="mt-4 text-muted-foreground">From first resume to final offer — one premium platform for recruiters, HR, and candidates.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <GlassCard key={f.title} tilt delay={i * 0.05} className="group">
              <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <f.icon className="h-6 w-6 text-white" />
              </span>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────── */}
      <section id="how" className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Live in minutes, not months</h2>
        </Reveal>
        <div className="relative mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent lg:block" />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="group relative text-center"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl glass transition-transform duration-300 group-hover:-translate-y-1">
                <s.icon className="h-6 w-6 text-primary" />
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-conic-brand text-xs font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────── */}
      <section className="container py-12">
        <GlassCard className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold text-gradient md:text-5xl"><AnimatedCounter value={s.value} suffix={s.suffix} compact={s.compact} /></p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </GlassCard>
      </section>

      {/* ── Testimonials ───────────────────────────────── */}
      <Testimonials />

      {/* ── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Simple, scalable pricing</h2>
          <div className="mx-auto mt-8 inline-flex rounded-xl border border-border p-1">
            {([['Monthly', false], ['Yearly', true]] as const).map(([label, val]) => (
              <button key={label} onClick={() => setYearly(val)} className={cn('rounded-lg px-5 py-2 text-sm font-medium transition', yearly === val ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.6)]' : 'text-muted-foreground hover:text-foreground')}>
                {label}{val && <span className="ml-1 text-xs text-accent">−17%</span>}
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal className="mx-auto mt-6 max-w-2xl text-center">
          <p className="text-muted-foreground">
            Every plan includes every feature. You only choose how much you need.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-96 rounded-2xl" />)}
          {plans.map((p, i) => {
            const price = yearly ? p.pricing.yearly : p.pricing.monthly;
            // Free and Enterprise both price at 0; only the key tells them apart.
            const isFree = p.key === 'free';
            return (
              <GlassCard key={p._id} delay={i * 0.05} className={cn('flex flex-col', p.isPopular && 'gradient-border-spin ring-1 ring-primary/40 lg:-mt-3 lg:mb-3')}>
                {p.isPopular && <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-3 py-0.5 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" /> Most popular</span>}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-3 text-4xl font-bold text-gradient">
                  {isFree ? 'Free' : price ? money(price, p.pricing.currency) : 'Custom'}
                  {!isFree && price ? <span className="text-base text-muted-foreground">/{yearly ? 'yr' : 'mo'}</span> : null}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                  {(p.features ?? []).map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {f}</li>)}
                </ul>
                <Link href="/register" className="mt-6 block pt-2">
                  <Button className="w-full" variant={p.isPopular ? 'primary' : 'glass'} magnetic={false} data-cta={!isFree && !price ? 'contact_sales' : 'subscribe'} data-plan={p.name}>{!isFree && !price ? 'Contact sales' : 'Get started'}</Button>
                </Link>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────── */}
      <Faq />

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="container py-24">
        <Reveal>
          <div className="gradient-border relative overflow-hidden rounded-3xl border border-border p-12 text-center md:p-20">
            <div className="absolute inset-0 -z-10 mesh-bg opacity-80" />
            <div className="pointer-events-none absolute left-1/2 top-[-30%] -z-10 h-[420px] w-[820px] -translate-x-1/2 aurora opacity-70" />
            <div className="absolute inset-0 -z-10 bg-background/40" />
            <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">Ready to <span className="text-gradient-animate">transform</span> your hiring?</h2>
            <p className="mx-auto mt-5 max-w-lg text-muted-foreground">Join modern teams interviewing smarter with AI. Free to start.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register"><Button size="lg" data-cta="get_started">Get started for free <ArrowRight className="h-5 w-5" /></Button></Link>
              <Link href="/pricing"><Button size="lg" variant="glass" magnetic={false} data-cta="view_pricing">View pricing</Button></Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" /> Setup in minutes</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> Enterprise-grade security</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" /> Cancel anytime</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <SiteFooter />
    </main>
  );
}
