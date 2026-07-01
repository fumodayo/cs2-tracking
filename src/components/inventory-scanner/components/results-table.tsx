'use client';

import React, { memo, useState, useEffect } from 'react';
import { flexRender, type Table, type Row } from '@tanstack/react-table';
import { RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FilterPopover, ResetButton, ViewButton } from '@/components/ui/actions';
import { TablePagination } from '@/components/shared/table-pagination';
import { cn } from '@/utils/cn';
import type { ScanResultItem } from '../types';
import { Button } from '@/components/ui/button';
import { FaBoxOpen, FaTrashAlt } from 'react-icons/fa';

function ScanResultTableRowComponent({
  row,
  isSelected,
  isLoadingBuff,
  isInspecting,
  hasBuffError,
  isMobile,
  onSelectItem,
}: {
  row: Row<ScanResultItem>;
  isSelected: boolean;
  isLoadingBuff: boolean;
  isInspecting: boolean;
  hasBuffError: boolean;
  isMobile: boolean;
  onSelectItem?: (item: ScanResultItem) => void;
}) {
  const isManual = row.original.isManual;

  // Solid background colors for sticky columns on mobile to prevent transparency when scrolled.
  // These solid background classes are prefixed with max-md: so they ONLY apply on mobile screens,
  // leaving desktop cells transparent (inheriting the row's normal responsive backgrounds).
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
        onSelectItem?.(row.original);
      }}
      className={`group transition-colors ${isMobile ? 'cursor-pointer' : ''} ${
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
        const isSelectCol = cell.column.id === 'select';
        if (isSelectCol && isMobile) return null;
        const isCaseCol = cell.column.id === 'case';
        return (
          <td
            key={cell.id}
            className={cn(
              'py-4 whitespace-nowrap',
              isMobile ? (cell.column.id === 'quantity' ? 'px-0.5' : 'px-1.5') : 'px-5',
              cell.column.id === 'quantity' && isMobile && 'w-[48px] max-w-[48px] min-w-[48px]',
              cell.column.id === 'price' && isMobile && 'w-[110px] max-w-[110px] min-w-[110px]',
              isSelectCol &&
                'text-center max-md:sticky max-md:left-0 max-md:z-10 max-md:w-12 max-md:min-w-[3rem] max-md:px-2',
              isCaseCol &&
                cn(
                  'max-md:sticky max-md:z-10 max-md:max-w-[240px] max-md:min-w-[200px] max-md:border-r max-md:border-stone-800/50 max-md:whitespace-normal',
                  isMobile ? 'max-md:left-0' : 'max-md:left-12'
                ),
              (isSelectCol || isCaseCol) &&
                `max-md:shadow-[2px_0_5px_rgba(0,0,0,0.3)] ${stickyBgClass}`
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
  accountOptions: Array<{ steamId64: string; name: string }>;
  selectedIds: string[];
  setRowSelection: (val: Record<string, boolean>) => void;
  setSellDialogOpen: (open: boolean) => void;
  handleDeleteSelected: () => void;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  buffLoadingKeys?: Set<string>;
  inspectingKeys?: Set<string>;
  buffPriceErrors?: Record<string, string>;
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
  accountOptions,
  selectedIds,
  setRowSelection,
  setSellDialogOpen,
  handleDeleteSelected,
  onRefreshPrices,
  isRefreshingPrices = false,
  buffLoadingKeys = new Set(),
  inspectingKeys = new Set(),
  buffPriceErrors = {},
  isMobile = false,
  onSelectItem,
}: ResultsTableProps) {
  const { t } = useTranslation();

  const [localQuery, setLocalQuery] = useState(globalFilter);

  // Sync local query if global filter changes externally (like reset)
  useEffect(() => {
    setLocalQuery(globalFilter);
  }, [globalFilter]);

  // Debounce calling setGlobalFilter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== globalFilter) {
        setGlobalFilter(localQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, globalFilter, setGlobalFilter]);

  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // Reset visibleCount when filters or query changes
  useEffect(() => {
    setVisibleCount(10);
  }, [globalFilter, selectedTypes, selectedStatuses, selectedAccounts]);

  const allFilteredRows = table.getSortedRowModel().rows;
  const hasMore = visibleCount < allFilteredRows.length;

  useEffect(() => {
    if (!isMobile || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + 10, allFilteredRows.length));
            setIsLoadingMore(false);
          }, 500);
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
  }, [isMobile, hasMore, isLoadingMore, allFilteredRows.length]);

  const displayRows = isMobile ? allFilteredRows.slice(0, visibleCount) : table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
      <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            {!isMobile && (
              <div className="relative inline-flex h-9 shrink-0 items-center rounded-lg border border-stone-800 bg-stone-950 p-1 shadow-sm select-none">
                <button
                  type="button"
                  onClick={() => {
                    setMode('case-summary');
                    table.setPageIndex(0);
                  }}
                  className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 ${
                    mode === 'case-summary'
                      ? 'text-blue-400'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  {mode === 'case-summary' && (
                    <motion.div
                      layoutId="activeTabToolbarScanner"
                      className="absolute inset-0 rounded-md border border-stone-800 bg-stone-900 shadow-md"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t('dashboard.caseSummaryMode', 'Gom')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('transactions');
                    table.setPageIndex(0);
                  }}
                  className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 ${
                    mode === 'transactions'
                      ? 'text-blue-400'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  {mode === 'transactions' && (
                    <motion.div
                      layoutId="activeTabToolbarScanner"
                      className="absolute inset-0 rounded-md border border-stone-800 bg-stone-900 shadow-md"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t('dashboard.viewMode', 'Chi tiết')}</span>
                </button>
              </div>
            )}

            <label className="border-input-border bg-input focus-within:border-ring focus-within:ring-ring flex h-9 min-w-64 items-center gap-2 rounded-md border px-3 text-xs transition-all focus-within:ring-1 max-md:w-full max-md:min-w-0">
              <Search className="text-muted-foreground size-3.5" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                aria-label={t('inventoryScanner.searchPlaceholder')}
                placeholder={t('inventoryScanner.searchPlaceholder')}
                className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs font-medium outline-none"
              />
            </label>
            {onRefreshPrices && (
              <Button
                type="button"
                onClick={onRefreshPrices}
                disabled={isRefreshingPrices}
                className="hover:bg-stone-850 flex h-9 shrink-0 cursor-pointer items-center gap-1.5 border border-stone-800 bg-stone-900/60 px-3 text-xs font-semibold hover:text-stone-200"
                title={t('inventoryScanner.refreshPrices')}
              >
                <RefreshCw
                  className={`size-3.5 text-blue-400 ${isRefreshingPrices ? 'animate-spin' : ''}`}
                />
                <span className="text-stone-300">{t('inventoryScanner.refreshPrices')}</span>
              </Button>
            )}
          </div>
        </div>
        {!isMobile && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <ResetButton
              isVisible={
                selectedTypes.size > 0 || selectedStatuses.length > 0 || selectedAccounts.length > 0
              }
              onReset={() => {
                clearTypeFilters();
                setSelectedStatuses([]);
                setSelectedAccounts([]);
              }}
            />

            <FilterPopover
              label={t('inventoryScanner.itemType')}
              options={[
                { label: t('inventoryScanner.case'), value: 'Case' },
                { label: t('inventoryScanner.stickerCapsule'), value: 'Capsule' },
                { label: t('inventoryScanner.sticker'), value: 'Sticker' },
                { label: t('inventoryScanner.skin'), value: 'Skin' },
              ]}
              selectedValues={Array.from(selectedTypes)}
              onChange={(nextValues) => {
                clearTypeFilters();
                nextValues.forEach((val) => toggleTypeFilter(val));
                table.setPageIndex(0);
              }}
            />

            <FilterPopover
              label={t('inventoryScanner.status')}
              options={[
                {
                  label: t('inventoryScanner.tradeable'),
                  value: 'tradeable',
                  icon: ({ className }) => (
                    <span className={cn('size-2 rounded-full bg-emerald-500', className)} />
                  ),
                },
                {
                  label: t('inventoryScanner.onMarket'),
                  value: 'market',
                  icon: ({ className }) => (
                    <span className={cn('size-2 rounded-full bg-amber-500', className)} />
                  ),
                },
                {
                  label: t('inventoryScanner.tradeProtected'),
                  value: 'protected',
                  icon: ({ className }) => (
                    <span className={cn('size-2 rounded-full bg-blue-500', className)} />
                  ),
                },
                {
                  label: t('inventoryScanner.hold'),
                  value: 'hold',
                  icon: ({ className }) => (
                    <span className={cn('size-2 rounded-full bg-red-500', className)} />
                  ),
                },
              ]}
              selectedValues={selectedStatuses}
              onChange={(nextValues) => {
                setSelectedStatuses(nextValues);
                table.setPageIndex(0);
              }}
            />

            <FilterPopover
              label={t('inventoryScanner.account')}
              options={accountOptions.map((account) => ({
                label: account.name,
                value: account.steamId64,
              }))}
              selectedValues={selectedAccounts}
              onChange={(nextValues) => {
                setSelectedAccounts(nextValues);
                table.setPageIndex(0);
              }}
              disabled={accountOptions.length === 0}
            />

            <ViewButton table={table} />
          </div>
        )}
      </div>

      {/* Mobile Horizontal Filter Chips */}
      {isMobile && (
        <div className="flex flex-col gap-2 border-b border-stone-800 bg-stone-900/60 py-2.5">
          {/* Row 1: Item Type */}
          <div className="flex scrollbar-none gap-2 overflow-x-auto px-3">
            {[
              { label: t('inventoryScanner.case'), value: 'Case' },
              { label: t('inventoryScanner.stickerCapsule'), value: 'Capsule' },
              { label: t('inventoryScanner.sticker'), value: 'Sticker' },
              { label: t('inventoryScanner.skin'), value: 'Skin' },
            ].map((opt) => {
              const isActive = selectedTypes.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    toggleTypeFilter(opt.value);
                    table.setPageIndex(0);
                  }}
                  className={cn(
                    'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full border px-3.5 text-xs font-semibold transition-all select-none',
                    isActive
                      ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-400'
                      : 'border-stone-850 bg-stone-950 text-stone-400 hover:text-stone-300'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Row 2: Status */}
          <div className="flex scrollbar-none gap-2 overflow-x-auto px-3">
            {[
              {
                label: t('inventoryScanner.tradeable'),
                value: 'tradeable',
                colorClass: 'bg-emerald-500',
              },
              {
                label: t('inventoryScanner.onMarket'),
                value: 'market',
                colorClass: 'bg-amber-500',
              },
              {
                label: t('inventoryScanner.tradeProtected'),
                value: 'protected',
                colorClass: 'bg-blue-500',
              },
              { label: t('inventoryScanner.hold'), value: 'hold', colorClass: 'bg-red-500' },
            ].map((opt) => {
              const isActive = selectedStatuses.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = isActive
                      ? selectedStatuses.filter((v) => v !== opt.value)
                      : [...selectedStatuses, opt.value];
                    setSelectedStatuses(next);
                    table.setPageIndex(0);
                  }}
                  className={cn(
                    'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-all select-none',
                    isActive
                      ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-400'
                      : 'border-stone-850 bg-stone-950 text-stone-400 hover:text-stone-300'
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', opt.colorClass)} />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Row 3: Account */}
          {accountOptions.length > 0 && (
            <div className="flex scrollbar-none gap-2 overflow-x-auto px-3">
              {accountOptions.map((opt) => {
                const isActive = selectedAccounts.includes(opt.steamId64);
                return (
                  <button
                    key={opt.steamId64}
                    type="button"
                    onClick={() => {
                      const next = isActive
                        ? selectedAccounts.filter((v) => v !== opt.steamId64)
                        : [...selectedAccounts, opt.steamId64];
                      setSelectedAccounts(next);
                      table.setPageIndex(0);
                    }}
                    className={cn(
                      'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full border px-3.5 text-xs font-semibold transition-all select-none',
                      isActive
                        ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-400'
                        : 'border-stone-850 bg-stone-950 text-stone-400 hover:text-stone-300'
                    )}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Clear Filters Button (If any active) */}
          {(selectedTypes.size > 0 ||
            selectedStatuses.length > 0 ||
            selectedAccounts.length > 0) && (
            <div className="px-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  clearTypeFilters();
                  setSelectedStatuses([]);
                  setSelectedAccounts([]);
                  table.setPageIndex(0);
                }}
                className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10"
              >
                {t('common.clearAll', 'Xóa bộ lọc')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="border-stone-850 animate-fade-slide-in flex items-center justify-between border-b bg-stone-900/90 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-stone-300">
              Đã chọn {selectedIds.length} vật phẩm
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="hover:bg-stone-850 inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-stone-800 bg-stone-900/60 px-3 text-xs font-semibold text-stone-400 transition-all hover:border-stone-700 hover:text-stone-200"
            >
              Hủy chọn
            </button>
            <button
              type="button"
              onClick={() => setSellDialogOpen(true)}
              className="bg-accent hover:bg-accent-hover shadow-accent/25 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-bold text-slate-950 shadow-md transition-all active:scale-95"
            >
              <FaBoxOpen className="size-3.5" />
              <span>Bán ({selectedIds.length})</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-3.5 text-xs font-bold text-red-400 shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-300 active:scale-95"
            >
              <FaTrashAlt className="size-3" />
              <span>Xóa ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-stone-300">
          <thead className="bg-stone-900/80 text-xs text-stone-400 uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSelectCol = header.column.id === 'select';
                  if (isSelectCol && isMobile) return null;
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
                        header.column.id !== 'case' && header.column.id !== 'select'
                          ? 'text-right'
                          : '',
                        header.column.id === 'quantity' &&
                          isMobile &&
                          'w-[48px] max-w-[48px] min-w-[48px]',
                        header.column.id === 'price' &&
                          isMobile &&
                          'w-[110px] max-w-[110px] min-w-[110px]',
                        isSelectCol &&
                          'text-center max-md:sticky max-md:left-0 max-md:z-20 max-md:w-12 max-md:min-w-[3rem] max-md:bg-stone-900 max-md:px-2',
                        isCaseCol &&
                          cn(
                            'max-md:sticky max-md:z-20 max-md:max-w-[240px] max-md:min-w-[200px] max-md:border-r max-md:border-stone-800/50 max-md:bg-stone-900 max-md:whitespace-normal',
                            isMobile ? 'max-md:left-0' : 'max-md:left-12'
                          ),
                        (isSelectCol || isCaseCol) && 'max-md:shadow-[2px_0_5px_rgba(0,0,0,0.3)]'
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
                const marketHashName = row.original.caseItem.marketHashName;
                return (
                  <ScanResultTableRowComponent
                    key={row.id}
                    row={row}
                    isSelected={row.getIsSelected()}
                    isLoadingBuff={buffLoadingKeys.has(marketHashName)}
                    isInspecting={inspectingKeys.has(marketHashName)}
                    hasBuffError={!!buffPriceErrors[marketHashName]}
                    isMobile={isMobile}
                    onSelectItem={onSelectItem}
                  />
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={
                    isMobile ? table.getAllColumns().length - 1 : table.getAllColumns().length
                  }
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
              <span className="text-xs font-medium">Đang tải thêm...</span>
            </div>
          ) : (
            <div className="h-5" />
          )}
        </div>
      )}

      {!isMobile && (
        <TablePagination table={table} unit={t('inventoryScanner.itemUnit', 'vật phẩm')} />
      )}
    </div>
  );
}
