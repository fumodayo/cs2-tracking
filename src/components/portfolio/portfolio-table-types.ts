import type { PriceRange } from '@/domain/price';
import type { CaseDto, PriceChangeDto } from '@/types/report';
import type { PatternInfo } from '@/domain/pattern-info';

export type PortfolioTableMode = 'transactions' | 'case-summary';
export type PortfolioSourceFilter = 'all' | 'manual' | 'existing';
export type PortfolioItemTypeFilter =
  | 'all'
  | 'case'
  | 'capsule'
  | 'sticker'
  | 'skin'
  | 'graffiti'
  | 'agent'
  | 'music_kit'
  | 'patch'
  | 'pin'
  | 'charm';
export type PortfolioRowSourceType = 'manual' | 'existing';
export type PortfolioRowItemType =
  | 'case'
  | 'capsule'
  | 'sticker'
  | 'skin'
  | 'graffiti'
  | 'agent'
  | 'music_kit'
  | 'patch'
  | 'pin'
  | 'charm';

export type PortfolioSourceAccount = {
  steamId64: string;
  name: string;
  breakdown?: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
    holdDetails?: Array<{
      quantity: number;
      holdDays: number;
    }>;
  };
};

export type PortfolioTableRow = {
  id: string;
  mode: PortfolioTableMode;
  case: CaseDto;
  itemIds: string[];
  quantity: number;
  lotCount: number;
  buyPrice: number;
  buyDate: string | null;
  createdAt: string | null;
  note?: string;
  sourceType: PortfolioRowSourceType;
  itemType: PortfolioRowItemType;
  sourceAccounts: PortfolioSourceAccount[];
  currentPrice: number | null;
  steamPrice?: number | null;
  skinCurrentPrice?: number | null;
  currentPriceCapturedAt: string | null;
  investedValue: number;
  currentValue: number | null;
  profitAmount: number | null;
  profitPercent: number | null;
  marketChanges: Record<PriceRange, PriceChangeDto>;
  tradeHoldUntil: string | null;
  isTemporaryPrice?: boolean;
  storageUnitQuantity?: number;
  storageUnitDetails?: Array<{
    storageUnitId?: string;
    storageUnitName?: string;
    quantity: number;
    steamId64?: string;
  }>;
  storageUnitId?: string;
  isVirtual?: boolean;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: PatternInfo;
  stickerPriceRate?: number;
  stickerPriceAdd?: number;
  stickerBuyPriceRate?: number;
  stickerBuyPriceAdd?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: string;
  hasMixedVariants?: boolean;
  variantCount?: number;
};
