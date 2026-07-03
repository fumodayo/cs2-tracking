'use client';

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Table } from '@tanstack/react-table';
import { PortfolioSyncSection } from './portfolio-sync-section';
import { AddCaseSearch } from '../add-case-search';
import { Button } from '@/components/ui/button';
import { PricingStatsGrid } from './pricing-stats-grid';
import { ResultsTable } from './results-table';
import type { ClientSessionUser } from '@/components/auth/use-session';
import type { ScannerState } from '../scanner-reducer';
import type { ScanResultItem, CaseItemData } from '../types';

interface ScannerResultsProps {
  mode: 'case-summary' | 'transactions';
  setMode: (mode: 'case-summary' | 'transactions') => void;
  merged: {
    items: ScanResultItem[];
    scannedItems: ScanResultItem[];
    totalInventoryCount: number;
    accountCount: number;
    totalPrice: number;
    totalQuantity: number;
  } | null;
  state: ScannerState;
  isAnyScanPending: boolean;
  addManualItem: (
    caseItem: CaseItemData,
    price: number,
    quantity: number,
    buyPrice?: number,
    buyDate?: string,
    sourceAccounts?: Array<{ steamId64: string; name: string }>,
    storageUnitId?: string,
    buffPriceManual?: number,
    buffRateManual?: number,
    storageUnitName?: string
  ) => void;
  buffCnyToVndRate: number;
  setBuffCnyToVndRate: (rate: number) => void;
  rateAll: number;
  setRateAll: (rate: number) => void;
  rateLe: number;
  setRateLe: (rate: number) => void;
  totalSi: number;
  totalLe: number;
  totalWalletVnd: number;
  table: Table<ScanResultItem>;
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
  selectedAccounts: string[];
  setSelectedAccounts: (accounts: string[]) => void;
  selectedSourceFilters: string[];
  setSelectedSourceFilters: (sources: string[]) => void;
  selectedPriceSourceFilters: string[];
  setSelectedPriceSourceFilters: (sources: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  rowSelection: Record<string, boolean>;
  setRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSellDialogOpen: (open: boolean) => void;
  handleDeleteSelected: () => void;
  refreshPrices: () => void;
  isRefreshingPrices: boolean;
  setGlobalFilter: (q: string) => void;
  clearTypeFilters: () => void;
  toggleTypeFilter: (t: string) => void;
  user: ClientSessionUser | null;
  googleConfigured: boolean;
  importInventoryToPortfolio: () => void;
  zeroPricedItems: ScanResultItem[];
  isMobile?: boolean;
  onSelectItem?: (item: ScanResultItem) => void;
}

export function ScannerResults({
  mode,
  setMode,
  merged,
  state,
  isAnyScanPending,
  addManualItem,
  buffCnyToVndRate,
  setBuffCnyToVndRate,
  rateAll,
  setRateAll,
  rateLe,
  setRateLe,
  totalSi,
  totalLe,
  totalWalletVnd,
  table,
  selectedStatuses,
  setSelectedStatuses,
  selectedAccounts,
  setSelectedAccounts,
  selectedSourceFilters,
  setSelectedSourceFilters,
  selectedPriceSourceFilters,
  setSelectedPriceSourceFilters,
  accountOptions,
  rowSelection,
  setRowSelection,
  setSellDialogOpen,
  handleDeleteSelected,
  refreshPrices,
  isRefreshingPrices,
  setGlobalFilter,
  clearTypeFilters,
  toggleTypeFilter,
  user,
  googleConfigured,
  importInventoryToPortfolio,
  zeroPricedItems,
  isMobile = false,
  onSelectItem,
}: ScannerResultsProps) {
  const { t } = useTranslation();

  const totalUnfilteredItemsCount = React.useMemo(() => {
    const manualCount = state.manualItems.length;
    const scannedCount = state.accounts.reduce((sum, acc) => {
      if (acc.result) {
        return sum + acc.result.items.length;
      }
      return sum;
    }, 0);
    return manualCount + scannedCount;
  }, [state.manualItems, state.accounts]);

  if (!merged) return null;

  return (
    <div className="space-y-6">
      <PortfolioSyncSection
        user={user}
        googleConfigured={googleConfigured}
        importInventoryToPortfolio={importInventoryToPortfolio}
        portfolioImporting={state.portfolioImporting}
        portfolioImportStatus={state.portfolioImportStatus}
        portfolioImportMessage={state.portfolioImportMessage}
        portfolioImportError={state.portfolioImportError}
        hasItemsToImport={!!state.accounts.some((a) => a.result)}
        zeroPricedItems={zeroPricedItems}
        retryingPrices={state.retryingPrices}
        retryStatus={state.retryStatus}
      />

      {merged.items.length > 0 && !state.scanningAll && !isAnyScanPending && (
        <div className="mb-4 flex justify-end gap-2">
          <Button
            type="button"
            onClick={() => setSellDialogOpen(true)}
            variant="outline"
            className="hover:bg-stone-850 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-stone-800 bg-stone-900/60 px-4 text-sm font-semibold text-stone-300 shadow-md transition-all hover:text-stone-100 active:scale-95"
          >
            <ShoppingBag className="size-4 text-blue-400" />
            <span>{t('inventoryScanner.sellItems')}</span>
          </Button>

          <AddCaseSearch
            onAdd={addManualItem}
            scannedAccounts={state.accounts
              .filter((a) => a.result?.profile)
              .map((a) => ({
                steamId64: a.result!.steamId64,
                name: a.result!.profile.name,
              }))}
            defaultBuffRate={buffCnyToVndRate}
          />
        </div>
      )}

      <PricingStatsGrid
        buffCnyToVndRate={buffCnyToVndRate}
        setBuffCnyToVndRate={setBuffCnyToVndRate}
        rateAll={rateAll}
        setRateAll={setRateAll}
        rateLe={rateLe}
        setRateLe={setRateLe}
        totalPrice={merged.totalPrice}
        totalQuantity={merged.totalQuantity}
        totalSi={totalSi}
        totalLe={totalLe}
        totalWalletVnd={totalWalletVnd}
        accounts={state.accounts}
      />

      {totalUnfilteredItemsCount > 0 ? (
        <ResultsTable
          mode={mode}
          isMobile={isMobile}
          onSelectItem={onSelectItem}
          setMode={setMode}
          table={table}
          globalFilter={state.globalFilter}
          setGlobalFilter={setGlobalFilter}
          selectedTypes={state.selectedTypes}
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
          selectedIds={Object.keys(rowSelection).filter((k) => rowSelection[k])}
          setRowSelection={setRowSelection}
          setSellDialogOpen={setSellDialogOpen}
          handleDeleteSelected={handleDeleteSelected}
          onRefreshPrices={refreshPrices}
          isRefreshingPrices={isRefreshingPrices || state.scanningAll || isAnyScanPending}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-800 bg-stone-900/30 px-4 py-16 text-center">
          <ShoppingBag className="mb-4 size-10 text-stone-600" />
          <p className="text-lg font-medium text-stone-300">{t('inventoryScanner.noItemsFound')}</p>
          <p className="mt-1 mb-6 max-w-xs text-sm text-stone-500">
            {t('inventoryScanner.noItemsFoundDesc')}
          </p>
          <AddCaseSearch
            onAdd={addManualItem}
            scannedAccounts={state.accounts
              .filter((a) => a.result?.profile)
              .map((a) => ({
                steamId64: a.result!.steamId64,
                name: a.result!.profile.name,
              }))}
            defaultBuffRate={buffCnyToVndRate}
          />
        </div>
      )}
    </div>
  );
}
