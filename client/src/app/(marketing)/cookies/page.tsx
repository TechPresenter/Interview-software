import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'Cookie Policy',
  description:
    'How HireSense uses cookies and similar technologies, the categories of cookies we use, and how you can manage your preferences.',
  path: '/cookies',
  keywords: ['cookie policy', 'cookies', 'tracking technologies', 'HireSense cookies'],
});

export default function CookiePolicyPage() {
  return (
    <LegalDoc
      title="Cookie Policy"
      updated="6 July 2026"
      summary="This Cookie Policy explains what cookies are, how HireSense uses them, and how you can control them."
      breadcrumb={[{ label: 'Cookie Policy' }]}
      sections={[
        {
          id: 'what-are-cookies',
          heading: 'What are cookies?',
          body: (
            <p>
              Cookies are small text files stored on your device when you visit a website. They help the site function,
              remember your preferences, and understand how the site is used. We also use similar technologies such as
              local storage.
            </p>
          ),
        },
        {
          id: 'how-we-use',
          heading: 'How we use cookies',
          body: (
            <p>
              We use cookies to keep you signed in, remember settings such as your theme preference, secure the service,
              and measure and improve performance.
            </p>
          ),
        },
        {
          id: 'types',
          heading: 'Types of cookies we use',
          body: (
            <ul>
              <li><strong>Strictly necessary</strong> — required for authentication, security, and core functionality.</li>
              <li><strong>Functional</strong> — remember preferences such as language and theme.</li>
              <li><strong>Analytics</strong> — help us understand usage so we can improve the product.</li>
              <li><strong>Marketing</strong> — used only where applicable and with consent.</li>
            </ul>
          ),
        },
        {
          id: 'managing',
          heading: 'Managing cookies',
          body: (
            <p>
              Most browsers let you refuse or delete cookies through their settings. Blocking strictly necessary cookies
              may affect how the platform works. Where required, we present a consent banner so you can manage
              non-essential cookies.
            </p>
          ),
        },
        {
          id: 'third-parties',
          heading: 'Third-party cookies',
          body: (
            <p>
              Some cookies may be set by trusted third parties that support analytics, payments, or embedded content.
              Their use of cookies is governed by their own policies.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to this policy',
          body: (
            <p>We may update this Cookie Policy from time to time. The latest version will always be available here.</p>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              Questions about cookies? Email <a href="mailto:privacy@hiresense.ai">privacy@hiresense.ai</a>. See also our{' '}
              <a href="/privacy-policy">Privacy Policy</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
