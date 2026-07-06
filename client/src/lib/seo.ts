import type { Metadata } from 'next';
import { SITE } from './site';

export interface PageSeo {
  /** Page title (the root layout appends "· AIPL Hire"). */
  title: string;
  description: string;
  /** Absolute path beginning with "/". Used for the canonical + OG url. */
  path: string;
  keywords?: string[];
  /** Absolute or root-relative OG image. Defaults to the site OG image. */
  ogImage?: string;
  /** Set true to keep a page out of search indexes (e.g. utility pages). */
  noIndex?: boolean;
}

/**
 * Build a consistent Next.js Metadata object for a public page:
 * title/description, canonical URL, Open Graph, and Twitter card.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  ogImage = '/og.png',
  noIndex,
}: PageSeo): Metadata {
  const url = `${SITE.url}${path === '/' ? '' : path}`;
  const image = ogImage.startsWith('http') ? ogImage : `${SITE.url}${ogImage}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url,
      siteName: SITE.name,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE.name}`,
      description,
      images: [image],
    },
  };
}
