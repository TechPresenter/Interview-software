import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { Button } from '@/components/ui/Button';
import HelpCenterClient from './help-center-client';

export const metadata: Metadata = pageMetadata({
  title: 'Help Center',
  description:
    'Guides and answers for getting the most out of HireSense — from setting up your first job to interpreting AI scores, billing, and account management.',
  path: '/help-center',
  keywords: ['HireSense help', 'support center', 'how to', 'hiring software help'],
});

export default function HelpCenterPage() {
  return (
    <MarketingPage
      eyebrow="Support"
      title={<>How can we <span className="text-gradient">help?</span></>}
      lead="Browse guides by topic, search the knowledge base, or reach our team directly. We're here whenever you need us."
      breadcrumb={[{ label: 'Help Center' }]}
      actions={
        <>
          <Link href="/faq"><Button size="lg">Browse FAQs</Button></Link>
          <Link href="/contact"><Button size="lg" variant="glass" magnetic={false}>Contact support</Button></Link>
        </>
      }
    >
      <HelpCenterClient />
    </MarketingPage>
  );
}
