import { cn } from '@/lib/utils';

/**
 * App-wide credit line, rendered in the public footer, the dashboard shell, and
 * the auth screens.
 */
export function CreditFooter({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <span>
        Powered by <span className="font-medium text-foreground/80">NIIPL Group</span>
      </span>
      <span className="text-border">|</span>
      <span>
        Designed &amp; Developed by{' '}
        <a
          href="https://appsgain.in"
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-foreground/80 transition hover:text-primary"
        >
          Appsgain Technologies
        </a>
      </span>
    </div>
  );
}

export default CreditFooter;
