import type { Metadata } from 'next';
import { ShieldCheck, Clock, Languages } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { ApplyForm } from '@/components/apply/ApplyForm';

export const metadata: Metadata = pageMetadata({
  title: 'Apply for an Interview',
  description:
    'Apply to be interviewed by AIPL Hire. Tell us about yourself, upload your resume, and pick the language for your AI interview — in English or Hindi.',
  path: '/apply',
  keywords: ['apply for interview', 'AI interview application', 'job application', 'AIPL Hire apply'],
});

const points = [
  { icon: Clock, title: 'Takes about 10 minutes', desc: 'Have your resume and a passport-size photo ready before you start.' },
  { icon: Languages, title: 'English or Hindi', desc: 'Your interview runs in whichever language you pick — questions, voice, and scoring alike.' },
  { icon: ShieldCheck, title: 'Your documents stay private', desc: 'Your resume and photo are visible only to the review team, never on a public link.' },
];

/**
 * The public application route.
 *
 * It renders the site chrome itself rather than living in the (marketing) group:
 * this is a form, not a content page, and the group's layout is the marketing
 * shell. Everything below the header is one client component — the form owns all
 * of its state and the config fetch.
 */
export default function ApplyPage() {
  return (
    <>
      <SiteHeader />
      <MarketingPage
        eyebrow="Apply"
        title={<>Apply for an <span className="text-gradient">interview</span></>}
        lead="Tell us about yourself and we'll take it from there. Every application is read by a person before anyone is shortlisted."
        breadcrumb={[{ label: 'Apply' }]}
      >
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {points.map((p) => (
              <div key={p.title} className="rounded-2xl border border-border bg-card/40 p-5">
                <p.icon className="h-5 w-5 text-accent" />
                <h2 className="mt-3 text-sm font-semibold">{p.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <ApplyForm />
          </div>
        </div>
      </MarketingPage>
      <SiteFooter />
    </>
  );
}
