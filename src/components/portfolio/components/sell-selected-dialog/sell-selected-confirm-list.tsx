import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PortfolioTableRow } from '../../portfolio-table-model';

export function SellSelectedConfirmList({
  activeItems,
  isExpanded,
  onToggleExpanded,
  getSellQuantity,
}: {
  activeItems: PortfolioTableRow[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  getSellQuantity: (id: string, maxQuantity: number) => number;
}) {
  const { t } = useTranslation();
  const summaryList = useMemo(() => {
    const summaryMap = new Map<string, number>();
    activeItems.forEach((item) => {
      const currentQty = summaryMap.get(item.case.name) || 0;
      summaryMap.set(item.case.name, currentQty + getSellQuantity(item.id, item.quantity));
    });
    return Array.from(summaryMap.entries()).map(([name, qty]) => ({ name, qty }));
  }, [activeItems, getSellQuantity]);

  if (summaryList.length === 0) {
    return null;
  }

  const visibleList = isExpanded ? summaryList : summaryList.slice(0, 5);
  const remainingCount = summaryList.length - 5;

  return (
    <div className="mt-4 rounded-xl border border-red-500/10 bg-red-950/5 p-4 text-xs">
      <p className="mb-2.5 text-[10px] font-bold tracking-wider text-red-400/90 uppercase">
        {t('portfolio.sellSelectedConfirmListHeader', 'Items to be sold:')}
      </p>
      <div className="space-y-2">
        <ul
          className={`space-y-2 text-stone-300 ${isExpanded ? 'max-h-[200px] scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent overflow-y-auto pr-1.5' : ''}`}
        >
          {visibleList.map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between border-b border-stone-900 pb-1.5 last:border-b-0 last:pb-0"
            >
              <span className="truncate font-semibold text-stone-200">{item.name}</span>
              <span className="ml-2 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[10.5px] font-extrabold text-red-400">
                {item.qty}
              </span>
            </li>
          ))}
        </ul>
        {summaryList.length > 5 && (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="mt-2.5 flex w-full items-center justify-between border-t border-stone-900 pt-2 text-left font-semibold text-stone-400 italic transition-colors hover:text-stone-200"
          >
            <span>
              {isExpanded
                ? t('portfolio.deleteSelectedConfirmListCollapse', 'Collapse list')
                : t(
                    'portfolio.deleteSelectedConfirmListRemaining',
                    '... and {{count}} other items',
                    {
                      count: remainingCount,
                    }
                  )}
            </span>
            <span className="rounded border border-red-500/10 bg-red-500/5 px-2 py-0.5 text-[10px] tracking-wider text-red-400/80 uppercase not-italic hover:bg-red-500/10">
              {isExpanded ? t('common.collapse') : t('common.expand')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
