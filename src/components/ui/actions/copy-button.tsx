"use client";

import React, { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface CopyButtonProps {
  value: string | number;
  className?: string;
  children?: React.ReactNode;
}

export function CopyButton({ value, className, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;

    navigator.clipboard.writeText(value.toString());
    setCopied(true);
    setShowTooltip(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setCopied(false);
      setShowTooltip(false);
    }, 1800);
  };

  return (
    <div
      onClick={handleCopyToClipboard}
      className={cn(
        "group relative inline-flex cursor-pointer items-center gap-1 transition-all select-none hover:text-foreground active:scale-95",
        className,
      )}
      onMouseEnter={() => !copied && setShowTooltip(true)}
      onMouseLeave={() => !copied && setShowTooltip(false)}
    >
      {children}
      <div className="border-stone-850 group-hover:border-stone-750 relative flex size-6 items-center justify-center rounded-md border bg-stone-900/60 text-stone-500 transition-all group-hover:bg-stone-900 group-hover:text-stone-300">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="size-3 font-bold text-emerald-400" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Copy className="size-3 transition-transform group-hover:scale-105" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Premium Micro Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded border border-stone-800/80 bg-stone-950 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-stone-200 shadow-xl",
              copied ? "border-emerald-500/20 text-emerald-400" : "",
            )}
          >
            {copied ? "Đã sao chép!" : "Sao chép"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
