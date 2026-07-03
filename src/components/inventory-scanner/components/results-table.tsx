'use client';

import React, { useState, useEffect } from 'react';
import { flexRender, type Table, type Row } from '@tanstack/react-table';
import { ListChecks, RefreshCw, Search, Loader2, X } from 'lucide-react';
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
  isMobile,
  onSelectItem,
}: {
  row: Row<ScanResultItem>;
  isSelected: boolean;
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
              cell.column.id === 'price' && isMobile && 'w-[110px] max-w-[110px] min-w-[110px]',
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

function ChipButton({
  label,
  active,
  onClick,
  colorClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-all select-none',
        active
          ? 'border-accent bg-accent/10 text-accent font-bold'
          : 'border-stone-850 bg-stone-950 text-stone-400 hover:text-stone-300'
      )}
    >
      {colorClass ? <span className={cn('size-1.5 rounded-full', colorClass)} /> : null}
      {label}
    </button>
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
  }, [
    globalFilter,
    selectedTypes,
    selectedStatuses,
    selectedAccounts,
    selectedSourceFilters,
    selectedPriceSourceFilters,
  ]);

  const allFilteredRows = table.getSortedRowModel().rows;
  const filteredRowCount = allFilteredRows.length;
  const selectedFilteredCount = allFilteredRows.filter((row) => row.getIsSelected()).length;
  const hasSelectableRows = filteredRowCount > 0;
  const canSelectMoreFiltered = hasSelectableRows && selectedFilteredCount < filteredRowCount;
  const handleSelectAllFiltered = () => {
    const nextSelection: Record<string, boolean> = {};
    for (const row of allFilteredRows) {
      nextSelection[row.id] = true;
    }
    setRowSelection(nextSelection);
  };
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

  const hasActiveFilters =
    selectedSourceFilters.length > 0 ||
    selectedTypes.size > 0 ||
    selectedAccounts.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedPriceSourceFilters.length > 0;

  const clearAllFilters = () => {
    setSelectedSourceFilters([]);
    clearTypeFilters();
    setSelectedAccounts([]);
    setSelectedStatuses([]);
    setSelectedPriceSourceFilters([]);
    table.setPageIndex(0);
  };

  const toggleValue = (values: string[], value: string) => {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  };

  const itemTypeOptions = [
    { label: t('inventoryScanner.case'), value: 'Case' },
    { label: t('inventoryScanner.stickerCapsule'), value: 'Capsule' },
    { label: t('inventoryScanner.sticker'), value: 'Sticker' },
    { label: t('inventoryScanner.skin'), value: 'Skin' },
  ];

  const sourceOptions = [
    { label: t('portfolio.sourceManual', 'Manual'), value: 'manual' },
    { label: t('portfolio.sourceExisting', 'Existing'), value: 'existing' },
  ];

  const statusOptions = [
    {
      label: t('inventoryScanner.tradeable'),
      value: 'tradeable',
      colorClass: 'bg-emerald-500',
      icon: ({ className }: { className?: string }) => (
        <span className={cn('size-2 rounded-full bg-emerald-500', className)} />
      ),
    },
    {
      label: t('inventoryScanner.onMarket'),
      value: 'market',
      colorClass: 'bg-amber-500',
      icon: ({ className }: { className?: string }) => (
        <span className={cn('size-2 rounded-full bg-amber-500', className)} />
      ),
    },
    {
      label: t('inventoryScanner.tradeProtected'),
      value: 'protected',
      colorClass: 'bg-blue-500',
      icon: ({ className }: { className?: string }) => (
        <span className={cn('size-2 rounded-full bg-blue-500', className)} />
      ),
    },
    {
      label: t('inventoryScanner.hold'),
      value: 'hold',
      colorClass: 'bg-red-500',
      icon: ({ className }: { className?: string }) => (
        <span className={cn('size-2 rounded-full bg-red-500', className)} />
      ),
    },
  ];

  const priceSourceOptions = [
    {
      label: t('portfolio.pricingBuff', 'BUFF Price'),
      value: 'buff',
    },
    {
      label: t('portfolio.pricingSteam', 'Steam Price'),
      value: 'steam',
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
      <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                  mode === 'case-summary' ? 'text-blue-400' : 'text-stone-500 hover:text-stone-300'
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
                  mode === 'transactions' ? 'text-blue-400' : 'text-stone-500 hover:text-stone-300'
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
        </div>

        <div className="flex w-full items-center gap-3 lg:w-auto">
          <div className="min-w-0 flex-1 lg:w-72 lg:flex-none">
            <label className="border-input-border bg-input focus-within:border-ring focus-within:ring-ring flex h-9 w-full items-center gap-2 rounded-md border px-3 text-xs transition-all focus-within:ring-1">
              <Search className="text-muted-foreground size-3.5 shrink-0" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                aria-label={t('inventoryScanner.searchPlaceholder')}
                placeholder={t('inventoryScanner.searchPlaceholder')}
                className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs font-medium outline-none"
              />
              {localQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalQuery('');
                    setGlobalFilter('');
                  }}
                  className="shrink-0 cursor-pointer rounded-full p-0.5 text-stone-500 transition-colors hover:bg-stone-800/60 hover:text-stone-300"
                  aria-label={t('common.clear', 'Clear')}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
          </div>
          {onRefreshPrices && (
            <Button
              type="button"
              onClick={onRefreshPrices}
              disabled={isRefreshingPrices}
              className="hover:bg-stone-850 flex h-9 shrink-0 cursor-pointer items-center gap-1.5 border border-stone-800 bg-stone-900/60 px-3 text-xs font-semibold hover:text-stone-200 disabled:cursor-wait disabled:opacity-50"
              title={t('inventoryScanner.refreshPrices')}
            >
              <RefreshCw
                className={`size-3.5 text-blue-400 ${isRefreshingPrices ? 'animate-spin' : ''}`}
              />
              <span className="text-stone-300 max-sm:sr-only">
                {t('inventoryScanner.refreshPrices')}
              </span>
            </Button>
          )}
        </div>
      </div>

      {!isMobile && (
        <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3">
            <div className="mr-2 flex shrink-0 items-center gap-1.5 select-none">
              <span className="text-xs font-bold tracking-wider text-stone-500 uppercase">
                {t('portfolio.filtersLabel', 'Filters:')}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <FilterPopover
                label={t('portfolio.filterSource', 'Source')}
                options={sourceOptions}
                selectedValues={selectedSourceFilters}
                onChange={(nextValues) => {
                  setSelectedSourceFilters(nextValues);
                  table.setPageIndex(0);
                }}
                hideOptionIcons={true}
              />

              <FilterPopover
                label={t('portfolio.filterItemType', 'Item Type')}
                options={itemTypeOptions}
                selectedValues={Array.from(selectedTypes)}
                onChange={(nextValues) => {
                  clearTypeFilters();
                  nextValues.forEach((val) => toggleTypeFilter(val));
                  table.setPageIndex(0);
                }}
                hideOptionIcons={true}
              />

              <FilterPopover
                label={t('portfolio.filterAccount', 'Account')}
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
                hideOptionIcons={true}
              />

              <FilterPopover
                label={t('inventoryScanner.status')}
                options={statusOptions}
                selectedValues={selectedStatuses}
                onChange={(nextValues) => {
                  setSelectedStatuses(nextValues);
                  table.setPageIndex(0);
                }}
              />

              <FilterPopover
                label={t('portfolio.filterPricing', 'Pricing')}
                options={priceSourceOptions}
                selectedValues={selectedPriceSourceFilters}
                onChange={(nextValues) => {
                  setSelectedPriceSourceFilters(nextValues);
                  table.setPageIndex(0);
                }}
                hideOptionIcons={true}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 lg:shrink-0">
            {hasSelectableRows && selectedIds.length === 0 && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
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
            <ResetButton isVisible={hasActiveFilters} onReset={clearAllFilters} />
            <ViewButton table={table} />
          </div>
        </div>
      )}

      {/* Mobile Horizontal Filter Chips */}
      {isMobile && (
        <div className="flex flex-col gap-2 border-b border-stone-800 bg-stone-900/60 py-2.5">
          {/* Row 1: Source + Item Type */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
            {sourceOptions.map((option) => (
              <ChipButton
                key={option.value}
                label={option.label}
                active={selectedSourceFilters.includes(option.value)}
                onClick={() => {
                  setSelectedSourceFilters(toggleValue(selectedSourceFilters, option.value));
                  table.setPageIndex(0);
                }}
              />
            ))}
            {itemTypeOptions.map((option) => (
              <ChipButton
                key={option.value}
                label={option.label}
                active={selectedTypes.has(option.value)}
                onClick={() => {
                  toggleTypeFilter(option.value);
                  table.setPageIndex(0);
                }}
              />
            ))}
          </div>

          {/* Row 2: Status + Pricing */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
            {statusOptions.map((option) => (
              <ChipButton
                key={option.value}
                label={option.label}
                colorClass={option.colorClass}
                active={selectedStatuses.includes(option.value)}
                onClick={() => {
                  setSelectedStatuses(toggleValue(selectedStatuses, option.value));
                  table.setPageIndex(0);
                }}
              />
            ))}
            {priceSourceOptions.map((option) => (
              <ChipButton
                key={option.value}
                label={option.label}
                active={selectedPriceSourceFilters.includes(option.value)}
                onClick={() => {
                  setSelectedPriceSourceFilters(
                    toggleValue(selectedPriceSourceFilters, option.value)
                  );
                  table.setPageIndex(0);
                }}
              />
            ))}
          </div>

          {/* Row 3: Account */}
          {accountOptions.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
              {accountOptions.map((account) => (
                <ChipButton
                  key={account.steamId64}
                  label={account.name}
                  active={selectedAccounts.includes(account.steamId64)}
                  onClick={() => {
                    setSelectedAccounts(toggleValue(selectedAccounts, account.steamId64));
                    table.setPageIndex(0);
                  }}
                />
              ))}
            </div>
          )}

          {/* Clear Filters Button (If any active) */}
          {hasActiveFilters && (
            <div className="px-3 pt-1">
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10"
              >
                {t('common.clearAll', 'Clear all')}
              </button>
            </div>
          )}
          {hasSelectableRows && selectedIds.length === 0 && (
            <div className="px-3 pt-1">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 text-xs font-semibold text-blue-300 transition-all hover:border-blue-500/40 hover:text-blue-200"
                title={t(
                  'portfolio.selectAllFilteredTooltip',
                  'Select all items matching the current filters'
                )}
              >
                <ListChecks className="size-3.5" />
                {t('portfolio.selectAllRows', 'Chọn tất cả')}
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
            {canSelectMoreFiltered && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
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
              onClick={() => setRowSelection({})}
              className="hover:bg-stone-850 inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-stone-800 bg-stone-900/60 px-3 text-xs font-semibold text-stone-400 transition-all hover:border-stone-700 hover:text-stone-200"
            >
              Hủy chọn
            </button>
            <button
              type="button"
              onClick={() => setSellDialogOpen(true)}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-blue-500 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-600 active:scale-95"
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
                          'w-[110px] max-w-[110px] min-w-[110px]',
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
