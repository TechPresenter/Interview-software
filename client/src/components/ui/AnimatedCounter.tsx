'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';
import { formatCompact } from '@/lib/utils';

interface Props {
  value: number;
  /** Number of decimals (default 0). */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}

/** Counts up to `value` when scrolled into view. */
export function AnimatedCounter({ value, decimals = 0, prefix = '', suffix = '', compact }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1.4, bounce: 0 });

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      if (!ref.current) return;
      ref.current.textContent =
        prefix + (compact ? formatCompact(latest) : latest.toFixed(decimals)) + suffix;
    });
  }, [spring, decimals, prefix, suffix, compact]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

export default AnimatedCounter;
