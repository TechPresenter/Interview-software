'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Labeled text input matching the auth/dashboard form style. When `type="password"`
 * it renders an accessible show/hide toggle (Eye / EyeOff) inside the field:
 * keyboard-focusable, ARIA-labelled, and layout-shift free (the input reserves
 * padding for the icon at all times).
 */
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId();
  const isPassword = type === 'password';
  const [show, setShow] = useState(false);
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/40 focus:shadow-[0_6px_26px_-10px_hsl(var(--primary)/0.45)]',
            isPassword && 'pr-11',
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
            title={show ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={show ? 'off' : 'on'}
                initial={{ opacity: 0, scale: 0.7, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.7, rotate: 12 }}
                transition={{ duration: 0.15 }}
                className="grid place-items-center"
              >
                {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
    </div>
  );
}

export default Field;
