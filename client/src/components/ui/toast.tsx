'use client';

import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helpers. */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const tones = {
  success: 'text-accent',
  error: 'text-destructive',
  info: 'text-sky-400',
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              onClick={() => dismiss(t.id)}
              className="glass pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl p-4 text-sm"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tones[t.type]}`} />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default Toaster;
