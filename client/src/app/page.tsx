'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot, BarChart3, ShieldCheck, FileSearch, Video, Sparkles, ArrowRight, Check,
  Workflow, Twitter, Linkedin, Github, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { Navbar } from '@/components/landing/Navbar';
import { AiDemo, Eyebrow } from '@/components/landing/AiDemo';
import { Testimonials } from '@/components/landing/Testimonials';
import { Faq } from '@/components/landing/Faq';
import { CreditFooter } from '@/components/ui/CreditFooter';
import { cn } from '@/lib/utils';

const features = [
  { icon: Bot, title: 'Adaptive AI Interviewer', desc: 'Claude-powered interviews that ask, follow up, and adapt difficulty in real time.' },
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

const plans = [
  { name: 'Free Trial', monthly: 0, yearly: 0, features: ['3 AI Interviews (one-time)', '1 Active Job', 'Resume Upload', 'Basic Dashboard', 'Email Support', 'Valid 7 Days'], popular: false },
  { name: 'Starter', monthly: 9999, yearly: 99990, features: ['100 AI Interviews / mo', '10 Active Jobs', 'Resume Analysis & Scoring', 'AI Candidate Ranking', 'Interview Reports', '5 Team Members'], popular: false },
  { name: 'Professional', monthly: 24999, yearly: 249990, features: ['2,500 AI Interviews / mo', 'Unlimited Active Jobs', 'Anti-Cheat Monitoring', 'Video Recording', 'Custom Templates', 'Analytics Dashboard', 'Priority Support', '25 Team Members'], popular: true },
  { name: 'Enterprise', monthly: null, yearly: null, features: ['Unlimited AI Interviews', 'Unlimited Jobs', 'Custom AI Weightage', 'SSO & Security', 'API Access', 'ATS/HRMS Integrations', 'White Label', 'Dedicated Manager'], popular: false },
];

export default function LandingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <main className="relative overflow-x-clip">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative grid min-h-screen place-items-center overflow-hidden px-6 pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-70" />
        <div className="pointer-events-none absolute inset-0 -z-10 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
        <div className="pointer-events-none absolute right-[8%] top-[30%] -z-10 h-72 w-72 rounded-full bg-accent/20 blur-[120px]" />

        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Powered by Claude — adaptive, fair, explainable
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-balance text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]"
          >
            Hire the right people<br />
            <span className="text-gradient">10× faster</span> with AI interviews
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
            <Link href="/register"><Button size="lg">Start hiring free <ArrowRight className="h-5 w-5" /></Button></Link>
            <Link href="/login"><Button size="lg" variant="glass" magnetic={false}>Book a demo</Button></Link>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-5 text-xs text-muted-foreground">
            No credit card required · Free forever plan
          </motion.p>
        </div>

        {/* Floating hero preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformPerspective: 1200 }}
          className="relative mx-auto mt-16 w-full max-w-4xl pb-24"
        >
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-3 w-3 rounded-full bg-destructive/70" />
              <span className="h-3 w-3 rounded-full bg-amber-400/70" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
              <span className="ml-2">Live interview · Senior Frontend Engineer</span>
              <span className="ml-auto rounded-md bg-emerald-400/15 px-2 py-0.5 text-emerald-400">Integrity 98</span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {['Technical', 'Communication', 'Problem Solving'].map((c, i) => (
                <div key={c} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">{c}</p>
                  <p className="mt-1 text-3xl font-bold text-gradient"><AnimatedCounter value={[88, 82, 91][i]} /></p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]" initial={{ width: 0 }} whileInView={{ width: `${[88, 82, 91][i]}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.2 + i * 0.1 }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* floating mini cards */}
          <motion.div className="absolute -left-6 top-10 hidden animate-float lg:block" style={{ animationDelay: '0.5s' }}>
            <GlassCard className="w-44 p-4">
              <p className="text-xs text-muted-foreground">Recommendation</p>
              <p className="mt-1 font-bold text-emerald-400">Strong Hire</p>
            </GlassCard>
          </motion.div>
          <motion.div className="absolute -right-4 top-24 hidden animate-float lg:block" style={{ animationDelay: '1.2s' }}>
            <GlassCard className="w-48 p-4">
              <p className="text-xs text-muted-foreground">Job match</p>
              <p className="mt-1 text-2xl font-bold text-gradient">94%</p>
            </GlassCard>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Trust row ──────────────────────────────────── */}
      <section className="container -mt-10 pb-16">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">Trusted by modern hiring teams</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-60">
          {['Nimbus', 'Cobalt', 'Vertex', 'Lumen', 'Drift', 'Apex'].map((b) => (
            <span key={b} className="font-display text-xl font-bold tracking-tight">{b}</span>
          ))}
        </div>
      </section>

      {/* ── AI demo ────────────────────────────────────── */}
      <AiDemo />

      {/* ── Features ───────────────────────────────────── */}
      <section id="features" className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Platform</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Everything you need to hire with AI</h2>
          <p className="mt-4 text-muted-foreground">From first resume to final offer — one premium platform for recruiters, HR, and candidates.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <GlassCard key={f.title} tilt delay={i * 0.05} className="group">
              <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow transition-transform duration-300 group-hover:scale-110">
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
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Live in minutes, not months</h2>
        </div>
        <div className="relative mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative text-center"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl glass">
                <s.icon className="h-6 w-6 text-primary" />
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-xs font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Dashboard preview ──────────────────────────── */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Built for teams</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">A dashboard your team will love</h2>
        </div>
        <GlassCard className="mx-auto mt-14 max-w-5xl p-3">
          <div className="rounded-xl border border-border bg-muted/20 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              {[{ l: 'Active Jobs', v: 14 }, { l: 'Candidates', v: 612 }, { l: 'Interviews', v: 37 }, { l: 'Hire Rate', v: 24, s: '%' }].map((k) => (
                <div key={k.l} className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="mt-1 text-2xl font-bold"><AnimatedCounter value={k.v} suffix={k.s} /></p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-40 items-end gap-2 rounded-xl border border-border bg-card/60 p-4">
              {[40, 65, 50, 80, 60, 92, 70, 85, 55, 78, 95, 68].map((h, i) => (
                <motion.div key={i} className="flex-1 rounded-t-md bg-[linear-gradient(180deg,hsl(var(--primary)),hsl(var(--accent)/0.4))]" initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.04 }} />
              ))}
            </div>
          </div>
        </GlassCard>
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
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Simple, scalable pricing</h2>
          <div className="mx-auto mt-8 inline-flex rounded-xl border border-border p-1">
            {([['Monthly', false], ['Yearly', true]] as const).map(([label, val]) => (
              <button key={label} onClick={() => setYearly(val)} className={cn('rounded-lg px-5 py-2 text-sm font-medium transition', yearly === val ? 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white' : 'text-muted-foreground')}>
                {label}{val && <span className="ml-1 text-xs text-accent">−17%</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p, i) => {
            const price = yearly ? p.yearly : p.monthly;
            return (
              <GlassCard key={p.name} delay={i * 0.05} className={cn(p.popular && 'gradient-border ring-1 ring-primary/40')}>
                {p.popular && <span className="mb-3 inline-block rounded-full bg-primary/15 px-3 py-0.5 text-xs font-medium text-primary">Most popular</span>}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-3 text-4xl font-bold text-gradient">
                  {price === null ? 'Custom' : price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`}
                  {price ? <span className="text-base text-muted-foreground">/{yearly ? 'yr' : 'mo'}</span> : null}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                  {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {f}</li>)}
                </ul>
                <Link href="/register" className="mt-6 block">
                  <Button className="w-full" variant={p.popular ? 'primary' : 'glass'} magnetic={false}>{price === null ? 'Contact sales' : 'Get started'}</Button>
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
        <div className="relative overflow-hidden rounded-3xl border border-border p-12 text-center md:p-20">
          <div className="absolute inset-0 -z-10 mesh-bg opacity-80" />
          <div className="absolute inset-0 -z-10 bg-background/40" />
          <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">Ready to <span className="text-gradient">transform</span> your hiring?</h2>
          <p className="mx-auto mt-5 max-w-lg text-muted-foreground">Join modern teams interviewing smarter with AI. Free to start.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register"><Button size="lg">Get started for free <ArrowRight className="h-5 w-5" /></Button></Link>
            <Link href="/pricing"><Button size="lg" variant="glass" magnetic={false}>View pricing</Button></Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <Footer />
    </main>
  );
}

function Footer() {
  const cols = [
    { title: 'Product', links: [['Features', '#features'], ['Pricing', '#pricing'], ['AI Interview', '#'], ['Reports', '#']] },
    { title: 'Company', links: [['Blog', '/blog'], ['About', '#'], ['Careers', '#'], ['Contact', '#']] },
    { title: 'Resources', links: [['Docs', '#'], ['Guides', '#'], ['Support', '#'], ['Status', '#']] },
    { title: 'Legal', links: [['Privacy', '#'], ['Terms', '#'], ['Security', '#'], ['DPA', '#']] },
  ];
  return (
    <footer className="border-t border-border">
      <div className="container py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow"><Sparkles className="h-4 w-4 text-white" /></span>
              <span className="text-gradient">HireSense</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">AI-powered hiring, end to end. Screen, interview, score, and report — faster and fairer.</p>
            <div className="mt-5 flex gap-2">
              {[Twitter, Linkedin, Github].map((Icon, i) => (
                <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"><Icon className="h-4 w-4" /></a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold">{c.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {c.links.map(([l, h]) => <li key={l}><Link href={h} className="transition hover:text-foreground">{l}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} AIPL Hire. All rights reserved.</p>
            <CreditFooter />
          </div>
          <div className="flex w-full max-w-sm gap-2">
            <input placeholder="Your email" className="h-10 flex-1 rounded-xl border border-input bg-card/60 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
            <Button size="sm" magnetic={false}>Subscribe <ArrowUpRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
