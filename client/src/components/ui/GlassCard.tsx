'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover lift + glow. */
  interactive?: boolean;
  /** 3D pointer tilt (implies interactive). */
  tilt?: boolean;
  delay?: number;
}

/** Premium glass card: gradient border, fade-up reveal, hover glow, optional 3D tilt. */
export function GlassCard({ className, interactive, tilt, delay = 0, children, ...props }: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  const rotateX = useTransform(srx, (v) => `${v}deg`);
  const rotateY = useTransform(sry, (v) => `${v}deg`);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 10);
    rx.set(-py * 10);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={tilt ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={interactive || tilt ? { y: -6 } : undefined}
      className={cn(
        'glass gradient-border relative rounded-2xl p-6 transition-shadow duration-300',
        (interactive || tilt) && 'cursor-pointer hover:shadow-[0_24px_70px_-20px_hsl(var(--primary)/0.45)]',
        className,
      )}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
