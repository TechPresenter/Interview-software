'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';
import { cn } from '@/lib/utils';

export type TileColor = 'violet' | 'blue' | 'green' | 'orange' | 'pink' | 'cyan';

const GRAD: Record<TileColor, string> = {
  violet: 'from-violet-600 via-purple-600 to-fuchsia-600',
  blue: 'from-sky-500 via-blue-600 to-indigo-600',
  green: 'from-emerald-500 via-green-600 to-teal-600',
  orange: 'from-amber-500 via-orange-500 to-rose-500',
  pink: 'from-pink-500 via-rose-500 to-red-500',
  cyan: 'from-cyan-500 via-sky-500 to-blue-600',
};

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  color?: TileColor;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
  sub?: string;
  delta?: number;
  loading?: boolean;
  delay?: number;
}

/** Colorful gradient KPI tile with animated counter, glow, and decorative orbs. */
export function StatTile({ label, value, icon: Icon, color = 'violet', prefix, suffix, compact, sub, delta, loading, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5 }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_14px_40px_-14px_rgba(0,0,0,0.5)]',
        GRAD[color],
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-white/30" />
          ) : (
            <p className="mt-2 text-3xl font-extrabold tracking-tight">
              <AnimatedCounter value={value} prefix={prefix} suffix={suffix} compact={compact} />
            </p>
          )}
          {sub && <p className="mt-1 text-xs text-white/75">{sub}</p>}
          {typeof delta === 'number' && (
            <p className="mt-1 text-xs font-medium text-white/90">{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</p>
          )}
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  );
}

export default StatTile;
