import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import PricingClient from './pricing-client';

export const metadata: Metadata = pageMetadata({
  title: 'Pricing',
  description:
    'Simple, scalable pricing for AI-powered hiring. Start free, then upgrade as you grow — Starter, Professional, and Enterprise plans with transparent per-interview limits.',
  path: '/pricing',
  keywords: ['AI interview pricing', 'hiring software pricing', 'recruitment plans', 'AIPL Hire pricing'],
});

export default function PricingPage() {
  return <PricingClient />;
}
