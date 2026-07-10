'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Dependency-free, theme-aware, animated SVG charts. */

interface Point { label?: string; value: number }

/** Smooth-ish area + line chart for time series. */
export function AreaChart({ data, height = 170, className }: { data: Point[]; height?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const w = 100;
  const vals = data.map((d) => d.value);
  const max = Math.max(1, ...vals);
  const pts =
    data.length > 1
      ? data.map((d, i) => [(i / (data.length - 1)) * w, height - (d.value / max) * (height - 16) - 8])
      : [
          [0, height - 8],
          [w, height - 8],
        ];
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const area = `${line} L ${w} ${height} L 0 ${height} Z`;

  if (!data.length) {
    return <div className={cn('grid place-items-center text-sm text-muted-foreground', className)} style={{ height }}>No data yet</div>;
  }

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }}>
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#area-${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path
        d={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </svg>
  );
}

/** Animated vertical bars. */
export function BarChart({ data, height = 170, className }: { data: Point[]; height?: number; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className={cn('grid place-items-center text-sm text-muted-foreground', className)} style={{ height }}>No data yet</div>;
  return (
    <div className={cn('flex items-end gap-1.5', className)} style={{ height }}>
      {data.map((d, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-md bg-[linear-gradient(180deg,hsl(var(--primary)),hsl(var(--accent)/0.45))]"
          initial={{ height: 0 }}
          whileInView={{ height: `${(d.value / max) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.03 }}
          title={d.label ? `${d.label}: ${d.value}` : String(d.value)}
        />
      ))}
    </div>
  );
}

/** Labeled horizontal bars (breakdowns). */
export function BarList({ data, className }: { data: { label: string; value: number; hint?: string }[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-sm text-muted-foreground">No data yet</p>;
  return (
    <div className={cn('space-y-3', className)}>
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="capitalize text-muted-foreground">{d.label}</span>
            <span className="font-medium tabular-nums">{d.hint ?? d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]"
              initial={{ width: 0 }}
              whileInView={{ width: `${(d.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Conversion funnel — decreasing bars with step-to-step drop-off. */
export function Funnel({ steps, className }: { steps: { label: string; value: number }[]; className?: string }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  if (!steps.length) return <p className="text-sm text-muted-foreground">No data yet</p>;
  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((s, i) => {
        const pctTop = Math.round((s.value / top) * 100);
        const prev = steps[i - 1]?.value;
        const conv = prev != null ? Math.round((s.value / Math.max(1, prev)) * 100) : 100;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">{s.value.toLocaleString()} · {pctTop}%</span>
            </div>
            <div className="h-9 overflow-hidden rounded-lg bg-muted">
              <motion.div
                className="h-full rounded-lg bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]"
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.max(pctTop, 3)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
              />
            </div>
            {i > 0 && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                <span className={cn(conv >= 40 ? 'text-accent' : conv >= 15 ? 'text-amber-500' : 'text-destructive')}>{conv}%</span> from previous step
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day-of-week × hour activity heatmap. cells: { dow (1=Sun … 7=Sat), hour (0–23), value }. */
export function Heatmap({ cells, className }: { cells: { dow: number; hour: number; value: number }[]; className?: string }) {
  const map = new Map<string, number>();
  let max = 1;
  for (const c of cells) {
    map.set(`${c.dow}-${c.hour}`, c.value);
    max = Math.max(max, c.value);
  }
  if (!cells.length) return <p className="text-sm text-muted-foreground">No data yet</p>;
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[560px]">
        <div className="flex gap-1 pl-10">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h % 3 === 0 ? h : ''}</div>
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} className="mt-1 flex items-center gap-1">
            <div className="w-9 shrink-0 text-[10px] text-muted-foreground">{DOW[d - 1]}</div>
            {Array.from({ length: 24 }).map((_, h) => {
              const v = map.get(`${d}-${h}`) || 0;
              const intensity = v / max;
              return (
                <div
                  key={h}
                  className="aspect-square flex-1 rounded-[3px] transition-colors"
                  style={{ background: v ? `hsl(var(--primary) / ${(0.14 + intensity * 0.86).toFixed(2)})` : 'hsl(var(--muted))' }}
                  title={`${DOW[d - 1]} ${h}:00 — ${v} views`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Animated donut for proportional data. */
export function Donut({ segments, size = 150, className }: { segments: { label: string; value: number; color: string }[]; size?: number; className?: string }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const r = 60;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={cn('flex items-center gap-5', className)}>
      <svg viewBox="0 0 160 160" style={{ width: size, height: size }} className="-rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="18" />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <motion.circle
              key={s.label}
              cx="80" cy="80" r={r} fill="none" stroke={s.color} strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="space-y-2 text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="capitalize text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
