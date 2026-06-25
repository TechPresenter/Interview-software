'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { date } from '@/lib/format';
import { GlassCard } from '@/components/ui/GlassCard';

export default function BlogIndex() {
  const { data } = useQuery({ queryKey: ['public-blog'], queryFn: () => contentApi.blog({ limit: 24 }) });
  const posts = data?.items ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-40" />
      <header className="container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-gradient">HireSense</span>
        </Link>
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
      </header>

      <section className="container py-12">
        <h1 className="text-4xl font-extrabold md:text-5xl">The <span className="text-gradient">HireSense</span> blog</h1>
        <p className="mt-3 text-muted-foreground">Hiring insights, product updates, and AI in recruitment.</p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p: any) => (
            <Link key={p._id} href={`/blog/${p.slug}`}>
              <GlassCard interactive className="h-full">
                {p.coverImage && <img src={p.coverImage} alt="" className="mb-4 aspect-video w-full rounded-xl object-cover" />}
                <p className="text-xs text-muted-foreground">{date(p.publishedAt || p.createdAt)}</p>
                <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
              </GlassCard>
            </Link>
          ))}
        </div>

        {posts.length === 0 && <p className="mt-12 text-center text-muted-foreground">No posts published yet.</p>}
      </section>
    </main>
  );
}
