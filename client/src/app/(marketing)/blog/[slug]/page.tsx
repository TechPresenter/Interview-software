import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import BlogPostClient from './blog-post-client';

/** Turn a slug into a readable title for metadata (content is fetched client-side). */
function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const title = titleFromSlug(params.slug) || 'Article';
  return pageMetadata({
    title,
    description: `Read “${title}” on the HireSense blog — insights on AI-powered hiring and recruitment.`,
    path: `/blog/${params.slug}`,
  });
}

export default function BlogPostPage() {
  return <BlogPostClient />;
}
