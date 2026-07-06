import type { Metadata } from 'next';
import { Mail, LifeBuoy, Briefcase, MapPin, Phone, Clock, Linkedin, Twitter, Youtube } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { ContactForm } from '@/components/public/ContactForm';
import { GlassCard } from '@/components/ui/GlassCard';
import { SITE } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description:
    'Get in touch with the AIPL Hire team. Talk to sales, reach support, or ask about partnerships — we typically reply within one business day.',
  path: '/contact',
  keywords: ['contact AIPL Hire', 'sales', 'support', 'demo request'],
});

const channels = [
  { icon: Briefcase, title: 'Talk to sales', desc: 'Pricing, demos, and enterprise rollouts.', value: 'sales@aipl.online', href: 'mailto:sales@aipl.online' },
  { icon: LifeBuoy, title: 'Support', desc: 'Already a customer? We are here to help.', value: SITE.email, href: `mailto:${SITE.email}` },
  { icon: Mail, title: 'Partnerships & press', desc: 'Integrations, media, and collaborations.', value: 'hello@aipl.online', href: 'mailto:hello@aipl.online' },
];

const socials = [
  { label: 'LinkedIn', icon: Linkedin, href: SITE.socials.linkedin },
  { label: 'X (Twitter)', icon: Twitter, href: SITE.socials.x },
  { label: 'YouTube', icon: Youtube, href: SITE.socials.youtube },
];

const MAP_SRC =
  'https://www.google.com/maps?q=MG+Road,+Bengaluru,+Karnataka,+India&output=embed';

export default function ContactPage() {
  return (
    <MarketingPage
      eyebrow="Contact"
      title={<>Let&apos;s <span className="text-gradient">talk</span></>}
      lead="Questions about the product, pricing, or partnerships? Send us a note and the right person will get back to you — usually within one business day."
      breadcrumb={[{ label: 'Contact' }]}
    >
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Form */}
        <div className="order-2 lg:order-1">
          <ContactForm />
        </div>

        {/* Info */}
        <div className="order-1 space-y-4 lg:order-2">
          {channels.map((c) => (
            <GlassCard key={c.title} interactive className="!p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] glow">
                  <c.icon className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.desc}</p>
                  <a href={c.href} className="mt-1.5 inline-block text-sm font-medium text-primary underline underline-offset-4">{c.value}</a>
                </div>
              </div>
            </GlassCard>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="!p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-accent" /> Head office</div>
              <p className="mt-2 text-sm text-muted-foreground">MG Road, Bengaluru,<br />Karnataka 560001, India</p>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4 text-accent" /> +91 80 4718 2200</div>
            </GlassCard>
            <GlassCard className="!p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-accent" /> Business hours</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li className="flex justify-between"><span>Mon – Fri</span><span>9:00 – 18:00 IST</span></li>
                <li className="flex justify-between"><span>Sat</span><span>10:00 – 14:00 IST</span></li>
                <li className="flex justify-between"><span>Sun</span><span>Closed</span></li>
              </ul>
            </GlassCard>
          </div>

          <GlassCard className="!p-5">
            <p className="text-sm font-semibold">Follow us</p>
            <div className="mt-3 flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Map */}
      <section className="mt-10">
        <div className="overflow-hidden rounded-2xl border border-border">
          <iframe
            title="AIPL Hire head office location"
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
