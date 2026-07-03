'use client';

import { ListChecks, Loader2 } from 'lucide-react';
import { FaBoxOpen, FaTrashAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

interface PortfolioBulkActionsProps {
  selectedCount: number;
  selectedFilteredCount: number;
  totalFilteredCount: number;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onSellSelected: () => void;
  onDeleteSelected: () => void;
  isDeletingMany?: boolean;
}

export function PortfolioBulkActions({
  selectedCount,
  selectedFilteredCount,
  totalFilteredCount,
  onSelectAllFiltered,
  onClearSelection,
  onSellSelected,
  onDeleteSelected,
  isDeletingMany = false,
}: PortfolioBulkActionsProps) {
  const { t } = useTranslation();
  const canSelectMoreFiltered =
    totalFilteredCount > 0 && selectedFilteredCount < totalFilteredCount;

  return (
    <div className="border-stone-850 animate-fade-slide-in flex items-center justify-between border-b bg-stone-900/90 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-stone-300">
          {t('portfolio.selectedItems', 'Đã chọn {{count}} vật phẩm', {
            count: selectedCount,
          })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {canSelectMoreFiltered && (
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="hover:bg-stone-850 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-blue-500/25 bg-blue-500/10 px-3 text-xs font-semibold text-blue-300 transition-all hover:border-blue-500/40 hover:text-blue-200"
            title={t(
              'portfolio.selectAllFilteredTooltip',
              'Select all items matching the current filters'
            )}
          >
            <ListChecks className="size-3.5" />
            {t('portfolio.selectAllRows', 'Chọn tất cả')}
          </button>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className="hover:bg-stone-850 inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-stone-800 bg-stone-900/60 px-3 text-xs font-semibold text-stone-400 transition-all hover:border-stone-700 hover:text-stone-200"
        >
          {t('portfolio.deselectAll', 'Hủy chọn')}
        </button>
        <button
          type="button"
          onClick={onSellSelected}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-blue-500 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-600 active:scale-95"
        >
          <FaBoxOpen className="size-3.5" />
          <span>{t('portfolio.sellCount', 'Bán ({{count}})', { count: selectedCount })}</span>
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={isDeletingMany}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-3.5 text-xs font-bold text-red-400 shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-300 active:scale-95 disabled:cursor-wait disabled:opacity-50"
        >
          {isDeletingMany ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <FaTrashAlt className="size-3" />
          )}
          <span>{t('portfolio.deleteCount', 'Xóa ({{count}})', { count: selectedCount })}</span>
        </button>
      </div>
    </div>
  );
}
