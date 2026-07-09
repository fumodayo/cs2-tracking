/* eslint-disable react-refresh/only-export-components */
'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export const SlidePanel = DialogPrimitive.Root;
export const SlidePanelTrigger = DialogPrimitive.Trigger;
export const SlidePanelClose = DialogPrimitive.Close;

interface SlidePanelContentProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> {
  title?: ReactNode;
  description?: string;
  footer?: ReactNode;
  hideHeader?: boolean;
  noPadding?: boolean;
  side?: 'left' | 'right';
  showOverlay?: boolean;
}

export function SlidePanelContent({
  children,
  className,
  title,
  description,
  footer,
  hideHeader = false,
  noPadding = false,
  side = 'right',
  showOverlay = true,
  ...props
}: SlidePanelContentProps) {
  return (
    <DialogPrimitive.Portal>
      {showOverlay && (
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
      )}
      <DialogPrimitive.Content
        className={cn(
          'data-[state=open]:animate-in data-[state=closed]:animate-out bg-card fixed inset-y-0 z-50 flex h-full w-full max-w-lg flex-col shadow-2xl duration-250 outline-none',
          side === 'left'
            ? 'border-border data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left left-0 border-r'
            : 'border-border data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right right-0 border-l',
          className
        )}
        aria-describedby={undefined}
        {...props}
      >
        {hideHeader ? (
          <DialogPrimitive.Title className="sr-only">{title || 'Panel'}</DialogPrimitive.Title>
        ) : (
          /* Phần đầu */
          <div className="border-border flex shrink-0 items-center justify-between border-b px-6 py-4">
            <div className="min-w-0 pr-6">
              {title && (
                <DialogPrimitive.Title className="text-foreground truncate text-lg font-semibold">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-muted-foreground mt-1 truncate text-xs">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="rounded-lg">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
        )}

        {hideHeader && (
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="border-stone-850 absolute top-4 right-4 z-50 cursor-pointer rounded-lg border bg-stone-900/60 text-stone-400 shadow-md hover:bg-stone-900/90 hover:text-stone-100"
            >
              <X className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        )}

        {/* Nội dung */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', noPadding ? '' : 'p-6')}>
          {children}
        </div>

        {/* Phần cuối */}
        {footer && (
          <div className="border-border bg-surface/20 shrink-0 border-t px-6 py-4">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
