import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SITE } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — AI Interview Platform`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  keywords: ['AI interview', 'hiring', 'recruitment', 'ATS', 'candidate screening', 'AI interviewer'],
  openGraph: {
    title: `${SITE.name} — AI Interview Platform`,
    description: SITE.tagline,
    type: 'website',
    url: SITE.url,
    siteName: SITE.name,
  },
  twitter: { card: 'summary_large_image', title: SITE.name, description: SITE.tagline },
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const noFlash = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body className="min-h-screen antialiased">
        <a href="#main-content" className="skip-link glass rounded-lg px-4 py-2 text-sm">
          Skip to content
        </a>
        <Providers>
          <div id="main-content">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
