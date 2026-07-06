import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock, KeyRound, Server, Eye, RefreshCw, FileCheck, ShieldCheck, UserCheck } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, SectionHeading, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'Security',
  description:
    'How AIPL Hire protects your data: encryption in transit and at rest, role-based access control, continuous monitoring, secure infrastructure, and privacy by design.',
  path: '/security',
  keywords: ['AIPL Hire security', 'data protection', 'encryption', 'access control', 'enterprise security'],
});

const measures: Feature[] = [
  { icon: Lock, title: 'Encryption everywhere', desc: 'Data is encrypted in transit with TLS 1.2+ and encrypted at rest in our databases and object storage.' },
  { icon: KeyRound, title: 'Role-based access', desc: 'Granular, least-privilege permissions for recruiters, HR, admins, and candidates — with scoped API keys.' },
  { icon: Server, title: 'Secure infrastructure', desc: 'Hardened, regularly patched infrastructure with network isolation and secrets managed outside of code.' },
  { icon: Eye, title: 'Continuous monitoring', desc: 'Application and error monitoring with alerting so issues are caught and resolved quickly.' },
  { icon: RefreshCw, title: 'Backups & recovery', desc: 'Automated, regularly tested backups protect against data loss and enable rapid recovery.' },
  { icon: UserCheck, title: 'Privacy by design', desc: 'We collect only what we need, honor data subject rights, and support deletion on request.' },
];

const compliance = [
  { label: 'GDPR-ready', href: '/gdpr' },
  { label: 'DPA available', href: '/dpa' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'TLS / SSL', href: null },
  { label: 'Encryption at rest', href: null },
];

export default function SecurityPage() {
  return (
    <MarketingPage
      eyebrow="Trust & Security"
      title={<>Security you can <span className="text-gradient">build on</span></>}
      lead="Protecting candidate and company data is foundational to AIPL Hire. Here's how we keep your information safe at every layer."
      breadcrumb={[{ label: 'Security' }]}
      actions={
        <>
          <Link href="/contact"><Button size="lg">Request security details</Button></Link>
          <Link href="/dpa"><Button size="lg" variant="glass" magnetic={false}>View our DPA</Button></Link>
        </>
      }
    >
      <FeatureGrid items={measures} />

      <section className="mt-16">
        <GlassCard>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold">Compliance & standards</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">
            We align our practices with recognized data-protection standards and provide the documentation enterprise
            teams need for vendor review.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {compliance.map((c) =>
              c.href ? (
                <Link key={c.label} href={c.href} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition hover:text-foreground">
                  <FileCheck className="h-3.5 w-3.5 text-accent" /> {c.label}
                </Link>
              ) : (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                  <FileCheck className="h-3.5 w-3.5 text-accent" /> {c.label}
                </span>
              ),
            )}
          </div>
        </GlassCard>
      </section>

      <section className="mt-8">
        <GlassCard className="text-center sm:text-left">
          <h2 className="text-lg font-semibold">Report a vulnerability</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Found a security issue? We appreciate responsible disclosure. Email{' '}
            <a href="mailto:security@aipl.online" className="font-medium text-primary underline underline-offset-4">security@aipl.online</a>{' '}
            and we&apos;ll respond promptly.
          </p>
        </GlassCard>
      </section>

      <CTASection
        title={<>Hiring, <span className="text-gradient">secured</span></>}
        subtitle="Talk to us about your security and compliance requirements."
        primary={{ label: 'Contact us', href: '/contact' }}
        secondary={{ label: 'Read the Privacy Policy', href: '/privacy-policy' }}
      />
    </MarketingPage>
  );
}
