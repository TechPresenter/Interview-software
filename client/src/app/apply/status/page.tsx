import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { ApplyStatus } from '@/components/apply/ApplyStatus';

export const metadata: Metadata = pageMetadata({
  title: 'Application payment status',
  description: 'Confirm your interview application fee payment.',
  path: '/apply/status',
  // Nothing to index: this is a per-applicant transactional page.
  noIndex: true,
});

/**
 * The return-from-gateway landing page. Cashfree redirects here with ?code=…;
 * ApplyStatus reads it, reconciles the payment against the gateway, and shows
 * the result. Wrapped in Suspense because useSearchParams() requires it.
 */
export default function ApplyStatusPage() {
  return (
    <>
      <SiteHeader />
      <MarketingPage
        eyebrow="Application"
        title={<>Payment <span className="text-gradient">status</span></>}
        lead="We're confirming your application fee. This only takes a moment."
        breadcrumb={[{ label: 'Apply', href: '/apply' }, { label: 'Status' }]}
      >
        <Suspense fallback={<div className="mx-auto h-40 max-w-lg animate-pulse rounded-2xl bg-muted/40" />}>
          <ApplyStatus />
        </Suspense>
      </MarketingPage>
      <SiteFooter />
    </>
  );
}
