import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'GDPR Compliance',
  description:
    'How AIPL Hire supports GDPR compliance — lawful bases, data subject rights, international transfers, sub-processors, and how to reach our data protection contact.',
  path: '/gdpr',
  keywords: ['GDPR', 'GDPR compliance', 'data subject rights', 'EU data protection', 'AIPL Hire GDPR'],
});

export default function GdprPage() {
  return (
    <LegalDoc
      title="GDPR Compliance"
      updated="6 July 2026"
      summary="We are committed to helping our customers meet their obligations under the EU General Data Protection Regulation (GDPR) and equivalent laws."
      breadcrumb={[{ label: 'GDPR Compliance' }]}
      sections={[
        {
          id: 'commitment',
          heading: 'Our commitment',
          body: (
            <p>
              AIPL Hire is built with privacy in mind. We process personal data lawfully, transparently, and securely,
              and we provide the tools and documentation customers need to comply with the GDPR.
            </p>
          ),
        },
        {
          id: 'lawful-bases',
          heading: 'Lawful bases',
          body: (
            <p>
              We process personal data under lawful bases including performance of a contract, legitimate interests,
              consent, and legal obligation. For candidate data processed on behalf of customers, the customer determines
              the lawful basis as controller.
            </p>
          ),
        },
        {
          id: 'your-rights',
          heading: 'Data subject rights',
          body: (
            <>
              <p>Individuals in the EU/EEA have the right to:</p>
              <ul>
                <li>Access their personal data.</li>
                <li>Rectify inaccurate data.</li>
                <li>Erase data (&ldquo;right to be forgotten&rdquo;).</li>
                <li>Restrict or object to processing.</li>
                <li>Data portability.</li>
                <li>Withdraw consent at any time.</li>
              </ul>
              <p>
                If AIPL Hire holds your data as a controller, contact us below. If a customer collected your data through
                the platform, we will direct your request to the relevant controller.
              </p>
            </>
          ),
        },
        {
          id: 'dpa',
          heading: 'Data Processing Agreement',
          body: (
            <p>
              We offer a <a href="/dpa">Data Processing Agreement</a> that incorporates GDPR-required terms, including
              standard contractual clauses for international transfers.
            </p>
          ),
        },
        {
          id: 'transfers',
          heading: 'International transfers',
          body: (
            <p>
              Where we transfer personal data outside the EU/EEA, we use appropriate safeguards such as standard
              contractual clauses to ensure an adequate level of protection.
            </p>
          ),
        },
        {
          id: 'subprocessors',
          heading: 'Sub-processors',
          body: (
            <p>
              We engage vetted sub-processors under contracts that require GDPR-consistent protections, and we maintain a
              current list available on request.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: 'Data protection contact',
          body: (
            <p>
              For GDPR requests or questions, email{' '}
              <a href="mailto:privacy@aipl.online">privacy@aipl.online</a>. See also our{' '}
              <a href="/privacy-policy">Privacy Policy</a> and <a href="/security">Security</a> pages.
            </p>
          ),
        },
      ]}
    />
  );
}
