import type { PatternInfo } from '@/domain/pattern-info';
import type { PortfolioSourceAccount } from '@/domain/portfolio-item';

export type SendImportProgress = (data: Record<string, unknown>) => void;

export type InventoryImportItem = {
  caseItem?: {
    id?: unknown;
    name?: unknown;
    marketHashName?: unknown;
    imageUrl?: unknown;
    rarity?: unknown;
  };
  rarity?: unknown;
  quantity?: unknown;
  price?: unknown;
  isManual?: unknown;
  sourceAccounts?: unknown;
  holdDays?: unknown;
  buyPrice?: unknown;
  buyDate?: unknown;
  tradeHoldUntil?: unknown;
  storageUnitId?: unknown;
  buffPriceManual?: unknown;
  buffRateManual?: unknown;
  dopplerPhase?: unknown;
  inspectLink?: unknown;
  patternInfo?: unknown;
  stickerPriceRate?: unknown;
  stickerBuyPriceRate?: unknown;
  stickerScanTotalPrice?: unknown;
  stickerScanPriceCapturedAt?: unknown;
};

export type ScannedImportInput = {
  caseId: string;
  quantity: number;
  buyPrice: number;
  note: string;
  sourceAccounts: PortfolioSourceAccount[];
  holdDays: number;
  tradeHoldUntil?: string;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: PatternInfo;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: Date;
};

export type StorageUnitAssignment = {
  storageUnitId: string;
  caseId: string;
  marketHashName: string;
  quantity: number;
};
