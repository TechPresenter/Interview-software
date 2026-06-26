import { cn } from '@/lib/utils';

/**
 * App-wide credit line. Rendered in the public footer and at the bottom of the
 * dashboard shell.
 */
export function CreditFooter({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-1 text-xs text-muted-foreground sm:flex-row sm:gap-2', className)}>
      <span>
        Software by{' '}
        <a
          href="https://appsgain.in"
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-foreground/80 transition hover:text-primary"
        >
          Appsgain Technologies
        </a>
      </span>
      <span className="hidden text-border sm:inline">·</span>
      <span>
        Developed by{' '}
        <a
          href="https://www.linkedin.com/in/prashantdevtech/"
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-foreground/80 transition hover:text-primary"
        >
          Prashant Singh Kushwaha
        </a>
      </span>
    </div>
  );
}

export default CreditFooter;
