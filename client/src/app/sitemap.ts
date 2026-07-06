import type { MetadataRoute } from 'next';
import { SITE, PUBLIC_PATHS } from '@/lib/site';

const daily = new Set(['/blog', '/changelog', '/status']);
const highPriority = new Set(['/features', '/ai-interviews', '/pricing', '/reports']);

/**
 * Sitemap for all public marketing/content/legal pages. Routes are sourced from
 * the shared site config so the sitemap always stays in sync with the footer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE.url}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : daily.has(path) ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : highPriority.has(path) ? 0.9 : 0.6,
  }));
}
