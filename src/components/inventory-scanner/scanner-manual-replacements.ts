import type { ScanResultItem } from './types';

export type ManualItemReplacement = {
  quantity: number;
  buyPrice?: number;
  buyDate?: string;
  sourceAccounts?: ScanResultItem['sourceAccounts'];
  storageUnitId?: string;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  id?: string;
  note?: string;
};

export function createScannerManualReplacement(
  scannedItem: ScanResultItem,
  overrides: Partial<ManualItemReplacement>,
  options: { preserveEditableFields?: boolean; id?: string } = {}
): ManualItemReplacement {
  const replacement: ManualItemReplacement = {
    quantity: scannedItem.quantity,
    buyPrice: scannedItem.buyPrice,
    buyDate: scannedItem.buyDate,
    sourceAccounts: scannedItem.sourceAccounts,
    storageUnitId: scannedItem.storageUnitId,
  };

  if (options.preserveEditableFields) {
    replacement.stickerPriceRate = scannedItem.stickerPriceRate;
    replacement.stickerBuyPriceRate = scannedItem.stickerBuyPriceRate;
    replacement.id = options.id ?? scannedItem.id;
    replacement.note = scannedItem.note;
  }

  return {
    ...replacement,
    ...overrides,
  };
}
