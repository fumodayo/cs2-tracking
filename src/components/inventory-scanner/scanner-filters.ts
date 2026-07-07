import type { ScanResultItem } from './types';

export function matchesScannerSourceFilter(
  item: ScanResultItem,
  selectedSourceFilters: string[]
): boolean {
  if (selectedSourceFilters.length === 0) return true;

  return selectedSourceFilters.some((source) => {
    if (source === 'manual') return !!item.isManual;
    if (source === 'existing') return !item.isManual;
    return false;
  });
}

export function matchesScannerPriceSourceFilter(
  item: ScanResultItem,
  selectedPriceSourceFilters: string[]
): boolean {
  if (selectedPriceSourceFilters.length === 0) return true;

  const priceSource = item.priceSource === 'buff163' ? 'buff' : 'steam';
  return selectedPriceSourceFilters.includes(priceSource);
}

export function matchesScannerAccountFilter(
  item: ScanResultItem,
  selectedAccounts: string[]
): boolean {
  if (selectedAccounts.length === 0) return true;

  return (
    item.sourceAccounts?.some((account) => selectedAccounts.includes(account.steamId64)) ?? false
  );
}

export function matchesScannerStatusFilter(
  item: ScanResultItem,
  selectedStatuses: string[]
): boolean {
  if (selectedStatuses.length === 0) return true;

  const statuses = new Set<string>();
  for (const account of item.sourceAccounts ?? []) {
    if (!account.breakdown) continue;

    if (account.breakdown.tradeable > 0) statuses.add('tradeable');
    if (account.breakdown.onMarket > 0) statuses.add('market');
    if (account.breakdown.tradeProtected > 0) statuses.add('protected');
    if (account.breakdown.hold > 0) statuses.add('hold');
  }

  if (statuses.size === 0) statuses.add('tradeable');
  return selectedStatuses.some((status) => statuses.has(status));
}

export function matchesScannerFilters(
  item: ScanResultItem,
  filters: {
    selectedAccounts: string[];
    selectedStatuses: string[];
    selectedSourceFilters: string[];
    selectedPriceSourceFilters: string[];
  }
): boolean {
  return (
    matchesScannerSourceFilter(item, filters.selectedSourceFilters) &&
    matchesScannerPriceSourceFilter(item, filters.selectedPriceSourceFilters) &&
    matchesScannerAccountFilter(item, filters.selectedAccounts) &&
    matchesScannerStatusFilter(item, filters.selectedStatuses)
  );
}
