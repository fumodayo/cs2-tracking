'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';

import { useTranslation } from 'react-i18next';

interface CopyButtonProps {
  value: string | number;
  className?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'borderless';
  feedbackTrigger?: number;
}

export function CopyButton({
  value,
  className,
  children,
  variant = 'default',
  feedbackTrigger,
}: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFeedbackTriggerRef = useRef(feedbackTrigger);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (feedbackTrigger === undefined || feedbackTrigger === lastFeedbackTriggerRef.current) {
      return;
    }

    lastFeedbackTriggerRef.current = feedbackTrigger;
    setCopied(true);
    setShowTooltip(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setCopied(false);
      setShowTooltip(false);
    }, 1800);
  }, [feedbackTrigger]);

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
    <button
      type="button"
      onClick={handleCopyToClipboard}
      className={cn(
        'group hover:text-foreground relative inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-normal text-stone-400 transition-all select-none active:scale-95',
        className
      )}
      onMouseEnter={() => !copied && setShowTooltip(true)}
      onMouseLeave={() => !copied && setShowTooltip(false)}
    >
      {children}
      <div
        className={cn(
          'relative flex items-center justify-center transition-all',
          variant === 'borderless'
            ? 'size-auto bg-transparent text-stone-400 group-hover:text-stone-200'
            : 'border-stone-850 group-hover:border-stone-750 size-6 rounded-md border bg-stone-900/60 text-stone-500 group-hover:bg-stone-900 group-hover:text-stone-300'
        )}
      >
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

      {/* Chú giải nổi nhỏ cao cấp */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded border border-stone-800/80 bg-stone-950 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-stone-200 shadow-xl',
              copied ? 'border-emerald-500/20 text-emerald-400' : ''
            )}
          >
            {copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
