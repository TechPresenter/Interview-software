'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/store/theme.store';
import { cn } from '@/lib/utils';

/** Animated dark/light switch. Hydration-safe (renders a stable shell first). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-border bg-card/60 text-foreground transition-colors hover:bg-muted/60',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ y: 14, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.25 }}
        >
          {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default ThemeToggle;
