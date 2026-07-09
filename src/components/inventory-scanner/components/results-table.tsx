'use client';

import { flexRender, type Table, type Row } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TablePagination } from '@/components/shared/table-pagination';
import { cn } from '@/utils/cn';
import type { ScanResultItem } from '../types';
import { useResultsTableState } from './use-results-table-state';
import { ResultsTableBulkActions } from './results-table-bulk-actions';
import { ResultsTableToolbar } from './results-table-toolbar';

function ScanResultTableRowComponent({
  row,
  isSelected,
  isMobile,
  onSelectItem,
}: {
  row: Row<ScanResultItem>;
  isSelected: boolean;
  isMobile: boolean;
  onSelectItem?: (item: ScanResultItem) => void;
}) {
  const isManual = row.original.isManual;

  // Dùng nền đặc cho cột sticky trên mobile để tránh trong suốt khi cuộn.
  // Các class nền đặc này có tiền tố max-md: nên CHỈ áp dụng trên màn hình mobile,
  // giữ ô desktop trong suốt và kế thừa nền responsive bình thường của dòng.
  const stickyBgClass = isManual
    ? isSelected
      ? 'max-md:bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))]'
      : 'max-md:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] group-hover:max-md:bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))]'
    : isSelected
      ? 'max-md:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))]'
      : 'max-md:bg-stone-900 group-hover:max-md:bg-surface-hover';

  return (
    <tr
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest('button') ||
          target.closest('input') ||
          target.closest('a') ||
          target.closest('svg')
        ) {
          return;
        }
        onSelectItem?.(row.original);
      }}
      className={`group cursor-pointer transition-colors ${
        isManual
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
              'py-4 whitespace-nowrap',
              isMobile ? (cell.column.id === 'quantity' ? 'px-0.5' : 'px-1.5') : 'px-5',
              cell.column.id === 'quantity' && isMobile && 'w-[48px] max-w-[48px] min-w-[48px]',
              cell.column.id === 'price' && isMobile && 'w-[120px] max-w-[120px] min-w-[120px]',
              isCaseCol &&
                cn(
                  'max-md:sticky max-md:left-0 max-md:z-10 max-md:max-w-[240px] max-md:min-w-[200px] max-md:border-r max-md:border-stone-800/50 max-md:whitespace-normal',
                  `max-md:shadow-[2px_0_5px_rgba(0,0,0,0.3)] ${stickyBgClass}`
                )
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}

interface ResultsTableProps {
  mode: 'case-summary' | 'transactions';
  setMode: (mode: 'case-summary' | 'transactions') => void;
  table: Table<ScanResultItem>;
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  selectedTypes: Set<string>;
  clearTypeFilters: () => void;
  toggleTypeFilter: (val: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (val: string[]) => void;
  selectedAccounts: string[];
  setSelectedAccounts: (val: string[]) => void;
  selectedSourceFilters: string[];
  setSelectedSourceFilters: (val: string[]) => void;
  selectedPriceSourceFilters: string[];
  setSelectedPriceSourceFilters: (val: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  selectedIds: string[];
  setRowSelection: (val: Record<string, boolean>) => void;
  setSellDialogOpen: (open: boolean) => void;
  handleDeleteSelected: () => void;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  isMobile?: boolean;
  onSelectItem?: (item: ScanResultItem) => void;
}

export function ResultsTable({
  mode,
  setMode,
  table,
  globalFilter,
  setGlobalFilter,
  selectedTypes,
  clearTypeFilters,
  toggleTypeFilter,
  selectedStatuses,
  setSelectedStatuses,
  selectedAccounts,
  setSelectedAccounts,
  selectedSourceFilters = [],
  setSelectedSourceFilters,
  selectedPriceSourceFilters = [],
  setSelectedPriceSourceFilters,
  accountOptions,
  selectedIds,
  setRowSelection,
  setSellDialogOpen,
  handleDeleteSelected,
  onRefreshPrices,
  isRefreshingPrices = false,
  isMobile = false,
  onSelectItem,
}: ResultsTableProps) {
  const { t } = useTranslation();

  const {
    localQuery,
    setLocalQuery,
    displayRows,
    sentinelRef,
    isLoadingMore,
    canSelectMoreFiltered,
    hasMore,
    hasActiveFilters,
    handleSelectAllFiltered,
  } = useResultsTableState({
    table,
    globalFilter,
    setGlobalFilter,
    selectedTypes,
    selectedStatuses,
    selectedAccounts,
    selectedSourceFilters,
    selectedPriceSourceFilters,
    setRowSelection,
    isMobile,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
      <ResultsTableToolbar
        mode={mode}
        setMode={setMode}
        table={table}
        localQuery={localQuery}
        setLocalQuery={setLocalQuery}
        setGlobalFilter={setGlobalFilter}
        selectedTypes={selectedTypes}
        clearTypeFilters={clearTypeFilters}
        toggleTypeFilter={toggleTypeFilter}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedAccounts={selectedAccounts}
        setSelectedAccounts={setSelectedAccounts}
        selectedSourceFilters={selectedSourceFilters}
        setSelectedSourceFilters={setSelectedSourceFilters}
        selectedPriceSourceFilters={selectedPriceSourceFilters}
        setSelectedPriceSourceFilters={setSelectedPriceSourceFilters}
        accountOptions={accountOptions}
        onRefreshPrices={onRefreshPrices}
        isRefreshingPrices={isRefreshingPrices}
        isMobile={isMobile}
        hasActiveFilters={hasActiveFilters}
      />
      <ResultsTableBulkActions
        selectedCount={selectedIds.length}
        canSelectMoreFiltered={canSelectMoreFiltered}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClearSelection={() => setRowSelection({})}
        onSellSelected={() => setSellDialogOpen(true)}
        onDeleteSelected={handleDeleteSelected}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-stone-300 max-md:min-w-[450px]">
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
                        header.column.id !== 'case' ? 'text-right' : '',
                        header.column.id === 'quantity' &&
                          isMobile &&
                          'w-[48px] max-w-[48px] min-w-[48px]',
                        header.column.id === 'price' &&
                          isMobile &&
                          'w-[120px] max-w-[120px] min-w-[120px]',
                        isCaseCol &&
                          cn(
                            'max-md:sticky max-md:left-0 max-md:z-20 max-md:max-w-[240px] max-md:min-w-[200px] max-md:border-r max-md:border-stone-800/50 max-md:bg-stone-900 max-md:whitespace-normal',
                            'max-md:shadow-[2px_0_5px_rgba(0,0,0,0.3)]'
                          )
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
          <tbody className="divide-y divide-stone-800">
            {displayRows.length > 0 ? (
              displayRows.map((row) => {
                return (
                  <ScanResultTableRowComponent
                    key={row.id}
                    row={row}
                    isSelected={row.getIsSelected()}
                    isMobile={isMobile}
                    onSelectItem={onSelectItem}
                  />
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-5 py-8 text-center text-stone-500"
                >
                  {t('inventoryScanner.noResultsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sentinel for Infinite Scroll on mobile */}
      {isMobile && hasMore && (
        <div
          ref={sentinelRef}
          className="border-stone-850 flex justify-center border-t bg-stone-900/10 py-6"
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-stone-400">
              <Loader2 className="size-5 animate-spin text-blue-500" />
              <span className="text-xs font-medium">Äang táº£i thÃªm...</span>
            </div>
          ) : (
            <div className="h-5" />
          )}
        </div>
      )}

      {!isMobile && (
        <TablePagination table={table} unit={t('inventoryScanner.itemUnit', 'váº­t pháº©m')} />
      )}
    </div>
  );
}
