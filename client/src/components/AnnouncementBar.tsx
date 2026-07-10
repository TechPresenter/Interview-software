'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Megaphone, Clock } from 'lucide-react';
import { contentApi } from '@/lib/content.api';
import { useBranding } from '@/store/branding.store';
import { cn } from '@/lib/utils';

const tones: Record<string, string> = {
  info: 'bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-black',
  critical: 'bg-destructive text-destructive-foreground',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Live countdown to a target time; null once elapsed or when no target set. */
function useCountdown(target?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1000),
  };
}

/**
 * Global announcement bar. Prefers an active platform announcement from the CMS
 * (Admin → CMS → Announcements) and shows a live countdown when it has an end
 * time; falls back to the white-label branding announcement. Dismissible per text.
 */
export function AnnouncementBar() {
  const branding = useBranding((s) => s.branding);
  const { data } = useQuery({ queryKey: ['public-announcements'], queryFn: contentApi.announcements, staleTime: 60_000, retry: false });

  const active = useMemo(() => {
    const cms = Array.isArray(data) ? data[0] : null;
    if (cms) {
      return {
        key: String(cms._id),
        text: cms.body ? `${cms.title} — ${cms.body}` : cms.title,
        link: undefined as string | undefined,
        type: cms.type || 'info',
        endsAt: (cms.endsAt as string) || null,
      };
    }
    const a = branding?.announcement;
    if (a?.enabled && a.text) {
      return { key: a.text, text: a.text, link: a.link as string | undefined, type: a.type || 'info', endsAt: null };
    }
    return null;
  }, [data, branding?.announcement]);

  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (active) setDismissed(sessionStorage.getItem(`ann:${active.key}`) === '1');
    else setDismissed(true);
  }, [active?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const countdown = useCountdown(active?.endsAt);

  if (!active || dismissed) return null;

  const close = () => {
    sessionStorage.setItem(`ann:${active.key}`, '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={cn('relative z-[55] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-10 py-2 text-center text-sm font-medium', tones[active.type] || tones.info)}
      >
        <span className="inline-flex items-center gap-2">
          <Megaphone className="h-4 w-4 shrink-0" />
          {active.link ? (
            <a href={active.link} className="underline-offset-2 hover:underline">{active.text}</a>
          ) : (
            <span>{active.text}</span>
          )}
        </span>

        {countdown && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-0.5 font-mono text-xs tabular-nums">
            <Clock className="h-3 w-3" />
            {countdown.d > 0 && <span>{countdown.d}d</span>}
            <span>{pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}</span>
          </span>
        )}

        <button onClick={close} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 transition hover:opacity-100" aria-label="Dismiss announcement">
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default AnnouncementBar;
