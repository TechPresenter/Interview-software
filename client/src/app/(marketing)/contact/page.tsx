import type { Metadata } from 'next';
import { Mail, MapPin, Phone, Clock, PhoneCall, MessageCircle, Linkedin, Twitter, Youtube } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { ContactForm } from '@/components/public/ContactForm';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { SITE } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description:
    'Get in touch with the AIPL Hire team. Talk to sales, reach support, or ask about partnerships — we typically reply within one business day.',
  path: '/contact',
  keywords: ['contact AIPL Hire', 'AIPL Online', 'sales', 'support', 'demo request', 'Kolkata'],
});

const A = SITE.address;
const WA = `https://wa.me/${SITE.whatsapp}`;
// Reliable, keyless embed with a marker + zoom, geocoded from the office address.
const MAP_QUERY = `${A.org}, ${A.street}, ${A.locality}, ${A.region} ${A.postalCode}`;
const MAP_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=16&output=embed`;

const channels = [
  { icon: Mail, title: 'Email us', desc: 'Sales, support & partnerships.', value: SITE.email, href: `mailto:${SITE.email}` },
  { icon: PhoneCall, title: 'Call us', desc: 'Mon–Sat, 9:00 AM – 6:00 PM IST.', value: SITE.phone, href: `tel:${SITE.phoneDial}` },
  { icon: MessageCircle, title: 'WhatsApp', desc: 'Chat with us in real time.', value: SITE.phone, href: WA },
];

const socials = [
  { label: 'LinkedIn', icon: Linkedin, href: SITE.socials.linkedin },
  { label: 'X (Twitter)', icon: Twitter, href: SITE.socials.x },
  { label: 'YouTube', icon: Youtube, href: SITE.socials.youtube },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: A.org,
  url: SITE.url,
  email: SITE.email,
  telephone: SITE.phoneDial,
  address: {
    '@type': 'PostalAddress',
    streetAddress: A.street,
    addressLocality: A.locality,
    addressRegion: A.region,
    postalCode: A.postalCode,
    addressCountry: A.country,
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phoneDial,
    email: SITE.email,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en', 'hi'],
  },
};

export default function ContactPage() {
  return (
    <MarketingPage
      eyebrow="Contact"
      title={<>Let&apos;s <span className="text-gradient">talk</span></>}
      lead="Questions about the product, pricing, or partnerships? Send us a note and the right person will get back to you — usually within one business day."
      breadcrumb={[{ label: 'Contact' }]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Quick channels */}
      <div className="grid gap-4 sm:grid-cols-3">
        {channels.map((c) => (
          <a key={c.title} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener" className="group">
            <GlassCard interactive className="!p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow transition-transform group-hover:scale-110">
                <c.icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="mt-3 font-semibold">{c.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{c.desc}</p>
              <p className="mt-1.5 text-sm font-medium text-primary">{c.value}</p>
            </GlassCard>
          </a>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Form */}
        <div className="order-2 lg:order-1">
          <ContactForm />
        </div>

        {/* Info */}
        <div className="order-1 space-y-4 lg:order-2">
          <GlassCard className="!p-6">
            <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-accent" /> Office address</div>
            <p className="mt-2 font-medium">{A.org}</p>
            <address className="mt-1 text-sm not-italic leading-relaxed text-muted-foreground">
              {A.lines.map((l) => <span key={l} className="block">{l}</span>)}
            </address>
          </GlassCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="!p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-accent" /> Email</div>
              <a href={`mailto:${SITE.email}`} className="mt-2 block break-all text-sm font-medium text-primary underline-offset-4 hover:underline">{SITE.email}</a>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-accent" /> Phone</div>
              <a href={`tel:${SITE.phoneDial}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">{SITE.phone}</a>
            </GlassCard>

            <GlassCard className="!p-6">
              <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-accent" /> Working hours</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {SITE.hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-3"><span>{h.days}</span><span className="text-right">{h.time}</span></li>
                ))}
              </ul>
            </GlassCard>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={WA} target="_blank" rel="noreferrer noopener" className="flex-1"><Button className="w-full" magnetic={false}><MessageCircle className="h-4 w-4" /> WhatsApp us</Button></a>
            <a href={`tel:${SITE.phoneDial}`} className="flex-1"><Button variant="glass" className="w-full" magnetic={false}><PhoneCall className="h-4 w-4" /> Call now</Button></a>
          </div>

          <GlassCard className="!p-6">
            <p className="text-sm font-semibold">Follow us</p>
            <div className="mt-3 flex gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener" aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Map */}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-accent" /> Find us in New Town, Kolkata</h2>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(MAP_QUERY)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Get directions →
          </a>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border">
          <iframe
            title={`${A.org} office location`}
            src={MAP_SRC}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[360px] w-full grayscale-[0.2] contrast-[1.05]"
          />
        </div>
      </section>
    </MarketingPage>
  );
}
