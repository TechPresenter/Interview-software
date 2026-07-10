import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import FaqClient from './faq-client';

export const metadata: Metadata = pageMetadata({
  title: 'FAQs',
  description:
    'Frequently asked questions about AIPL Hire — how AI interviews work, scoring and fairness, proctoring, pricing, data security, and getting started.',
  path: '/faq',
  keywords: ['AIPL Hire FAQ', 'AI interview questions', 'hiring software FAQ'],
});

export default function FaqPage() {
  return <FaqClient />;
}
