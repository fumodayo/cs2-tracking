/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState } from 'react';
import { FaSteam, FaCoins } from 'react-icons/fa';
import { TbPencil, TbDatabase } from 'react-icons/tb';
import { ListChecks, RefreshCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { FilterPopover, ResetButton, ViewButton } from '@/components/ui/actions';
import {
  PortfolioSourceFilter,
  PortfolioTableMode,
  PortfolioTableRow,
} from '../portfolio-table-model';
import { Table } from '@tanstack/react-table';
import { PortfolioBulkActions } from './portfolio-bulk-actions';
import type { TFunction } from 'i18next';
import { cn } from '@/utils/cn';

export const SOURCE_FILTER_OPTIONS: Array<{
  label: string;
  value: PortfolioSourceFilter;
  icon?: React.ComponentType<{ className?: string }>;
}> = [
  { label: 'Th\u1ee7 c\u00f4ng', value: 'manual', icon: TbPencil },
  { label: 'C\u00f3 s\u1eb5n', value: 'existing', icon: TbDatabase },
];

export interface PortfolioTableToolbarProps {
  mode: PortfolioTableMode;
  setMode: (mode: PortfolioTableMode) => void;
  globalFilter: string;
  setGlobalFilter: (q: string) => void;
  sourceFilters: PortfolioSourceFilter[];
  setSourceFilters: (val: PortfolioSourceFilter[]) => void;
  itemTypeFilters: string[];
  setItemTypeFilters: (val: string[]) => void;
  accountFilters: string[];
  setAccountFilters: (val: string[]) => void;
  statusFilters: string[];
  setStatusFilters: (val: string[]) => void;
  priceSourceFilters: string[];
  setPriceSourceFilters: (val: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  itemTypeOptions: Array<{
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  t: TFunction;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  table: Table<PortfolioTableRow>;
  isMobile?: boolean;

  // Bulk actions
  selectedIds: string[];
  setRowSelection: (selection: Record<string, boolean>) => void;
  setSellDialogOpen: (open: boolean) => void;
  handleDeleteSelected: () => void;
  isDeletingMany?: boolean;
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

export function PortfolioTableToolbar({
  mode,
  setMode,
  globalFilter,
  setGlobalFilter,
  sourceFilters,
  setSourceFilters,
  itemTypeFilters,
  setItemTypeFilters,
  accountFilters,
  setAccountFilters,
  statusFilters,
  setStatusFilters,
  priceSourceFilters,
  setPriceSourceFilters,
  accountOptions,
  itemTypeOptions,
  t,
  onRefreshPrices,
  isRefreshingPrices,
  table,
  selectedIds,
  setRowSelection,
  setSellDialogOpen,
  handleDeleteSelected,
  isDeletingMany = false,
  isMobile = false,
}: PortfolioTableToolbarProps) {
  const [localQuery, setLocalQuery] = useState(globalFilter);

  useEffect(() => {
    setLocalQuery(globalFilter);
  }, [globalFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localQuery !== globalFilter) {
        setGlobalFilter(localQuery);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [globalFilter, localQuery, setGlobalFilter]);

  const hasActiveFilters =
    sourceFilters.length > 0 ||
    itemTypeFilters.length > 0 ||
    accountFilters.length > 0 ||
    statusFilters.length > 0 ||
    priceSourceFilters.length > 0;

  const clearAllFilters = () => {
    setSourceFilters([]);
    setItemTypeFilters([]);
    setAccountFilters([]);
    setStatusFilters([]);
    setPriceSourceFilters([]);
    table.setPageIndex(0);
  };

  const toggleValue = (values: string[], value: string) => {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  };

  const mobileItemTypeOptions = itemTypeOptions.filter(
    (option) =>
      option.value !== 'separator' &&
      !option.value.startsWith('separator:') &&
      !option.value.startsWith('group:') &&
      !option.value.startsWith('subtype:')
  );
  const filteredRows = table.getFilteredRowModel().rows;
  const filteredRowCount = filteredRows.length;
  const selectedFilteredCount = filteredRows.filter((row) => row.getIsSelected()).length;
  const hasSelectableRows = filteredRowCount > 0;
  const handleSelectAllFiltered = () => {
    const nextSelection: Record<string, boolean> = {};
    for (const row of filteredRows) {
      nextSelection[row.id] = true;
    }
    setRowSelection(nextSelection);
  };

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!isMobile && (
            <div className="relative inline-flex h-9 shrink-0 items-center rounded-lg border border-stone-800 bg-stone-950 p-1 shadow-sm select-none">
              <button
                type="button"
                onClick={() => setMode('case-summary')}
                className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 ${
                  mode === 'case-summary'
                    ? 'text-accent-foreground'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {mode === 'case-summary' && (
                  <motion.div
                    layoutId="activeTabToolbar"
                    className="bg-accent shadow-accent/15 absolute inset-0 rounded-md shadow-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  {t('dashboard.caseSummaryMode', 'Group Cases')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode('transactions')}
                className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 ${
                  mode === 'transactions'
                    ? 'text-accent-foreground'
                    : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {mode === 'transactions' && (
                  <motion.div
                    layoutId="activeTabToolbar"
                    className="bg-accent shadow-accent/15 absolute inset-0 rounded-md shadow-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t('dashboard.viewMode', 'Detail')}</span>
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
                onChange={(event) => setLocalQuery(event.target.value)}
                placeholder={t(
                  'portfolio.searchPlaceholder',
                  'Search items, market hash, notes...'
                )}
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
              title={t('portfolio.refreshPrices', 'Refresh prices')}
            >
              <RefreshCcw
                className={cn('text-accent size-3.5', isRefreshingPrices && 'animate-spin')}
              />
              <span className="text-stone-300 max-sm:sr-only">
                {t('portfolio.refreshPrices', 'Refresh prices')}
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
                options={[
                  { label: t('portfolio.sourceManual', 'Manual'), value: 'manual' },
                  { label: t('portfolio.sourceExisting', 'Existing'), value: 'existing' },
                ]}
                selectedValues={sourceFilters}
                onChange={(values) => {
                  setSourceFilters(values as PortfolioSourceFilter[]);
                  table.setPageIndex(0);
                }}
                hideOptionIcons={true}
              />
              <FilterPopover
                label={t('portfolio.filterItemType', 'Item Type')}
                options={itemTypeOptions}
                selectedValues={itemTypeFilters}
                onChange={(values) => {
                  setItemTypeFilters(values);
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
                selectedValues={accountFilters}
                onChange={(values) => {
                  setAccountFilters(values);
                  table.setPageIndex(0);
                }}
                disabled={accountOptions.length === 0}
                hideOptionIcons={true}
              />
              <FilterPopover
                label={t('inventoryScanner.status', 'Trạng thái')}
                options={[
                  {
                    label: t('inventoryScanner.tradeable', 'Giao dịch được'),
                    value: 'tradeable',
                    icon: ({ className }) => (
                      <span className={cn('size-2 rounded-full bg-emerald-500', className)} />
                    ),
                  },
                  {
                    label: t('inventoryScanner.onMarket', 'Trên chợ'),
                    value: 'market',
                    icon: ({ className }) => (
                      <span className={cn('size-2 rounded-full bg-amber-500', className)} />
                    ),
                  },
                  {
                    label: t('inventoryScanner.tradeProtected', 'Bảo vệ giao dịch'),
                    value: 'protected',
                    icon: ({ className }) => (
                      <span className={cn('size-2 rounded-full bg-blue-500', className)} />
                    ),
                  },
                  {
                    label: t('inventoryScanner.hold', 'Tạm giữ'),
                    value: 'hold',
                    icon: ({ className }) => (
                      <span className={cn('size-2 rounded-full bg-red-500', className)} />
                    ),
                  },
                ]}
                selectedValues={statusFilters}
                onChange={(values) => {
                  setStatusFilters(values);
                  table.setPageIndex(0);
                }}
              />
              <FilterPopover
                label={t('portfolio.filterPricing', 'Pricing')}
                options={[
                  {
                    label: t('portfolio.pricingBuff', 'BUFF Price'),
                    value: 'buff',
                    icon: () => <FaCoins className="size-4.5 text-amber-500" />,
                  },
                  {
                    label: t('portfolio.pricingSteam', 'Steam Price'),
                    value: 'steam',
                    icon: () => <FaSteam className="size-4.5 text-sky-400" />,
                  },
                ]}
                selectedValues={priceSourceFilters}
                onChange={(values) => {
                  setPriceSourceFilters(values);
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

      {isMobile && (
        <div className="flex flex-col gap-2 border-b border-stone-800 bg-stone-900/60 py-2.5">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
            <ChipButton
              label={t('portfolio.sourceManual', 'Manual')}
              active={sourceFilters.includes('manual')}
              onClick={() => {
                setSourceFilters(toggleValue(sourceFilters, 'manual') as PortfolioSourceFilter[]);
                table.setPageIndex(0);
              }}
            />
            <ChipButton
              label={t('portfolio.sourceExisting', 'Existing')}
              active={sourceFilters.includes('existing')}
              onClick={() => {
                setSourceFilters(toggleValue(sourceFilters, 'existing') as PortfolioSourceFilter[]);
                table.setPageIndex(0);
              }}
            />
            {mobileItemTypeOptions.map((option) => (
              <ChipButton
                key={option.value}
                label={option.label}
                active={itemTypeFilters.includes(option.value)}
                onClick={() => {
                  setItemTypeFilters(toggleValue(itemTypeFilters, option.value));
                  table.setPageIndex(0);
                }}
              />
            ))}
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
            {[
              {
                label: t('portfolio.statusTradeable', 'Tradeable'),
                value: 'tradeable',
                colorClass: 'bg-emerald-500',
              },
              {
                label: t('portfolio.statusOnMarket', 'On Market'),
                value: 'market',
                colorClass: 'bg-amber-500',
              },
              {
                label: t('portfolio.statusTradeProtected', 'Trade Protected'),
                value: 'protected',
                colorClass: 'bg-blue-500',
              },
              {
                label: t('portfolio.statusHold', 'Hold'),
                value: 'hold',
                colorClass: 'bg-red-500',
              },
              {
                label: t('portfolio.pricingBuff', 'BUFF Price'),
                value: 'buff',
                colorClass: 'bg-amber-500',
                group: 'price',
              },
              {
                label: t('portfolio.pricingSteam', 'Steam Price'),
                value: 'steam',
                colorClass: 'bg-sky-400',
                group: 'price',
              },
            ].map((option) => {
              const values = option.group === 'price' ? priceSourceFilters : statusFilters;
              return (
                <ChipButton
                  key={`${option.group ?? 'status'}-${option.value}`}
                  label={option.label}
                  colorClass={option.colorClass}
                  active={values.includes(option.value)}
                  onClick={() => {
                    if (option.group === 'price') {
                      setPriceSourceFilters(toggleValue(priceSourceFilters, option.value));
                    } else {
                      setStatusFilters(toggleValue(statusFilters, option.value));
                    }
                    table.setPageIndex(0);
                  }}
                />
              );
            })}
          </div>

          {accountOptions.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
              {accountOptions.map((account) => (
                <ChipButton
                  key={account.steamId64}
                  label={account.name}
                  active={accountFilters.includes(account.steamId64)}
                  onClick={() => {
                    setAccountFilters(toggleValue(accountFilters, account.steamId64));
                    table.setPageIndex(0);
                  }}
                />
              ))}
            </div>
          )}

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
        <PortfolioBulkActions
          selectedCount={selectedIds.length}
          selectedFilteredCount={selectedFilteredCount}
          totalFilteredCount={filteredRowCount}
          onSelectAllFiltered={handleSelectAllFiltered}
          onClearSelection={() => setRowSelection({})}
          onSellSelected={() => setSellDialogOpen(true)}
          onDeleteSelected={handleDeleteSelected}
          isDeletingMany={isDeletingMany}
        />
      )}
    </>
  );
}
