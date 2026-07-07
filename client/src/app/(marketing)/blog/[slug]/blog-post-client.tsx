'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { date } from '@/lib/format';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';

export default function BlogPostClient() {
  const params = useParams();
  const slug = String(params.slug);
  const { data, isLoading, isError } = useQuery({ queryKey: ['blog', slug], queryFn: () => contentApi.blogPost(slug) });

  return (
    <main className="relative min-h-screen overflow-x-clip pb-24 pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] mesh-bg opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-[-6%] -z-10 h-[380px] w-[820px] -translate-x-1/2 aurora opacity-50" />

      <div className="container">
        <Breadcrumbs items={[{ label: 'Blog', href: '/blog' }, { label: data?.title || 'Article' }]} />

        <article className="mx-auto mt-8 max-w-3xl">
          {isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
          {isError && <p className="text-center text-muted-foreground">Post not found.</p>}
          {data && (
            <>
              <p className="text-sm text-muted-foreground">{date(data.publishedAt || data.createdAt)} · {data.views} views</p>
              <h1 className="mt-2 text-4xl font-extrabold leading-tight">{data.title}</h1>
              {data.coverImage && <img src={data.coverImage} alt="" className="mt-8 w-full rounded-2xl object-cover" />}
              {/^\s*</.test(data.content || '') || /<[a-z][\s\S]*>/i.test(data.content || '') ? (
                <div className="blog-html mt-8 leading-7 text-foreground/90" dangerouslySetInnerHTML={{ __html: data.content }} />
              ) : (
                <div className="mt-8 max-w-none whitespace-pre-wrap leading-7 text-foreground/90">{data.content}</div>
              )}
            </>
          )}
        </article>
      </div>

      <style jsx global>{`
        .blog-html h1, .blog-html h2, .blog-html h3, .blog-html h4 { font-weight: 700; line-height: 1.25; margin: 1.6em 0 0.6em; }
        .blog-html h1 { font-size: 1.9rem; } .blog-html h2 { font-size: 1.55rem; } .blog-html h3 { font-size: 1.3rem; } .blog-html h4 { font-size: 1.1rem; }
        .blog-html p { margin: 0 0 1em; }
        .blog-html a { color: hsl(var(--primary)); text-decoration: underline; }
        .blog-html ul, .blog-html ol { margin: 0 0 1em 1.4em; } .blog-html ul { list-style: disc; } .blog-html ol { list-style: decimal; }
        .blog-html li { margin: 0.25em 0; }
        .blog-html img { border-radius: 0.75rem; max-width: 100%; height: auto; margin: 1em 0; }
        .blog-html figure { margin: 1.25em 0; } .blog-html figcaption { text-align: center; font-size: 0.85rem; color: hsl(var(--muted-foreground)); margin-top: 0.5em; }
        .blog-html blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 1rem; margin: 1.25em 0; color: hsl(var(--muted-foreground)); font-style: italic; }
        .blog-html pre { background: hsl(var(--muted)); padding: 1rem; border-radius: 0.75rem; overflow-x: auto; margin: 1.25em 0; }
        .blog-html code { font-family: ui-monospace, monospace; font-size: 0.9em; }
        .blog-html table { width: 100%; border-collapse: collapse; margin: 1.25em 0; display: block; overflow-x: auto; }
        .blog-html th, .blog-html td { border: 1px solid hsl(var(--border)); padding: 0.5rem 0.75rem; text-align: left; }
        .blog-html hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 2em 0; }
        .blog-html iframe { max-width: 100%; border-radius: 0.75rem; margin: 1.25em 0; }
      `}</style>
    </main>
  );
}
