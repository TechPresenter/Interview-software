'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * Confirmation gate for destructive or irreversible actions.
 *
 * Deliberately makes the consequence explicit in `description` rather than
 * asking a bare "Are you sure?" — the useful thing to tell someone is what
 * happens if they say yes.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" magnetic={false} onClick={onClose}>{cancelLabel}</Button>
          <Button
            magnetic={false}
            loading={loading}
            onClick={onConfirm}
            className={danger ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </span>
        )}
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
