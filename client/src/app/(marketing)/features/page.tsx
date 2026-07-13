import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import FeaturesClient from './features-client';

export const metadata: Metadata = pageMetadata({
  title: 'Features',
  description:
    'The complete AIPL Hire platform: AI recruitment, applicant tracking (ATS), AI interviews, a live video interview room, resume intelligence, job & candidate management, analytics, security & compliance, integrations & APIs, billing, CMS, and a fully responsive experience.',
  path: '/features',
  keywords: [
    'AI recruitment features', 'applicant tracking system', 'AI interview platform', 'resume screening',
    'candidate ranking', 'proctoring', 'recruitment analytics', 'hiring software features', 'ATS features',
  ],
});

export default function FeaturesPage() {
  return <FeaturesClient />;
}
