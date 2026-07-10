'use client';

/**
 * Motion primitives — the reusable animation backbone for the whole app.
 *
 * Every component here respects `prefers-reduced-motion`: when the user opts
 * out, content renders immediately with no transform/opacity animation.
 *
 *   <Reveal>            scroll-triggered fade + slide-in (any direction)
 *   <Stagger>/<Item>    stagger a list of children into view
 *   <Parallax>          scroll-linked vertical drift for depth
 *   <Magnetic>          cursor-following magnetic pull on hover
 *   <TextGradient>      animated shimmering gradient headline span
 */

import * as React from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  type Variants,
  type MotionProps,
  type HTMLMotionProps,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/** Shared premium easing (expo-out-ish) used across the design system. */
export const EASE = [0.22, 1, 0.36, 1] as const;

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

const offsetFor = (dir: Direction, distance: number) => {
  switch (dir) {
    case 'up':
      return { y: distance };
    case 'down':
      return { y: -distance };
    case 'left':
      return { x: distance };
    case 'right':
      return { x: -distance };
    default:
      return {};
  }
};

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Slide-in direction. Default 'up'. */
  direction?: Direction;
  /** Animation delay (s). */
  delay?: number;
  /** Duration (s). Default 0.6. */
  duration?: number;
  /** Travel distance in px. Default 24. */
  distance?: number;
  /** Only animate the first time it scrolls into view. Default true. */
  once?: boolean;
  /** Render as a different element while keeping motion (e.g. 'section', 'li'). */
  as?: keyof typeof motion;
}

/** Fade + slide an element into view as it scrolls up. The go-to section wrapper. */
export function Reveal({
  direction = 'up',
  delay = 0,
  duration = 0.6,
  distance = 24,
  once = true,
  as = 'div',
  className,
  children,
  ...props
}: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  if (reduce) {
    return (
      <Comp className={className} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      initial={{ opacity: 0, ...offsetFor(direction, distance) }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}

interface StaggerProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Gap between each child's entrance (s). Default 0.08. */
  stagger?: number;
  /** Delay before the first child (s). */
  delayChildren?: number;
  once?: boolean;
}

/** Container that reveals its <Item> children one after another on scroll. */
export function Stagger({
  stagger = 0.08,
  delayChildren = 0,
  once = true,
  className,
  children,
  ...props
}: StaggerProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children as React.ReactNode}
      </div>
    );
  }
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '-80px' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface ItemProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  direction?: Direction;
  distance?: number;
  as?: keyof typeof motion;
}

/** A child of <Stagger>. Fades + slides in on its scheduled turn. */
export function Item({ direction = 'up', distance = 20, as = 'div', className, children, ...props }: ItemProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  if (reduce) {
    return (
      <Comp className={className} {...props}>
        {children}
      </Comp>
    );
  }
  const variants: Variants = {
    hidden: { opacity: 0, ...offsetFor(direction, distance) },
    show: { opacity: 1, x: 0, y: 0, transition: { duration: 0.55, ease: EASE } },
  };
  return (
    <Comp variants={variants} className={className} {...props}>
      {children}
    </Comp>
  );
}

interface ParallaxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Total vertical travel across the scroll window, px. Positive = moves up. Default 60. */
  offset?: number;
  children: React.ReactNode;
}

/** Scroll-linked vertical drift — subtle depth for hero blobs, images, cards. */
export function Parallax({ offset = 60, className, children, ...props }: ParallaxProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  const sy = useSpring(y, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className={className} {...props}>
      <motion.div style={reduce ? undefined : { y: sy }}>{children}</motion.div>
    </div>
  );
}

interface MagneticProps extends Omit<MotionProps, 'ref'> {
  /** Pull strength (0–1). Default 0.35. */
  strength?: number;
  className?: string;
  children: React.ReactNode;
}

/** Wrap any element to give it a cursor-following magnetic pull on hover. */
export function Magnetic({ strength = 0.35, className, children, ...props }: MagneticProps) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18 });
  const sy = useSpring(y, { stiffness: 260, damping: 18 });

  if (reduce) return <div className={className}>{children}</div>;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={cn('inline-block', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Animated shimmering gradient headline text. */
export function TextGradient({
  children,
  className,
  animate = true,
}: {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return <span className={cn(animate ? 'text-gradient-animate' : 'text-gradient', className)}>{children}</span>;
}
