import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const tones: Record<Tone, string> = {
  default: 'bg-primary/15 text-primary ring-primary/30',
  success: 'bg-accent/15 text-accent ring-accent/30',
  warning: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
  danger: 'bg-destructive/15 text-destructive ring-destructive/30',
  info: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  muted: 'bg-muted text-muted-foreground ring-border',
};

/** Maps common status strings to a tone. */
export function statusTone(status?: string): Tone {
  switch (status) {
    case 'active':
    case 'paid':
    case 'open':
    case 'completed':
    case 'success':
      return 'success';
    case 'suspended':
    case 'failed':
    case 'rejected':
    case 'closed':
      return 'danger';
    case 'pending':
    case 'trialing':
    case 'paused':
    case 'draft':
      return 'warning';
    default:
      return 'muted';
  }
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
