import { useMemo } from 'react';

import { groupCommoditiesForMobile, groupItemsForSummary } from './hooks/use-scanner-data-merged';
import {
  matchesScannerFilters,
  matchesScannerPriceSourceFilter,
  matchesScannerSourceFilter,
} from './scanner-filters';
import type { AccountEntry, ScanResultItem } from './types';

type ScannerMode = 'case-summary' | 'transactions';

export function useScannerAccountOptions(accounts: AccountEntry[]) {
  return useMemo(
    () =>
      accounts
        .filter((account) => account.result)
        .map((account) => ({
          steamId64: account.result!.steamId64,
          name: account.result!.profile?.name || account.result!.steamId64,
        }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [accounts]
  );
}

export function useScannerDisplayData({
  scannedItems,
  filteredManualItems,
  selectedAccounts,
  selectedStatuses,
  selectedSourceFilters,
  selectedPriceSourceFilters,
  activeMode,
  isMobile,
}: {
  scannedItems?: ScanResultItem[];
  filteredManualItems: ScanResultItem[];
  selectedAccounts: string[];
  selectedStatuses: string[];
  selectedSourceFilters: string[];
  selectedPriceSourceFilters: string[];
  activeMode: ScannerMode;
  isMobile: boolean;
}) {
  const filteredScannedItems = useMemo(
    () =>
      (scannedItems ?? []).filter((item) =>
        matchesScannerFilters(item, {
          selectedAccounts,
          selectedStatuses,
          selectedSourceFilters,
          selectedPriceSourceFilters,
        })
      ),
    [
      selectedAccounts,
      selectedStatuses,
      selectedSourceFilters,
      selectedPriceSourceFilters,
      scannedItems,
    ]
  );

  const visibleManualItems = useMemo(() => {
    if (selectedAccounts.length > 0) return [];

    return filteredManualItems.filter(
      (item) =>
        matchesScannerSourceFilter(item, selectedSourceFilters) &&
        matchesScannerPriceSourceFilter(item, selectedPriceSourceFilters)
    );
  }, [selectedAccounts, filteredManualItems, selectedSourceFilters, selectedPriceSourceFilters]);

  const sellDialogSourceItems = useMemo(
    () => [...visibleManualItems, ...filteredScannedItems],
    [visibleManualItems, filteredScannedItems]
  );

  const tableData = useMemo(() => {
    if (isMobile) {
      return groupCommoditiesForMobile(sellDialogSourceItems);
    }
    if (activeMode === 'case-summary') {
      return groupItemsForSummary(sellDialogSourceItems);
    }
    return sellDialogSourceItems;
  }, [sellDialogSourceItems, activeMode, isMobile]);

  return {
    filteredScannedItems,
    visibleManualItems,
    sellDialogSourceItems,
    tableData,
  };
}
