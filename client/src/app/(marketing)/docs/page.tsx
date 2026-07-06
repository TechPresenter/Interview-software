import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { Prose } from '@/components/public/Prose';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'Documentation',
  description:
    'AIPL Hire product documentation — get started, configure AI interviews, manage your candidate pipeline, handle billing, and administer your workspace.',
  path: '/docs',
  keywords: ['AIPL Hire docs', 'documentation', 'user guide', 'setup guide'],
});

const sections = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: (
      <>
        <p>Welcome to AIPL Hire. You&apos;ll be running your first AI interview in minutes:</p>
        <ol>
          <li><strong>Create your workspace</strong> — sign up and confirm your organization details.</li>
          <li><strong>Create a job</strong> — add the role title, description, and required competencies.</li>
          <li><strong>Add candidates</strong> — invite by email or import a CSV; upload resumes for instant AI analysis.</li>
          <li><strong>Send interview links</strong> — each candidate receives a private, proctored interview link.</li>
          <li><strong>Review reports</strong> — scored reports appear the moment each interview ends.</li>
        </ol>
        <p>New here? Start with the <Link href="/help-center">Help Center</Link> for a guided tour.</p>
      </>
    ),
  },
  {
    id: 'interviews',
    title: 'Configuring AI interviews',
    body: (
      <>
        <p>Tune how the AI interviewer behaves per job from <strong>Job → Interview settings</strong>:</p>
        <ul>
          <li><strong>Language</strong> — English or Hindi, switchable mid-interview.</li>
          <li><strong>Difficulty</strong> — a starting level; the AI adapts up or down from answers.</li>
          <li><strong>Skips</strong> — optionally allow candidates a limited number of skips.</li>
          <li><strong>Proctoring</strong> — enable tab/blur/paste and face-presence signals for an integrity score.</li>
          <li><strong>Recording</strong> — capture HD video and a live transcript for later review.</li>
        </ul>
        <p>See <Link href="/ai-interviews">how AI interviews work</Link> for a deeper walkthrough.</p>
      </>
    ),
  },
  {
    id: 'pipeline',
    title: 'Candidates & pipeline',
    body: (
      <>
        <p>Move candidates through customizable stages on the pipeline board. You can:</p>
        <ul>
          <li>Drag candidates between stages and leave shared notes.</li>
          <li>Rank automatically by AI fit score.</li>
          <li>Filter by job, stage, score, and integrity.</li>
          <li>Export shortlists and reports to <Link href="/reports">PDF or Excel</Link>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Billing & plans',
    body: (
      <>
        <p>Manage your subscription from <strong>Dashboard → Billing</strong>:</p>
        <ul>
          <li>Upgrade, downgrade, or cancel anytime — changes are prorated.</li>
          <li>Each completed interview counts once against your monthly quota.</li>
          <li>Download invoices for your records.</li>
        </ul>
        <p>Compare tiers on the <Link href="/pricing">pricing page</Link>.</p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Account & administration',
    body: (
      <>
        <p>Admins can manage the workspace from the dashboard:</p>
        <ul>
          <li><strong>Roles</strong> — recruiter, HR manager, and company admin permissions.</li>
          <li><strong>Branding</strong> — white-label the platform with your logo and colors.</li>
          <li><strong>API keys</strong> — issue scoped keys for programmatic access (see the <Link href="/api-docs">API docs</Link>).</li>
          <li><strong>Notifications</strong> — configure email, SMS, and WhatsApp alerts.</li>
        </ul>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <MarketingPage
      eyebrow="Documentation"
      title={<>AIPL Hire <span className="text-gradient">docs</span></>}
      lead="Everything you need to set up, run, and administer AI-powered hiring."
      breadcrumb={[{ label: 'Documentation' }]}
      actions={<Link href="/api-docs"><Button size="lg" variant="glass" magnetic={false}>API reference</Button></Link>}
    >
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="Documentation sections" className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contents</p>
            <ol className="mt-4 space-y-2 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted-foreground transition-colors hover:text-primary">{s.title}</a>
                </li>
              ))}
              <li><Link href="/api-docs" className="text-muted-foreground transition-colors hover:text-primary">API reference</Link></li>
            </ol>
          </nav>
        </aside>

        <div className="min-w-0">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="mb-12 scroll-mt-28">
              <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
              <Prose className="mt-3">{s.body}</Prose>
            </section>
          ))}
        </div>
      </div>
    </MarketingPage>
  );
}
