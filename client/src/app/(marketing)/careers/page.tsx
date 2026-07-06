import type { Metadata } from 'next';
import Link from 'next/link';
import { Rocket, Globe2, GraduationCap, HeartPulse, Coins, Sparkles } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { FeatureGrid, SectionHeading, type Feature } from '@/components/public/blocks';
import { CTASection } from '@/components/public/CTASection';
import { CareersApply } from '@/components/public/CareersApply';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'Careers',
  description:
    'Join AIPL Hire and help build the future of fair, AI-powered hiring. Explore open roles across engineering, product, design, and go-to-market.',
  path: '/careers',
  keywords: ['AIPL Hire careers', 'jobs', 'hiring', 'remote jobs', 'AI startup careers'],
});

const perks: Feature[] = [
  { icon: Globe2, title: 'Remote-first', desc: 'Work from anywhere. We optimize for outcomes, not hours at a desk.' },
  { icon: Coins, title: 'Meaningful equity', desc: 'Everyone owns a piece of what we build together.' },
  { icon: HeartPulse, title: 'Health & wellness', desc: 'Comprehensive medical cover and a wellness stipend.' },
  { icon: GraduationCap, title: 'Learning budget', desc: 'Annual budget for courses, books, and conferences.' },
  { icon: Rocket, title: 'Real ownership', desc: 'Small teams, big scope. Your work ships and matters.' },
  { icon: Sparkles, title: 'Frontier work', desc: 'Build with state-of-the-art AI on problems that matter.' },
];

const roles = [
  { title: 'Senior Full-Stack Engineer', team: 'Engineering', location: 'Remote (IN / EMEA)', type: 'Full-time' },
  { title: 'AI/ML Engineer', team: 'AI', location: 'Remote', type: 'Full-time' },
  { title: 'Product Designer', team: 'Design', location: 'Remote', type: 'Full-time' },
  { title: 'Customer Success Manager', team: 'Go-to-market', location: 'Bengaluru, IN', type: 'Full-time' },
  { title: 'Enterprise Account Executive', team: 'Sales', location: 'Remote (IN)', type: 'Full-time' },
];

export default function CareersPage() {
  return (
    <MarketingPage
      eyebrow="Careers"
      title={<>Help us build <span className="text-gradient">fairer hiring</span></>}
      lead="We're a small, senior team shipping quickly on hard problems. If you care about opportunity, craft, and AI done responsibly, you'll fit right in."
      breadcrumb={[{ label: 'Careers' }]}
      actions={<Link href="#open-roles"><Button size="lg">View open roles</Button></Link>}
    >
      <section className="mb-20">
        <SectionHeading eyebrow="Life at AIPL Hire" title="Why you'll love working here" />
        <FeatureGrid items={perks} />
      </section>

      <section id="open-roles" className="scroll-mt-28">
        <SectionHeading eyebrow="Open roles" title="Find your next role" lead="Don't see a perfect match? We're always keen to meet exceptional people — apply below." />
        <CareersApply roles={roles} />
      </section>

      <CTASection
        title={<>Don&apos;t see your role?</>}
        subtitle="Introduce yourself — tell us how you'd make hiring better."
        primary={{ label: 'Get in touch', href: '/contact' }}
        secondary={{ label: 'About us', href: '/about' }}
      />
    </MarketingPage>
  );
}
