'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Accessible-ish animated dialog with a glass surface and backdrop blur. */
export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="glass relative z-10 w-full max-w-lg rounded-2xl p-6"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {title && <h2 className="text-xl font-bold">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <div className="mt-5 max-h-[60vh] overflow-y-auto pr-1">{children}</div>
            {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Modal;
