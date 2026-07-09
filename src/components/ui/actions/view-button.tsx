'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { SlidersHorizontal, Check } from 'lucide-react';
import { Table } from '@tanstack/react-table';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';

import { useTranslation } from 'react-i18next';

interface ViewButtonProps<TData> {
  table: Table<TData>;
  columnLabels?: Record<string, string>;
  className?: string;
}

export function ViewButton<TData>({ table, columnLabels = {}, className }: ViewButtonProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const { t } = useTranslation();

  const labels = React.useMemo(() => {
    const defaultLabels: Record<string, string> = {
      select: t('columns.select', 'Select'),
      actions: t('columns.actions', 'Actions'),
      case: t('columns.case', 'Item'),
      quantity: t('columns.quantity', 'Quantity'),
      price: t('columns.price', 'Unit Price'),
      total: t('columns.total', 'Total Value'),
      rateAll: t('columns.rateAll', 'Wholesale Price'),
      rateLe: t('columns.rateLe', 'Retail Price'),
      buyPrice: t('columns.buyPrice', 'Buy Price'),
      investedValue: t('columns.investedValue', 'Total Cost'),
      currentPrice: t('columns.currentPrice', 'Current Price'),
      wholesaleValue: t('columns.wholesaleValue', 'Wholesale Value'),
      retailValue: t('columns.retailValue', 'Retail Value'),
      profitAmount: t('columns.profitAmount', 'Profit/Loss'),
      profitPercent: t('columns.profitPercent', '% Profit/Loss'),
      updatedAt: t('columns.updatedAt', 'Updated At'),
      scannedAt: t('columns.scannedAt', 'Scanned At'),
      buyDate: t('columns.buyDate', 'Buy Date'),
      buffActualProfit: t('columns.buffActualProfit', 'Profit (Buff)'),
      steamActualProfit: t('columns.steamActualProfit', 'Profit (Steam)'),
    };
    return { ...defaultLabels, ...columnLabels };
  }, [columnLabels, t]);

  const hideableColumns = React.useMemo(() => {
    return table.getAllLeafColumns().filter((column) => column.getCanHide());
  }, [table]);

  if (hideableColumns.length === 0) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className={cn(
            'hover:bg-stone-850 h-8 cursor-pointer gap-1.5 rounded-lg border border-stone-800 bg-stone-900/40 px-3 text-xs font-semibold text-stone-300 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-stone-700 hover:text-stone-100 active:scale-[0.98]',
            className
          )}
        >
          <SlidersHorizontal className="size-3.5 shrink-0 text-stone-500 transition-colors group-hover:text-stone-300" />
          <span>{t('columns.showHide', 'Show/Hide Columns')}</span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="animate-fade-slide-in z-50 w-72 overflow-hidden rounded-xl border border-stone-800 bg-stone-950/95 p-0 text-stone-200 shadow-2xl backdrop-blur-md"
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            <h3 className="border-b border-stone-900 px-3.5 py-2.5 text-xs font-bold text-stone-400">
              {t('columns.toggleTitle', 'Toggle Columns')}
            </h3>

            {/* Danh sách bật/tắt cột */}
            <div
              className="hover:[&::-webkit-scrollbar-thumb]:bg-stone-750 max-h-60 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-track]:bg-transparent"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent',
              }}
            >
              {hideableColumns.map((column) => {
                const isVisible = column.getIsVisible();
                const label = labels[column.id] || column.id;

                return (
                  <Button
                    key={column.id}
                    variant="ghost"
                    onClick={() => column.toggleVisibility(!isVisible)}
                    className="relative flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold text-stone-300 transition-all outline-none select-none hover:bg-stone-900 hover:text-stone-100"
                  >
                    <span className="inline-flex size-4 shrink-0 items-center justify-center">
                      {isVisible && <Check className="text-accent size-3.5" />}
                    </span>
                    <span className="truncate">{label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
