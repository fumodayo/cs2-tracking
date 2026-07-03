import { useEffect, useRef, useState } from 'react';
import { flexRender, type Table, type Row } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PortfolioTableRow } from '../portfolio-table-model';
import { cn } from '@/utils/cn';

interface PortfolioTableBodyProps {
  table: Table<PortfolioTableRow>;
  isMobile?: boolean;
}

function PortfolioTableRowComponent({
  row,
  isSelected,
  isMobile,
}: {
  row: Row<PortfolioTableRow>;
  isSelected: boolean;
  isMobile: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextSibling = e.currentTarget.nextElementSibling as HTMLTableRowElement | null;
      if (nextSibling) {
        nextSibling.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevSibling = e.currentTarget.previousElementSibling as HTMLTableRowElement | null;
      if (prevSibling) {
        prevSibling.focus();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const editButton = e.currentTarget.querySelector(
        'button[data-portfolio-item-details="true"]'
      ) as HTMLButtonElement | null;
      if (editButton) {
        editButton.click();
      }
    }
  };

  const handleMobileOpen = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (!isMobile) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('svg')
    ) {
      return;
    }

    const detailsButton = e.currentTarget.querySelector(
      'button[data-portfolio-item-details="true"]'
    ) as HTMLButtonElement | null;
    detailsButton?.click();
  };

  const stickyBgClass =
    row.original.sourceType === 'manual'
      ? isSelected
        ? 'max-md:bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))]'
        : 'max-md:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] group-hover:max-md:bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))]'
      : isSelected
        ? 'max-md:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))]'
        : 'max-md:bg-stone-900 group-hover:max-md:bg-surface-hover';

  return (
    <tr
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleMobileOpen}
      className={`group focus:ring-accent/40 transition-colors outline-none focus:bg-stone-800/80 focus:ring-1 ${isMobile ? 'cursor-pointer' : ''} ${
        row.original.sourceType === 'manual'
          ? isSelected
            ? 'border-l-2 border-l-blue-500 bg-blue-500/[0.08]'
            : 'border-l-2 border-l-blue-500 bg-blue-500/[0.04] hover:bg-blue-500/[0.08]'
          : isSelected
            ? 'bg-blue-500/[0.04]'
            : 'hover:bg-surface-hover'
      }`}
    >
      {row.getVisibleCells().map((cell) => {
        const isCaseCol = cell.column.id === 'case';

        return (
          <td
            key={cell.id}
            className={cn(
              'py-4 align-middle whitespace-nowrap',
              isMobile ? (cell.column.id === 'quantity' ? 'px-0.5' : 'px-1.5') : 'px-5',
              isCaseCol &&
                cn(
                  'max-md:sticky max-md:left-0 max-md:z-10 max-md:max-w-[240px] max-md:min-w-[200px] max-md:border-r max-md:border-stone-800/50 max-md:whitespace-normal',
                  `max-md:shadow-[2px_0_5px_rgba(0,0,0,0.18)] ${stickyBgClass}`
                ),
              cell.column.id === 'quantity' && isMobile && 'w-[48px] max-w-[48px] min-w-[48px]',
              (cell.column.id === 'buyPrice' || cell.column.id === 'currentPrice') &&
                isMobile &&
                'w-[112px] max-w-[112px] min-w-[112px]',
              cell.column.id === 'profitPercent' &&
                isMobile &&
                'w-[72px] max-w-[72px] min-w-[72px]',
              !isCaseCol && 'text-right'
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}

export function PortfolioTableBody({ table, isMobile = false }: PortfolioTableBodyProps) {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const tableState = table.getState();
  const allFilteredRows = table.getSortedRowModel().rows;
  const displayRows = isMobile ? allFilteredRows.slice(0, visibleCount) : table.getRowModel().rows;
  const hasMore = isMobile && visibleCount < allFilteredRows.length;

  useEffect(() => {
    setVisibleCount(10);
  }, [
    tableState.globalFilter,
    tableState.sorting,
    tableState.columnVisibility,
    allFilteredRows.length,
  ]);

  useEffect(() => {
    if (!isMobile || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsLoadingMore(true);
          window.setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + 10, allFilteredRows.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [allFilteredRows.length, hasMore, isLoadingMore, isMobile]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-stone-300">
          <thead className="bg-stone-900/80 text-xs text-stone-400 uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isCaseCol = header.column.id === 'case';

                  return (
                    <th
                      key={header.id}
                      aria-sort={
                        header.column.getCanSort()
                          ? header.column.getIsSorted() === 'asc'
                            ? 'ascending'
                            : header.column.getIsSorted() === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      className={cn(
                        'py-3 font-medium whitespace-nowrap',
                        isMobile ? (header.column.id === 'quantity' ? 'px-0.5' : 'px-1.5') : 'px-5',
                        isCaseCol &&
                          cn(
                            'max-md:sticky max-md:left-0 max-md:z-20 max-md:max-w-[240px] max-md:min-w-[200px] max-md:border-r max-md:border-stone-800/50 max-md:bg-stone-900 max-md:whitespace-normal',
                            'max-md:shadow-[2px_0_5px_rgba(0,0,0,0.18)]'
                          ),
                        header.column.id === 'quantity' &&
                          isMobile &&
                          'w-[48px] max-w-[48px] min-w-[48px]',
                        (header.column.id === 'buyPrice' || header.column.id === 'currentPrice') &&
                          isMobile &&
                          'w-[112px] max-w-[112px] min-w-[112px]',
                        header.column.id === 'profitPercent' &&
                          isMobile &&
                          'w-[72px] max-w-[72px] min-w-[72px]',
                        !isCaseCol && 'text-right'
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-stone-800 bg-stone-900/20">
            {displayRows.length > 0 ? (
              displayRows.map((row) => (
                <PortfolioTableRowComponent
                  key={row.id}
                  row={row}
                  isSelected={row.getIsSelected()}
                  isMobile={isMobile}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-5 py-8 text-center text-stone-500"
                >
                  {t('portfolio.noItemsFound', 'No items found.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div
          ref={sentinelRef}
          className="border-stone-850 flex justify-center border-t bg-stone-900/10 py-6"
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-stone-400">
              <Loader2 className="text-accent size-5 animate-spin" />
              <span className="text-xs font-medium">
                {t('common.loadingMore', 'Loading more...')}
              </span>
            </div>
          ) : (
            <div className="h-5" />
          )}
        </div>
      )}
    </>
  );
}
