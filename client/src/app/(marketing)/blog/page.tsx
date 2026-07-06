import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import BlogClient from './blog-client';

export const metadata: Metadata = pageMetadata({
  title: 'Blog',
  description:
    'Hiring insights, product updates, and the latest on AI in recruitment — from the HireSense team.',
  path: '/blog',
  keywords: ['hiring blog', 'AI recruitment', 'talent acquisition', 'interview tips'],
});

export default function BlogPage() {
  return <BlogClient />;
}
