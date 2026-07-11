'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  children,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && !val && onClose()}>
      <DialogContent className="max-w-md border-stone-800 bg-stone-950 text-stone-100 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <DialogHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            {variant === 'danger' && (
              <div className="border-danger-border bg-danger-muted text-danger flex size-9 shrink-0 items-center justify-center rounded-lg border">
                <AlertTriangle className="size-5" />
              </div>
            )}
            <DialogTitle className="text-lg font-bold tracking-wide text-stone-100">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-stone-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        {children}

        <div className="mt-6 flex justify-end gap-2.5">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="border border-stone-800 bg-stone-900/40 font-semibold text-stone-400 hover:bg-stone-900 hover:text-stone-200"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={loading}
            className="relative font-bold"
          >
            {loading && <Loader2 className="mr-1.5 size-4 animate-spin text-current" />}
            <span>{confirmText}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
