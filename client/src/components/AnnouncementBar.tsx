'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Megaphone } from 'lucide-react';
import { useBranding } from '@/store/branding.store';
import { cn } from '@/lib/utils';

const tones: Record<string, string> = {
  info: 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-black',
};

/** Global announcement bar driven by white-label branding. Dismissible per text. */
export function AnnouncementBar() {
  const branding = useBranding((s) => s.branding);
  const a = branding?.announcement;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (a?.enabled && a.text) setDismissed(sessionStorage.getItem(`ann:${a.text}`) === '1');
  }, [a?.enabled, a?.text]);

  if (!a?.enabled || !a.text) return null;

  const close = () => {
    sessionStorage.setItem(`ann:${a.text}`, '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn('relative z-[55] flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium', tones[a.type || 'info'])}
        >
          <Megaphone className="h-4 w-4 shrink-0" />
          {a.link ? (
            <a href={a.link} className="underline-offset-2 hover:underline">{a.text}</a>
          ) : (
            <span>{a.text}</span>
          )}
          <button onClick={close} className="absolute right-3 opacity-80 hover:opacity-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AnnouncementBar;
