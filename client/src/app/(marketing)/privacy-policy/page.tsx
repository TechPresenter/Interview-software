import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How AIPL Hire collects, uses, shares, and protects personal data — including candidate and customer information — and the rights available to you.',
  path: '/privacy-policy',
  keywords: ['privacy policy', 'data protection', 'personal data', 'AIPL Hire privacy'],
});

export default function PrivacyPolicyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="6 July 2026"
      summary="This Privacy Policy explains how AIPL Hire collects, uses, discloses, and safeguards personal data when you use our platform and websites."
      breadcrumb={[{ label: 'Privacy Policy' }]}
      sections={[
        {
          id: 'overview',
          heading: 'Overview',
          body: (
            <>
              <p>
                AIPL Hire (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) provides an AI-powered hiring
                platform. This policy applies to personal data we process as a controller for our own websites and
                accounts, and as a processor on behalf of customers who use the platform to interview candidates.
              </p>
              <p>By using AIPL Hire, you agree to the practices described in this policy.</p>
            </>
          ),
        },
        {
          id: 'information-we-collect',
          heading: 'Information we collect',
          body: (
            <ul>
              <li><strong>Account data</strong> — name, email, organization, and role.</li>
              <li><strong>Candidate data</strong> — resumes, interview responses, recordings, transcripts, and scores submitted by our customers.</li>
              <li><strong>Usage data</strong> — device, browser, IP address, and interactions with the product.</li>
              <li><strong>Billing data</strong> — plan, invoices, and payment status (card data is handled by our payment processors, not stored by us).</li>
            </ul>
          ),
        },
        {
          id: 'how-we-use',
          heading: 'How we use information',
          body: (
            <ul>
              <li>To provide, operate, and improve the platform and its AI features.</li>
              <li>To generate interview scores, reports, and analytics for our customers.</li>
              <li>To secure the service, prevent abuse, and maintain integrity.</li>
              <li>To communicate about your account, support, and product updates.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          ),
        },
        {
          id: 'legal-bases',
          heading: 'Legal bases for processing',
          body: (
            <p>
              Where applicable law requires, we rely on one or more legal bases: performance of a contract, our
              legitimate interests in operating and improving the service, your consent, and compliance with legal
              obligations. For candidate data processed on behalf of customers, the customer is the controller and
              determines the legal basis.
            </p>
          ),
        },
        {
          id: 'sharing',
          heading: 'Sharing and disclosure',
          body: (
            <>
              <p>We do not sell personal data. We share it only with:</p>
              <ul>
                <li>Service providers (sub-processors) who support hosting, AI, email, and payments under contract.</li>
                <li>Our customers, in the case of candidate data they collect through the platform.</li>
                <li>Authorities where required by law or to protect rights and safety.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'retention',
          heading: 'Data retention',
          body: (
            <p>
              We retain personal data for as long as needed to provide the service and for legitimate business or legal
              purposes. Customers control retention of candidate data within their workspace and may request deletion.
            </p>
          ),
        },
        {
          id: 'your-rights',
          heading: 'Your rights',
          body: (
            <>
              <p>Depending on your location, you may have the right to:</p>
              <ul>
                <li>Access, correct, or delete your personal data.</li>
                <li>Object to or restrict certain processing.</li>
                <li>Request portability of your data.</li>
                <li>Withdraw consent where processing is based on consent.</li>
              </ul>
              <p>To exercise these rights, contact us using the details below. See also our <a href="/gdpr">GDPR page</a>.</p>
            </>
          ),
        },
        {
          id: 'security',
          heading: 'Security',
          body: (
            <p>
              We use encryption in transit and at rest, role-based access controls, and continuous monitoring to protect
              personal data. Learn more on our <a href="/security">Security page</a>. No method of transmission or
              storage is completely secure, but we work continuously to protect your information.
            </p>
          ),
        },
        {
          id: 'international-transfers',
          heading: 'International transfers',
          body: (
            <p>
              We may process data in countries other than your own. Where we transfer personal data internationally, we
              use appropriate safeguards such as standard contractual clauses.
            </p>
          ),
        },
        {
          id: 'cookies',
          heading: 'Cookies',
          body: (
            <p>
              We use cookies and similar technologies as described in our <a href="/cookies">Cookie Policy</a>.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to this policy',
          body: (
            <p>
              We may update this policy from time to time. Material changes will be posted here with an updated date, and
              where required, we will notify you.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact us',
          body: (
            <p>
              Questions about this policy or your data? Email{' '}
              <a href="mailto:privacy@aipl.online">privacy@aipl.online</a> or visit our{' '}
              <a href="/contact">Contact page</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
