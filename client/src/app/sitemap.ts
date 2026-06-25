import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://hiresense.ai';

/** Static marketing routes. Dynamic blog routes can be appended at build time. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/pricing', '/blog', '/login', '/register'];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/blog' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
