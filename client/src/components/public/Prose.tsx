import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Typographic wrapper for long-form content (legal, docs). The project has no
 * @tailwindcss/typography plugin, so spacing/among-elements styles are applied
 * with descendant selectors here for a consistent, theme-aware reading column.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-none text-[15px] leading-7 text-muted-foreground',
        '[&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground md:[&_h2]:text-2xl',
        '[&_h3]:mt-8 [&_h3]:scroll-mt-28 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground',
        '[&_p]:mt-4',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-accent',
        '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
        '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6',
        '[&_li]:marker:text-primary/60',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Prose;
