'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Newspaper } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Breadcrumbs } from '@/components/public/Breadcrumbs';
import { NewsletterForm } from '@/components/public/NewsletterForm';

export default function BlogClient() {
  const { data, isLoading } = useQuery({ queryKey: ['public-blog'], queryFn: () => contentApi.blog({ limit: 48 }) });
  const posts = useMemo(() => data?.items ?? [], [data]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p: any) => p.category && set.add(p.category));
    return ['All', ...Array.from(set)];
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p: any) => {
      const inCat = category === 'All' || p.category === category;
      if (!inCat) return false;
      if (!q) return true;
      const hay = `${p.title} ${p.excerpt ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [posts, query, category]);

  return (
    <main className="relative min-h-screen overflow-x-clip pb-24 pt-28 md:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] mesh-bg opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-bg" />
      <div className="pointer-events-none absolute left-1/2 top-[-6%] -z-10 h-[440px] w-[960px] -translate-x-1/2 aurora opacity-60" />

      <div className="container">
        <Breadcrumbs items={[{ label: 'Blog' }]} />

        <header className="mt-8 max-w-3xl">
          <h1 className="text-4xl font-extrabold md:text-5xl">
            The <span className="text-gradient-animate">AIPL Hire</span> blog
          </h1>
          <p className="mt-3 text-muted-foreground">Hiring insights, product updates, and AI in recruitment.</p>
        </header>

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles…"
              aria-label="Search articles"
              className="h-11 w-full rounded-xl border border-input bg-card/60 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-sm transition',
                    category === c ? 'border-transparent bg-gradient-brand text-white' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title={posts.length === 0 ? 'No posts published yet' : 'No matching articles'}
              description={posts.length === 0 ? 'Check back soon — new insights are on the way.' : 'Try a different search or category.'}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p: any) => (
                <Link key={p._id} href={`/blog/${p.slug}`}>
                  <GlassCard interactive className="flex h-full flex-col">
                    {p.coverImage && <img src={p.coverImage} alt="" className="mb-4 aspect-video w-full rounded-xl object-cover" />}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p.category && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{p.category}</span>}
                      <span>{date(p.publishedAt || p.createdAt)}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                    {Array.isArray(p.tags) && p.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {p.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">#{t}</span>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Newsletter */}
        <section className="mt-16">
          <GlassCard className="flex flex-col items-center gap-5 py-10 text-center">
            <div>
              <h2 className="text-2xl font-bold">Get hiring insights in your inbox</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Join our newsletter for product updates and the best of AI in recruitment. No spam, unsubscribe anytime.
              </p>
            </div>
            <NewsletterForm className="justify-center" />
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
