import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FaBoxOpen, FaTrashAlt } from 'react-icons/fa';

type ResultsTableBulkActionsProps = {
  selectedCount: number;
  canSelectMoreFiltered: boolean;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onSellSelected: () => void;
  onDeleteSelected: () => void;
};

export function ResultsTableBulkActions({
  selectedCount,
  canSelectMoreFiltered,
  onSelectAllFiltered,
  onClearSelection,
  onSellSelected,
  onDeleteSelected,
}: ResultsTableBulkActionsProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="border-stone-850 animate-fade-slide-in flex flex-col gap-3 border-b bg-stone-900/90 p-3 md:flex-row md:items-center md:justify-between md:px-4 md:py-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold whitespace-nowrap text-stone-300">
          {t('portfolio.selectedItemsCount', 'Da chon {{count}} vat pham', {
            count: selectedCount,
          })}
        </span>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        {canSelectMoreFiltered && (
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="hover:bg-stone-850 inline-flex h-8 flex-grow cursor-pointer items-center justify-center gap-1.5 rounded-md border border-blue-500/25 bg-blue-500/10 px-3 text-xs font-semibold whitespace-nowrap text-blue-300 transition-all hover:border-blue-500/40 hover:text-blue-200 md:flex-grow-0"
            title={t(
              'portfolio.selectAllFilteredTooltip',
              'Select all items matching the current filters'
            )}
          >
            <ListChecks className="size-3.5" />
            {t('portfolio.selectAllRows', 'Chon tat ca')}
          </button>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className="hover:bg-stone-850 inline-flex h-8 flex-grow cursor-pointer items-center justify-center rounded-md border border-stone-800 bg-stone-900/60 px-3 text-xs font-semibold whitespace-nowrap text-stone-400 transition-all hover:border-stone-700 hover:text-stone-200 md:flex-grow-0"
        >
          {t('common.cancelSelection', 'Huy chon')}
        </button>
        <button
          type="button"
          onClick={onSellSelected}
          className="inline-flex h-8 flex-grow cursor-pointer items-center justify-center gap-1.5 rounded-md bg-blue-500 px-3.5 text-xs font-bold whitespace-nowrap text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-600 active:scale-95 md:flex-grow-0"
        >
          <FaBoxOpen className="size-3.5" />
          <span>{t('portfolio.sellCount', 'Ban ({{count}})', { count: selectedCount })}</span>
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          className="inline-flex h-8 flex-grow cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-3.5 text-xs font-bold whitespace-nowrap text-red-400 shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-300 active:scale-95 md:flex-grow-0"
        >
          <FaTrashAlt className="size-3" />
          <span>{t('common.deleteCount', 'Xoa ({{count}})', { count: selectedCount })}</span>
        </button>
      </div>
    </div>
  );
}
