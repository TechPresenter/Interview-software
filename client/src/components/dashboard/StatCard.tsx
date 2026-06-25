'use client';

import { type LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  delta?: number; // % change vs previous period
  prefix?: string;
  suffix?: string;
  compact?: boolean;
  loading?: boolean;
  delay?: number;
}

/** Premium analytics card with animated counter, trend, and skeleton state. */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  prefix,
  suffix,
  compact,
  loading,
  delay,
}: StatCardProps) {
  if (loading) {
    return (
      <GlassCard delay={delay}>
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-4 h-9 w-32" />
        <div className="skeleton mt-3 h-3 w-20" />
      </GlassCard>
    );
  }

  return (
    <GlassCard interactive delay={delay} className="group">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand shadow-glow transition-transform group-hover:scale-110">
          <Icon className="h-5 w-5 text-white" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold">
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} compact={compact} />
      </p>
      {typeof delta === 'number' && (
        <p
          className={cn(
            'mt-2 text-xs font-medium',
            delta >= 0 ? 'text-accent' : 'text-destructive',
          )}
        >
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last period
        </p>
      )}
    </GlassCard>
  );
}

export default StatCard;
