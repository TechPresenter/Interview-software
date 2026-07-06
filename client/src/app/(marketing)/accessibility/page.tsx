import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LegalDoc } from '@/components/public/LegalDoc';

export const metadata: Metadata = pageMetadata({
  title: 'Accessibility',
  description:
    'The HireSense accessibility statement — our commitment to WCAG 2.1 AA, the measures we take, assistive technology compatibility, and how to share feedback.',
  path: '/accessibility',
  keywords: ['accessibility', 'WCAG', 'a11y', 'assistive technology', 'HireSense accessibility'],
});

export default function AccessibilityPage() {
  return (
    <LegalDoc
      title="Accessibility Statement"
      updated="6 July 2026"
      summary="HireSense is committed to making our platform usable by everyone, including people with disabilities."
      breadcrumb={[{ label: 'Accessibility' }]}
      sections={[
        {
          id: 'commitment',
          heading: 'Our commitment',
          body: (
            <p>
              We believe hiring technology should be accessible to all. We continually work to improve the accessibility
              and usability of our platform for people of all abilities.
            </p>
          ),
        },
        {
          id: 'standards',
          heading: 'Standards we follow',
          body: (
            <p>
              We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. These guidelines
              explain how to make web content more accessible to people with a wide range of disabilities.
            </p>
          ),
        },
        {
          id: 'measures',
          heading: 'Measures we take',
          body: (
            <ul>
              <li>Semantic HTML, landmarks, and descriptive labels for assistive technologies.</li>
              <li>Keyboard-operable navigation, including a skip-to-content link.</li>
              <li>Visible focus indicators and sufficient color contrast in both light and dark themes.</li>
              <li>Respect for reduced-motion preferences.</li>
              <li>Text alternatives for meaningful images and icons.</li>
            </ul>
          ),
        },
        {
          id: 'compatibility',
          heading: 'Compatibility',
          body: (
            <p>
              The platform is designed to work with modern browsers and common assistive technologies, including screen
              readers and speech recognition. We test across devices and screen sizes.
            </p>
          ),
        },
        {
          id: 'limitations',
          heading: 'Known limitations',
          body: (
            <p>
              Despite our efforts, some content may not yet be fully accessible. Where we identify issues, we prioritize
              fixes. Third-party content may not always meet the same standards.
            </p>
          ),
        },
        {
          id: 'feedback',
          heading: 'Feedback',
          body: (
            <p>
              We welcome your feedback on the accessibility of HireSense. If you encounter a barrier, email{' '}
              <a href="mailto:accessibility@hiresense.ai">accessibility@hiresense.ai</a> or use our{' '}
              <a href="/contact">Contact page</a>, and we will work to address it.
            </p>
          ),
        },
      ]}
    />
  );
}
