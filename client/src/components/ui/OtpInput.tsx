'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Six segmented one-digit boxes for email verification codes.
 *
 * Typing auto-advances, Backspace walks left, arrow keys move, and pasting
 * "483920" (from the email) fills every box at once. The value is surfaced as
 * a plain string so callers keep their existing `code` state; `onComplete`
 * fires the moment the sixth digit lands so the form can submit itself.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next: string[]) => {
    const code = next.join('');
    onChange(code);
    if (code.length === length && !next.includes('')) onComplete?.(code);
  };

  const setDigit = (i: number, d: string) => {
    const next = [...digits];
    next[i] = d;
    commit(next);
  };

  const handleChange = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setDigit(i, '');
      return;
    }
    if (clean.length > 1) {
      // A paste (or an autofill) landed here — spread it across the boxes.
      const next = [...digits];
      for (let j = 0; j < clean.length && i + j < length; j += 1) next[i + j] = clean[j];
      commit(next);
      refs.current[Math.min(i + clean.length, length - 1)]?.focus();
      return;
    }
    setDigit(i, clean);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setDigit(i - 1, '');
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          // No maxLength: the browser truncates a paste BEFORE the change event,
          // so "483-920" would lose its last digit. The sanitiser + bounded
          // spread in handleChange already cap what lands in the boxes.
          aria-label={`Digit ${i + 1}`}
          className={cn(
            'h-12 w-11 rounded-xl border border-input bg-card/60 text-center text-lg font-semibold outline-none transition',
            'focus:border-primary focus:ring-2 focus:ring-primary/40',
            disabled && 'opacity-50',
          )}
        />
      ))}
    </div>
  );
}

export default OtpInput;
