import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'Refund & Return Policy',
  description:
    'AIPL Hire refund and cancellation policy for subscriptions and paid plans — eligibility, timelines, the trial period, and how to request a refund.',
  path: '/refund-policy',
  keywords: ['refund policy', 'return policy', 'cancellation', 'subscription refund', 'AIPL Hire'],
});

export default function RefundPolicyPage() {
  return (
    <LegalDoc
      title="Refund & Return Policy"
      updated="8 July 2026"
      summary="AIPL Hire is a subscription software service (SaaS). This policy explains when refunds apply, how cancellations work, and how to request a refund."
      breadcrumb={[{ label: 'Refund & Return Policy' }]}
      sections={[
        {
          id: 'overview',
          heading: 'Overview',
          body: (
            <p>
              AIPL Hire provides access to a cloud-based, digital software platform. Because we deliver a service rather
              than a physical product, there is nothing to physically return. This policy sets out the limited
              circumstances in which subscription fees may be refunded.
            </p>
          ),
        },
        {
          id: 'free-trial',
          heading: 'Free trial',
          body: (
            <p>
              Where a free trial is offered, you can evaluate the platform at no cost for the stated trial period. You
              will not be charged during the trial, and you can cancel at any time before it ends without any payment.
              We recommend using the trial to confirm the product meets your needs before subscribing.
            </p>
          ),
        },
        {
          id: 'subscriptions',
          heading: 'Subscription fees',
          body: (
            <ul>
              <li>Subscriptions are billed in advance for the selected billing cycle (monthly or yearly).</li>
              <li>
                <strong>7-day money-back guarantee:</strong> if you are not satisfied, you may request a full refund of
                your <em>first</em> payment within 7 days of the initial charge, provided the account has not been used
                abusively.
              </li>
              <li>
                After the first 7 days, payments for the current billing period are generally non-refundable. Renewal
                payments are non-refundable once the new period has begun.
              </li>
              <li>Add-on usage, one-time charges, and taxes/fees are non-refundable.</li>
            </ul>
          ),
        },
        {
          id: 'cancellation',
          heading: 'Cancellation',
          body: (
            <p>
              You can cancel your subscription at any time from <a href="/dashboard/billing">Billing</a> in your
              dashboard. Cancellation stops future renewals; you retain access until the end of the period you have
              already paid for. We do not automatically pro-rate or refund the remainder of a paid period unless
              required by law.
            </p>
          ),
        },
        {
          id: 'eligibility',
          heading: 'Refund eligibility',
          body: (
            <ul>
              <li>The request is made within the eligible window described above.</li>
              <li>The charge is a genuine, verifiable payment on your account.</li>
              <li>The account has not violated our <a href="/terms">Terms &amp; Conditions</a>.</li>
              <li>Duplicate or erroneous charges are always refunded in full.</li>
            </ul>
          ),
        },
        {
          id: 'how-to-request',
          heading: 'How to request a refund',
          body: (
            <p>
              Email <a href="mailto:support@aipl.online">support@aipl.online</a> from the email address associated with
              your account, including your workspace name and the invoice number. We aim to respond within 2 business
              days. Approved refunds are returned to the original payment method within 5–10 business days, depending on
              your bank or payment provider.
            </p>
          ),
        },
        {
          id: 'chargebacks',
          heading: 'Chargebacks',
          body: (
            <p>
              Please contact us before initiating a chargeback — most issues are resolved quickly. Chargebacks raised
              without contacting us may result in suspension of the account pending resolution.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to this policy',
          body: <p>We may update this Refund &amp; Return Policy from time to time. The latest version is always available on this page.</p>,
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              Questions about refunds or billing? Email <a href="mailto:support@aipl.online">support@aipl.online</a>. See
              also our <a href="/terms">Terms &amp; Conditions</a> and <a href="/contact">Contact page</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
