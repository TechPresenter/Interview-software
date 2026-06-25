'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-[transform,box-shadow,background,color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 overflow-hidden select-none',
  {
    variants: {
      variant: {
        // Gradient CTA with glow + shine sweep
        primary:
          'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-primary-foreground shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.6)] hover:shadow-[0_12px_45px_-8px_hsl(var(--primary)/0.7)]',
        glass: 'glass text-foreground hover:bg-foreground/[0.06]',
        outline: 'border border-border bg-transparent hover:bg-muted/60',
        ghost: 'hover:bg-muted/60',
        soft: 'bg-primary/10 text-primary hover:bg-primary/15',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-110 shadow-[0_8px_30px_-10px_hsl(var(--destructive)/0.6)]',
      },
      size: {
        sm: 'h-9 px-4',
        md: 'h-11 px-6',
        lg: 'h-14 px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  magnetic?: boolean;
  loading?: boolean;
}

/** Premium button: gradient + glow + shine sweep + click ripple + magnetic pull. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size, magnetic = true, loading, children, onClick, onPointerDown, ...props }, ref) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 280, damping: 18 });
    const sy = useSpring(y, { stiffness: 280, damping: 18 });
    const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);

    const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!magnetic) return;
      const r = e.currentTarget.getBoundingClientRect();
      x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
      y.set((e.clientY - (r.top + r.height / 2)) * 0.25);
    };
    const reset = () => {
      x.set(0);
      y.set(0);
    };

    const spawnRipple = (e: React.PointerEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((p) => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      setTimeout(() => setRipples((p) => p.filter((rp) => rp.id !== id)), 650);
      onPointerDown?.(e);
    };

    return (
      <motion.button
        ref={ref}
        style={{ x: sx, y: sy }}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        onPointerDown={spawnRipple}
        whileTap={{ scale: 0.96 }}
        className={cn(buttonVariants({ variant, size }), className)}
        onClick={onClick}
        {...(props as any)}
      >
        {/* shine sweep */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.28),transparent)] transition-transform duration-700 group-hover/btn:translate-x-full" />
        {/* ripples */}
        {ripples.map((rp) => (
          <span
            key={rp.id}
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-[ripple_0.6s_ease-out] rounded-full bg-white/40"
            style={{ left: rp.x, top: rp.y }}
          />
        ))}
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
      </motion.button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
export default Button;
