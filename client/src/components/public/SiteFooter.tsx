'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Mail, Phone, MapPin, Linkedin, Twitter, Youtube, ShieldCheck, Lock, BadgeCheck } from 'lucide-react';
import { useBranding } from '@/store/branding.store';
import { FOOTER_NAV, SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

/** Shared site footer rendered on the landing page and every public page. */
export function SiteFooter() {
  const pathname = usePathname() || '/';
  const branding = useBranding((s) => s.branding);
  const name = branding?.platformName || SITE.name;
  const email = branding?.contact?.email || SITE.email;
  const social = branding?.social || {};
  const year = new Date().getFullYear();

  const socials = [
    { label: 'LinkedIn', icon: Linkedin, href: social.linkedin || SITE.socials.linkedin },
    { label: 'X (Twitter)', icon: Twitter, href: social.x || SITE.socials.x },
    { label: 'YouTube', icon: Youtube, href: social.youtube || SITE.socials.youtube },
  ];

  return (
    <footer className="border-t border-border bg-background/60" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Footer</h2>
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 text-lg font-bold" aria-label={`${name} home`}>
              {branding?.logoUrl ? (
                <img src={`${API_ORIGIN}${branding.logoUrl}`} alt={name} className="h-9 w-9 rounded-xl object-contain" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
                  <Sparkles className="h-5 w-5 text-white" />
                </span>
              )}
              <span className="text-gradient">{name}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              AI-powered hiring, end to end.<br />Screen, Interview, Score &amp; Hire Faster.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <a href={`mailto:${email}`} className="flex items-center gap-2 transition hover:text-primary">
                <Mail className="h-4 w-4 shrink-0" /> {email}
              </a>
              <a href={`tel:${SITE.phoneDial}`} className="flex items-center gap-2 transition hover:text-primary">
                <Phone className="h-4 w-4 shrink-0" /> {SITE.phone}
              </a>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{SITE.address.org}, {SITE.address.locality} – {SITE.address.postalCode}, {SITE.address.region}</span>
              </p>
            </div>
          </div>

          {/* Nav columns */}
          {FOOTER_NAV.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => {
                  const active = pathname === l.href;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'transition hover:text-foreground focus-visible:underline focus-visible:outline-none',
                          active ? 'font-medium text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-6 border-t border-border pt-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">© {year} {name}. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={s.label}
                title={s.label}
                className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <Link href="/security" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Enterprise Security
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-accent" /> SSL Secure
            </span>
            <Link href="/gdpr" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground">
              <BadgeCheck className="h-3.5 w-3.5 text-accent" /> GDPR Ready
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
