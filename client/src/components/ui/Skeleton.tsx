import { cn } from '@/lib/utils';

/** Shimmering placeholder block. Uses the global `.skeleton` shimmer utility. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** A card-shaped skeleton matching GlassCard proportions. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border p-6', className)}>
      <Skeleton className="h-11 w-11 rounded-xl" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2.5 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
    </div>
  );
}

export default Skeleton;
