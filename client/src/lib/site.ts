/**
 * Central site configuration — the single source of truth for public/marketing
 * brand info, navigation, socials, and the canonical list of public routes.
 *
 * Framework-agnostic (no React / no "use client") so it can be imported by both
 * server files (sitemap.ts, page metadata) and client components (header/footer).
 * The visible brand name/logo may still be overridden at runtime by the
 * white-label branding store; these values are the SEO + fallback defaults.
 */

export type NavLink = { label: string; href: string };
export type NavColumn = { title: string; links: NavLink[] };

export const SITE = {
  name: 'HireSense',
  legalName: 'HireSense',
  /** Short marketing tagline used in the footer + hero. */
  tagline: 'AI-powered hiring, end to end.',
  description:
    'Enterprise AI interview platform. Screen resumes, run adaptive AI interviews, score candidates objectively, and get hire-ready reports — faster and fairer hiring.',
  email: 'support@hiresense.ai',
  /** Canonical production origin (no trailing slash). Override via env. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://hiresense.ai').replace(/\/$/, ''),
  socials: {
    linkedin: 'https://www.linkedin.com/company/hiresense',
    x: 'https://x.com/hiresense',
    youtube: 'https://www.youtube.com/@hiresense',
  },
} as const;

/** Primary top-navigation shown in the marketing header. */
export const HEADER_NAV: NavLink[] = [
  { label: 'Features', href: '/features' },
  { label: 'AI Interviews', href: '/ai-interviews' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
];

/** Footer link columns. */
export const FOOTER_NAV: NavColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'AI Interviews', href: '/ai-interviews' },
      { label: 'Reports & Analytics', href: '/reports' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Integrations', href: '/integrations' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/help-center' },
      { label: 'Documentation', href: '/docs' },
      { label: 'API Documentation', href: '/api-docs' },
      { label: 'FAQs', href: '/faq' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'System Status', href: '/status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Security', href: '/security' },
      { label: 'Data Processing (DPA)', href: '/dpa' },
      { label: 'GDPR Compliance', href: '/gdpr' },
      { label: 'Accessibility', href: '/accessibility' },
    ],
  },
];

/**
 * Every crawlable public content route, derived from the nav config plus the
 * home page. Consumed by app/sitemap.ts so the sitemap always matches the
 * footer. Auth/utility routes are intentionally excluded.
 */
export const PUBLIC_PATHS: string[] = Array.from(
  new Set<string>([
    '/',
    '/blog',
    ...HEADER_NAV.map((l) => l.href),
    ...FOOTER_NAV.flatMap((c) => c.links.map((l) => l.href)),
  ]),
).filter((p) => p.startsWith('/'));
