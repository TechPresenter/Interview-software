import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'The terms and conditions governing your use of the AIPL Hire platform, including accounts, acceptable use, subscriptions, intellectual property, and liability.',
  path: '/terms',
  keywords: ['terms and conditions', 'terms of service', 'AIPL Hire terms', 'user agreement'],
});

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms & Conditions"
      updated="6 July 2026"
      summary="These Terms govern your access to and use of AIPL Hire. By creating an account or using the platform, you agree to these Terms."
      breadcrumb={[{ label: 'Terms & Conditions' }]}
      sections={[
        {
          id: 'acceptance',
          heading: 'Acceptance of terms',
          body: (
            <p>
              By accessing or using AIPL Hire, you agree to be bound by these Terms and our{' '}
              <a href="/privacy-policy">Privacy Policy</a>. If you are using the platform on behalf of an organization,
              you represent that you have authority to bind that organization.
            </p>
          ),
        },
        {
          id: 'accounts',
          heading: 'Accounts and eligibility',
          body: (
            <ul>
              <li>You must provide accurate information and keep your credentials secure.</li>
              <li>You are responsible for all activity under your account.</li>
              <li>You must be legally able to enter into these Terms.</li>
            </ul>
          ),
        },
        {
          id: 'acceptable-use',
          heading: 'Acceptable use',
          body: (
            <>
              <p>You agree not to:</p>
              <ul>
                <li>Use the platform unlawfully or to discriminate against candidates in violation of applicable law.</li>
                <li>Reverse engineer, disrupt, or attempt to gain unauthorized access to the service.</li>
                <li>Upload malicious code or content you do not have the right to submit.</li>
                <li>Resell or misuse the service outside the scope of your plan.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'subscriptions',
          heading: 'Subscriptions and billing',
          body: (
            <ul>
              <li>Paid plans are billed in advance on a recurring basis until cancelled.</li>
              <li>Interview quotas and limits are defined by your selected plan.</li>
              <li>Fees are non-refundable except where required by law. Cancelling takes effect immediately and returns the workspace to Free Trial limits for the remainder of the paid period.</li>
              <li>See the <a href="/pricing">pricing page</a> for current plans.</li>
            </ul>
          ),
        },
        {
          id: 'intellectual-property',
          heading: 'Intellectual property',
          body: (
            <p>
              AIPL Hire and its content, features, and technology are owned by us and protected by law. You retain
              ownership of the data you submit. You grant us a limited license to process that data solely to provide the
              service.
            </p>
          ),
        },
        {
          id: 'candidate-data',
          heading: 'Customer and candidate data',
          body: (
            <p>
              When you use AIPL Hire to interview candidates, you act as the data controller and we act as the processor.
              Our processing is governed by our <a href="/dpa">Data Processing Agreement</a>. You are responsible for
              providing required notices to and obtaining necessary consents from candidates.
            </p>
          ),
        },
        {
          id: 'ai-disclaimer',
          heading: 'AI outputs',
          body: (
            <p>
              The platform uses AI to generate interview questions, scores, and recommendations. These are decision
              support tools and should not be the sole basis for employment decisions. You remain responsible for final
              hiring decisions and for ensuring they comply with applicable law.
            </p>
          ),
        },
        {
          id: 'termination',
          heading: 'Termination',
          body: (
            <p>
              You may cancel at any time. We may suspend or terminate access for breach of these Terms or to protect the
              service. Upon termination, your right to use the platform ceases.
            </p>
          ),
        },
        {
          id: 'disclaimers',
          heading: 'Disclaimers',
          body: (
            <p>
              The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind,
              to the maximum extent permitted by law.
            </p>
          ),
        },
        {
          id: 'liability',
          heading: 'Limitation of liability',
          body: (
            <p>
              To the maximum extent permitted by law, AIPL Hire will not be liable for indirect, incidental, or
              consequential damages, and our total liability is limited to the amounts you paid in the twelve months
              preceding the claim.
            </p>
          ),
        },
        {
          id: 'governing-law',
          heading: 'Governing law',
          body: (
            <p>
              These Terms are governed by the laws of India, without regard to conflict-of-law principles, unless
              otherwise agreed in a signed enterprise agreement.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          body: (
            <p>
              We may update these Terms. Continued use after changes take effect constitutes acceptance of the revised
              Terms.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              Questions about these Terms? Email <a href="mailto:support@aipl.online">support@aipl.online</a> or visit our{' '}
              <a href="/contact">Contact page</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
