'use client';

import { Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PortfolioBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onSellSelected: () => void;
  onDeleteSelected: () => void;
  isDeletingMany?: boolean;
}

export function PortfolioBulkActions({
  selectedCount,
  onClearSelection,
  onSellSelected,
  onDeleteSelected,
  isDeletingMany = false,
}: PortfolioBulkActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-slide-in flex items-center justify-between border-b border-red-500/20 bg-red-950/10 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-400">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-stone-300">
          {t('portfolio.selected', 'selected')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="border-stone-850 inline-flex h-8 cursor-pointer items-center justify-center rounded-md border bg-stone-900/60 px-3 text-xs font-semibold text-stone-400 transition-all hover:bg-stone-900 hover:text-stone-200"
        >
          {t('portfolio.deselectAll', 'Deselect')}
        </button>
        <button
          type="button"
          onClick={onSellSelected}
          className="bg-accent hover:bg-accent-hover text-accent-foreground shadow-accent/20 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-bold shadow-md transition-all"
        >
          <ShoppingBag className="size-3" />
          <span>{t('portfolio.sellSelected', 'Sell Selected')}</span>
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={isDeletingMany}
          className="bg-red-650 hover:bg-red-750 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-bold text-white shadow-md shadow-red-950/20 transition-all disabled:cursor-wait disabled:opacity-50"
        >
          {isDeletingMany ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3 text-red-200" />
          )}
          <span>{t('portfolio.deleteSelected', 'Delete Selected')}</span>
        </button>
      </div>
    </div>
  );
}
