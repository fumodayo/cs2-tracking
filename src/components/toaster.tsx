"use client";

import { useToasts, toastStore } from "@/utils/toast-store";
import { CheckCircle2, Loader2, XCircle, Info, X } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
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

function ToastItem({ toast }: { toast: any }) {
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleAction = async () => {
    if (!toast.action) return;
    setIsActionLoading(true);
    try {
      await toast.action.onClick();
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="pointer-events-auto w-80 rounded-xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          ) : toast.type === "error" ? (
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
          ) : toast.type === "loading" ? (
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-accent" />
          ) : (
            <Info className="mt-0.5 size-5 shrink-0 text-accent" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{toast.title}</p>
            {toast.description && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {toast.description}
              </div>
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
                  <Loader2 className="size-3 animate-spin text-accent" />
                ) : toast.action.icon ? (
                  toast.action.icon
                ) : null}
                {toast.action.label}
              </Button>
            )}
          </div>
        </div>
        <button
          onClick={() => toastStore.dismiss(toast.id)}
          className="-mt-1 -mr-1 shrink-0 flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}
