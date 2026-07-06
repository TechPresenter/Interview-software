import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'Data Processing Agreement',
  description:
    'The HireSense Data Processing Agreement (DPA) describes how we process personal data on behalf of customers, including security measures, sub-processors, and data subject rights.',
  path: '/dpa',
  keywords: ['data processing agreement', 'DPA', 'GDPR processor', 'sub-processors', 'HireSense DPA'],
});

export default function DpaPage() {
  return (
    <LegalDoc
      title="Data Processing Agreement"
      updated="6 July 2026"
      summary="This DPA forms part of the agreement between HireSense (processor) and the customer (controller) for the processing of personal data through the platform."
      breadcrumb={[{ label: 'Data Processing Agreement (DPA)' }]}
      sections={[
        {
          id: 'roles',
          heading: 'Roles of the parties',
          body: (
            <p>
              For candidate and applicant data processed through the platform, the customer is the controller and
              HireSense is the processor. HireSense processes personal data only on documented instructions from the
              controller, including as set out in the agreement and this DPA.
            </p>
          ),
        },
        {
          id: 'definitions',
          heading: 'Definitions',
          body: (
            <p>
              Terms such as &ldquo;personal data&rdquo;, &ldquo;processing&rdquo;, &ldquo;controller&rdquo;,
              &ldquo;processor&rdquo;, and &ldquo;data subject&rdquo; have the meanings given in applicable data
              protection law, including the GDPR where it applies.
            </p>
          ),
        },
        {
          id: 'scope',
          heading: 'Scope and purpose of processing',
          body: (
            <ul>
              <li><strong>Subject matter</strong> — provision of the HireSense hiring platform.</li>
              <li><strong>Duration</strong> — the term of the agreement plus any legally required retention.</li>
              <li><strong>Nature and purpose</strong> — screening, interviewing, scoring, and reporting on candidates.</li>
              <li><strong>Categories of data</strong> — identifiers, application materials, interview responses, and recordings.</li>
              <li><strong>Data subjects</strong> — the controller&apos;s candidates and applicants.</li>
            </ul>
          ),
        },
        {
          id: 'obligations',
          heading: 'Processor obligations',
          body: (
            <ul>
              <li>Process personal data only on the controller&apos;s documented instructions.</li>
              <li>Ensure personnel are bound by confidentiality.</li>
              <li>Implement appropriate technical and organizational security measures.</li>
              <li>Assist the controller with data subject requests and compliance obligations.</li>
            </ul>
          ),
        },
        {
          id: 'subprocessors',
          heading: 'Sub-processors',
          body: (
            <p>
              The controller authorizes HireSense to engage sub-processors (for hosting, AI, email, and payments) under
              written contracts imposing equivalent data protection obligations. We maintain a current list of
              sub-processors and provide notice of material changes.
            </p>
          ),
        },
        {
          id: 'security',
          heading: 'Security measures',
          body: (
            <p>
              We maintain encryption in transit and at rest, access controls, monitoring, and backup and recovery
              processes. See our <a href="/security">Security page</a> for details.
            </p>
          ),
        },
        {
          id: 'data-subject-requests',
          heading: 'Data subject requests',
          body: (
            <p>
              Taking into account the nature of processing, we assist the controller with appropriate technical and
              organizational measures to respond to requests from data subjects exercising their rights.
            </p>
          ),
        },
        {
          id: 'breach-notification',
          heading: 'Personal data breach',
          body: (
            <p>
              We notify the controller without undue delay after becoming aware of a personal data breach affecting the
              controller&apos;s data, and provide information reasonably needed to meet notification obligations.
            </p>
          ),
        },
        {
          id: 'international-transfers',
          heading: 'International transfers',
          body: (
            <p>
              Where personal data is transferred across borders, we rely on appropriate safeguards such as standard
              contractual clauses.
            </p>
          ),
        },
        {
          id: 'audits',
          heading: 'Audits',
          body: (
            <p>
              We make available information necessary to demonstrate compliance and allow for audits, subject to
              reasonable confidentiality and security conditions.
            </p>
          ),
        },
        {
          id: 'deletion',
          heading: 'Return and deletion of data',
          body: (
            <p>
              Upon termination, we delete or return personal data at the controller&apos;s choice, except where retention
              is required by law.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              To request a signed DPA or ask questions, email{' '}
              <a href="mailto:privacy@hiresense.ai">privacy@hiresense.ai</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
