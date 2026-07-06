import type { Metadata } from 'next';
import Link from 'next/link';
import { Terminal, KeyRound, Webhook, Gauge } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { MarketingPage } from '@/components/public/MarketingPage';
import { CodeBlock } from '@/components/public/CodeBlock';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = pageMetadata({
  title: 'API Documentation',
  description:
    'The HireSense REST API: authenticate with an API key, create jobs, invite candidates, retrieve scored reports, and subscribe to webhooks. Base URL, endpoints, and examples.',
  path: '/api-docs',
  keywords: ['HireSense API', 'REST API', 'recruitment API', 'webhooks', 'developer documentation'],
});

const endpoints = [
  { method: 'POST', path: '/jobs', desc: 'Create a job with required competencies.' },
  { method: 'POST', path: '/candidates', desc: 'Add a candidate and (optionally) upload a resume.' },
  { method: 'POST', path: '/interviews/invite', desc: 'Generate a private interview link for a candidate.' },
  { method: 'GET', path: '/interviews/:id/report', desc: 'Retrieve the scored report for a completed interview.' },
  { method: 'GET', path: '/candidates?jobId=', desc: 'List and rank candidates for a job.' },
];

const methodColor: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-primary',
  PATCH: 'text-amber-400',
  DELETE: 'text-destructive',
};

const nav = [
  ['auth', 'Authentication'],
  ['base-url', 'Base URL'],
  ['endpoints', 'Endpoints'],
  ['webhooks', 'Webhooks'],
  ['rate-limits', 'Rate limits'],
  ['errors', 'Errors'],
];

export default function ApiDocsPage() {
  return (
    <MarketingPage
      eyebrow="Developers"
      title={<>API <span className="text-gradient">reference</span></>}
      lead="Automate hiring end to end. Create jobs, invite candidates, pull scored reports, and react to events over a clean REST API."
      breadcrumb={[{ label: 'API Documentation' }]}
      actions={
        <>
          <Link href="/dashboard/api-keys"><Button size="lg">Get an API key</Button></Link>
          <Link href="/integrations"><Button size="lg" variant="glass" magnetic={false}>View integrations</Button></Link>
        </>
      }
    >
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="API sections" className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reference</p>
            <ol className="mt-4 space-y-2 text-sm">
              {nav.map(([id, label]) => (
                <li key={id}><a href={`#${id}`} className="text-muted-foreground transition-colors hover:text-primary">{label}</a></li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="min-w-0 text-[15px] leading-7 text-muted-foreground">
          <section id="auth" className="scroll-mt-28">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><KeyRound className="h-5 w-5 text-primary" /> Authentication</h2>
            <p className="mt-3">All requests are authenticated with a bearer API key generated from your dashboard. Keep keys secret and server-side.</p>
            <CodeBlock label="Authorization header">{`Authorization: Bearer hs_live_xxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
          </section>

          <section id="base-url" className="mt-12 scroll-mt-28">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><Terminal className="h-5 w-5 text-primary" /> Base URL</h2>
            <p className="mt-3">All endpoints are relative to the API version base:</p>
            <CodeBlock label="Base URL">{`https://api.hiresense.ai/api/v1`}</CodeBlock>
          </section>

          <section id="endpoints" className="mt-12 scroll-mt-28">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Endpoints</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              {endpoints.map((e) => (
                <div key={e.path} className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
                  <span className={`w-16 shrink-0 font-mono text-xs font-bold ${methodColor[e.method]}`}>{e.method}</span>
                  <code className="shrink-0 font-mono text-sm text-foreground">{e.path}</code>
                  <span className="text-sm text-muted-foreground sm:ml-auto">{e.desc}</span>
                </div>
              ))}
            </div>
            <CodeBlock label="Example — create a job">{`curl -X POST https://api.hiresense.ai/api/v1/jobs \\
  -H "Authorization: Bearer $HIRESENSE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Frontend Engineer",
    "competencies": ["technical", "communication", "problem_solving"]
  }'`}</CodeBlock>
          </section>

          <section id="webhooks" className="mt-12 scroll-mt-28">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><Webhook className="h-5 w-5 text-primary" /> Webhooks</h2>
            <p className="mt-3">Subscribe to events to react in real time. Payloads are signed so you can verify authenticity.</p>
            <CodeBlock label="Event payload">{`{
  "event": "interview.completed",
  "data": {
    "interviewId": "iv_9f2c...",
    "candidateId": "cd_1a4b...",
    "overallScore": 87,
    "recommendation": "strong_hire"
  }
}`}</CodeBlock>
          </section>

          <section id="rate-limits" className="mt-12 scroll-mt-28">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><Gauge className="h-5 w-5 text-primary" /> Rate limits</h2>
            <p className="mt-3">The default limit is 600 requests per minute per key. Exceeding it returns <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] text-foreground">429 Too Many Requests</code> with a <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] text-foreground">Retry-After</code> header.</p>
          </section>

          <section id="errors" className="mt-12 scroll-mt-28">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Errors</h2>
            <p className="mt-3">Errors use standard HTTP status codes and a consistent JSON body:</p>
            <CodeBlock label="Error response">{`{
  "success": false,
  "error": { "code": "not_found", "message": "Job not found" }
}`}</CodeBlock>
            <p className="mt-6">Need help integrating? <Link href="/contact" className="font-medium text-primary underline underline-offset-4">Talk to our team</Link>.</p>
          </section>
        </div>
      </div>
    </MarketingPage>
  );
}
