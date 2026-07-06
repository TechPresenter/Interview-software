import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/** Route-transition skeleton for marketing pages (rendered inside the shared chrome). */
export default function MarketingLoading() {
  return (
    <div className="container pb-24 pt-28 md:pt-32">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-8 h-12 w-3/4 max-w-2xl" />
      <Skeleton className="mt-4 h-5 w-2/3 max-w-xl" />
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
