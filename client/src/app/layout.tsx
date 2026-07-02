import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'AIPL Hire — AI Interview Platform', template: '%s · AIPL Hire' },
  description:
    'Enterprise AI interview platform. Screen, interview, score, and report on candidates with adaptive AI — faster and fairer hiring.',
  keywords: ['AI interview', 'hiring', 'recruitment', 'ATS', 'candidate screening'],
  openGraph: { title: 'AIPL Hire', type: 'website', description: 'AI-powered hiring, end to end.' },
  metadataBase: new URL('https://aipl.online'),
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const noFlash = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
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
