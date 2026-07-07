import type { TFunction } from 'i18next';

import type { PriceRange } from '@/domain/price';
import type { PortfolioReportRowDto, PriceChangeDto } from '@/types/report';
import { toPortfolioItemType } from '@/utils/cs2-item-type';

import type { PortfolioTableRow } from '../portfolio/portfolio-table-model';
import type { ScanResultItem } from './types';
import { getScanResultItemRowId } from './utils';

type PortfolioRowFromScannerItemOptions = {
  item: ScanResultItem;
  mergedRawItems?: ScanResultItem[];
  t: TFunction;
};

export function createPortfolioRowFromScannerItem({
  item,
  mergedRawItems,
  t,
}: PortfolioRowFromScannerItemOptions): PortfolioTableRow {
  const id = getScanResultItemRowId(item);
  const itemIds = item.underlyingIds && item.underlyingIds.length > 0 ? item.underlyingIds : [id];
  const marketHashName = item.caseItem.marketHashName;
  const rawItem = mergedRawItems?.find((entry) => entry.caseItem.marketHashName === marketHashName);
  const steamPrice = rawItem?.price ?? item.price;
  const currentPrice = item.price;

  return {
    id,
    mode: 'case-summary',
    case: {
      id: item.caseItem.id,
      name: item.caseItem.name,
      marketHashName,
      imageUrl: item.caseItem.imageUrl ?? undefined,
      isActive: true,
      rarity: item.rarity,
    },
    itemIds,
    quantity: item.quantity,
    lotCount: 1,
    buyPrice: item.buyPrice ?? 0,
    buyDate: item.buyDate ?? null,
    createdAt: null,
    note: item.note ?? (item.isManual ? t('common.manual') : undefined),
    sourceType: item.isManual ? 'manual' : 'existing',
    itemType: toPortfolioItemType(item.type),
    sourceAccounts: (item.sourceAccounts ?? []).map((account) => ({
      steamId64: account.steamId64,
      name: account.name,
      breakdown: account.breakdown,
    })),
    currentPrice,
    steamPrice,
    currentPriceCapturedAt: null,
    investedValue: (item.buyPrice ?? 0) * item.quantity,
    currentValue: currentPrice * item.quantity,
    profitAmount: 0,
    profitPercent: 0,
    marketChanges: {} as Record<PriceRange, PriceChangeDto>,
    tradeHoldUntil: null,
    isTemporaryPrice: false,
    storageUnitQuantity: 0,
    patternInfo: item.patternInfo,
    dopplerPhase: item.dopplerPhase,
    inspectLink: item.inspectLink,
  };
}

export function createPortfolioReportRowFromScannerItem(
  item: ScanResultItem,
  t: TFunction
): PortfolioReportRowDto {
  const id = getScanResultItemRowId(item);

  return {
    item: {
      id,
      quantity: item.quantity,
      buyPrice: item.buyPrice ?? 0,
      buyDate: item.buyDate ?? null,
      createdAt: null,
      note: item.isManual ? t('common.manual') : t('inventoryScanner.scanned'),
      sourceAccounts: item.sourceAccounts,
      storageUnitId: item.storageUnitId,
      storageUnitQuantity: item.storageUnitId ? item.quantity : 0,
    },
    case: {
      id: item.caseItem.id,
      name: item.caseItem.name,
      marketHashName: item.caseItem.marketHashName,
      imageUrl: item.caseItem.imageUrl,
    },
    currentPrice: item.price,
    currentValue: item.total,
    investedValue: (item.buyPrice ?? 0) * item.quantity,
    profitAmount: 0,
    profitPercent: 0,
    marketChanges: {} as Record<PriceRange, PriceChangeDto>,
  } as unknown as PortfolioReportRowDto;
}
