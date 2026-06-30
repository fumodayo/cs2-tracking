'use client';

import { useToasts, toastStore, type Toast } from '@/stores';
import { CheckCircle2, Loader2, XCircle, Info, X } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[100] flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering container onClick
    if (!toast.action) return;
    setIsActionLoading(true);
    try {
      await toast.action.onClick();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToastClick = (e: React.MouseEvent) => {
    // If the click is inside a button or link, ignore it
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    if (toast.path) {
      router.push(toast.path);
    } else if (toast.onClick) {
      toast.onClick();
    }
  };

  const isClickable = !!(toast.path || toast.onClick);
  const role = toast.type === 'error' ? 'alert' : 'status';
  const ariaLive = toast.type === 'error' ? 'assertive' : 'polite';

  return (
    <motion.div
      role={role}
      aria-live={ariaLive}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      onClick={handleToastClick}
      className={`border-border bg-card/95 shadow-soft pointer-events-auto w-80 rounded-xl border p-4 backdrop-blur-md ${
        isClickable
          ? 'hover:border-accent/40 hover:bg-card/98 cursor-pointer transition-all duration-200 hover:shadow-md'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {toast.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          ) : toast.type === 'error' ? (
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
          ) : toast.type === 'loading' ? (
            <Loader2 className="text-accent mt-0.5 size-5 shrink-0 animate-spin" />
          ) : (
            <Info className="text-accent mt-0.5 size-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-semibold">{toast.title}</p>
            {toast.description && (
              <div className="text-muted-foreground mt-0.5 text-xs">{toast.description}</div>
            )}

            {toast.action && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAction}
                disabled={isActionLoading}
                className="mt-2 h-7 gap-1.5 px-2.5 text-xs"
              >
                {isActionLoading ? (
                  <Loader2 className="text-accent size-3 animate-spin" />
                ) : toast.action.icon ? (
                  toast.action.icon
                ) : null}
                {toast.action.label}
              </Button>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation(); // prevent triggering container onClick
            toastStore.dismiss(toast.id);
          }}
          aria-label={t('common.dismissToast', 'Dismiss notification')}
          className="text-muted-foreground hover:bg-surface-hover hover:text-foreground -mt-1 -mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}
