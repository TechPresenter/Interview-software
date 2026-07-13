import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, Award, GraduationCap, Bot, Building2, Landmark, FileCheck, Hash } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/utils';

/** Hero trust badges — the headline legitimacy signals. */
export const TRUST_BADGES: { icon: LucideIcon; label: string }[] = [
  { icon: BadgeCheck, label: 'MCA Registered' },
  { icon: Award, label: 'ISO 9001:2015 Certified' },
  { icon: GraduationCap, label: 'NSDC Partner' },
  { icon: Bot, label: 'AI Recruitment Platform' },
];

export function TrustBadges({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2.5', className)}>
      {TRUST_BADGES.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur"
        >
          <b.icon className="h-3.5 w-3.5 text-accent" /> {b.label}
        </span>
      ))}
    </div>
  );
}

/** Detailed statutory identity — the legal facts, verbatim, for compliance. */
export function CompanyIdentityCard({ className }: { className?: string }) {
  const rows: { k: string; v: string }[] = [
    { k: 'Company Name', v: COMPANY.legalName },
    { k: 'CIN', v: COMPANY.cin },
    { k: 'Registration No.', v: COMPANY.regNo },
    { k: 'Status', v: COMPANY.mca },
    { k: 'ISO Certification', v: `${COMPANY.iso} — ${COMPANY.isoDesc}` },
    { k: 'IAF Code', v: COMPANY.iafCode },
    { k: 'NACE Code', v: COMPANY.naceCode },
    { k: 'Certificate No.', v: COMPANY.certNo },
    { k: 'Recognition', v: COMPANY.nsdc },
    { k: 'Powered by', v: COMPANY.poweredBy },
  ];
  return (
    <GlassCard className={cn('gradient-border', className)}>
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Company Information</h3>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{COMPANY.ownership}</p>
      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.k} className="flex flex-col border-b border-border/60 pb-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{r.k}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-muted-foreground">
        Designed &amp; developed by{' '}
        <a href={COMPANY.developerUrl} target="_blank" rel="noreferrer noopener" className="font-medium text-foreground/80 hover:text-primary">
          {COMPANY.developer}
        </a>
        .
      </p>
    </GlassCard>
  );
}

/** Certification / compliance cards. */
export const CERTIFICATIONS: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: Landmark, title: 'MCA Registered Company', sub: `CIN ${COMPANY.cin}` },
  { icon: Award, title: COMPANY.iso, sub: COMPANY.isoDesc },
  { icon: Hash, title: `IAF Code ${COMPANY.iafCode}`, sub: 'International Accreditation Forum' },
  { icon: Hash, title: `NACE Code ${COMPANY.naceCode}`, sub: 'Statistical industry classification' },
  { icon: FileCheck, title: `Certificate No. ${COMPANY.certNo}`, sub: 'Verified quality certification' },
  { icon: GraduationCap, title: COMPANY.nsdc, sub: 'National Skill Development Corporation' },
];

export function ComplianceCards({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {CERTIFICATIONS.map((c) => (
        <GlassCard key={c.title} interactive className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
            <c.icon className="h-6 w-6 text-white" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
