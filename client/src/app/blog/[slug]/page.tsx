'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { date } from '@/lib/format';

export default function BlogPostPage() {
  const params = useParams();
  const slug = String(params.slug);
  const { data, isLoading, isError } = useQuery({ queryKey: ['blog', slug], queryFn: () => contentApi.blogPost(slug) });

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-30" />
      <header className="container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-gradient">HireSense</span>
        </Link>
        <Link href="/blog" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
      </header>

      <article className="container max-w-3xl py-12">
        {isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
        {isError && <p className="text-center text-muted-foreground">Post not found.</p>}
        {data && (
          <>
            <p className="text-sm text-muted-foreground">{date(data.publishedAt || data.createdAt)} · {data.views} views</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight">{data.title}</h1>
            {data.coverImage && <img src={data.coverImage} alt="" className="mt-8 w-full rounded-2xl object-cover" />}
            <div className="prose prose-invert mt-8 max-w-none whitespace-pre-wrap text-foreground/90">{data.content}</div>
          </>
        )}
      </article>
    </main>
  );
}
