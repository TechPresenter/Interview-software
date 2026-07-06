import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';

/**
 * Layout for all public marketing/content/legal pages. Provides the shared
 * header and footer so they appear consistently on every public page. The
 * authenticated dashboard, interview room, and auth screens live outside this
 * group and intentionally do not render the marketing chrome.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
