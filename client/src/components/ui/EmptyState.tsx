import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Consistent, on-brand empty state for lists and search results. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center', className)}>
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
        <Icon className="h-7 w-7 text-primary" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export default EmptyState;
