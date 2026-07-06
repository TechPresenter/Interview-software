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
              <div className="mt-8 max-w-none whitespace-pre-wrap leading-7 text-foreground/90">{data.content}</div>
            </>
          )}
        </article>
      </div>
    </main>
  );
}
