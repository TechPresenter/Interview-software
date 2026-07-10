import { Reveal } from '@/components/ui/motion';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Reveal duration={0.5} distance={16} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="relative">
        <span className="absolute -left-3 top-1 hidden h-8 w-1 rounded-full bg-[linear-gradient(180deg,hsl(var(--primary)),hsl(var(--accent)))] sm:block" />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </Reveal>
  );
}

export default PageHeader;
