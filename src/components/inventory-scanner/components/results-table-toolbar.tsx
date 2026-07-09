'use client';

import { type Table } from '@tanstack/react-table';
import { motion } from 'framer-motion';
import { RefreshCw, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterPopover, ResetButton, ViewButton } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { ScanResultItem } from '../types';

type ResultsTableToolbarProps = {
  mode: 'case-summary' | 'transactions';
  setMode: (mode: 'case-summary' | 'transactions') => void;
  table: Table<ScanResultItem>;
  localQuery: string;
  setLocalQuery: (value: string) => void;
  setGlobalFilter: (value: string) => void;
  selectedTypes: Set<string>;
  clearTypeFilters: () => void;
  toggleTypeFilter: (value: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (value: string[]) => void;
  selectedAccounts: string[];
  setSelectedAccounts: (value: string[]) => void;
  selectedSourceFilters: string[];
  setSelectedSourceFilters: (value: string[]) => void;
  selectedPriceSourceFilters: string[];
  setSelectedPriceSourceFilters: (value: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  onRefreshPrices?: () => void;
  isRefreshingPrices: boolean;
  isMobile: boolean;
  hasActiveFilters: boolean;
};

export function ResultsTableToolbar({
  mode,
  setMode,
  table,
  localQuery,
  setLocalQuery,
  setGlobalFilter,
  selectedTypes,
  clearTypeFilters,
  toggleTypeFilter,
  selectedStatuses,
  setSelectedStatuses,
  selectedAccounts,
  setSelectedAccounts,
  selectedSourceFilters,
  setSelectedSourceFilters,
  selectedPriceSourceFilters,
  setSelectedPriceSourceFilters,
  accountOptions,
  onRefreshPrices,
  isRefreshingPrices,
  isMobile,
  hasActiveFilters,
}: ResultsTableToolbarProps) {
  const { t } = useTranslation();

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
    <>
      <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!isMobile && (
            <div className="relative inline-flex h-9 shrink-0 items-center rounded-lg border border-stone-800 bg-stone-950 p-1 shadow-sm select-none">
              <ToolbarModeButton
                active={mode === 'case-summary'}
                onClick={() => {
                  setMode('case-summary');
                  table.setPageIndex(0);
                }}
              >
                {t('dashboard.caseSummaryMode', 'Group')}
              </ToolbarModeButton>
              <ToolbarModeButton
                active={mode === 'transactions'}
                onClick={() => {
                  setMode('transactions');
                  table.setPageIndex(0);
                }}
              >
                {t('dashboard.viewMode', 'Details')}
              </ToolbarModeButton>
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
        <>
          {/* Desktop has room for grouped popover filters and the column visibility menu. */}
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
                    nextValues.forEach((value) => toggleTypeFilter(value));
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
              <ResetButton isVisible={hasActiveFilters} onReset={clearAllFilters} />
              <ViewButton table={table} />
            </div>
          </div>
        </>
      )}

      {isMobile && (
        <>
          {/* Mobile uses horizontal chips to avoid cramped popovers inside the scanner table. */}
          <div className="flex flex-col gap-2 border-b border-stone-800 bg-stone-900/60 py-2.5">
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
          </div>
        </>
      )}
    </>
  );
}

function ToolbarModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 ${
        active ? 'text-blue-400' : 'text-stone-500 hover:text-stone-300'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeTabToolbarScanner"
          className="absolute inset-0 rounded-md border border-stone-800 bg-stone-900 shadow-md"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
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
