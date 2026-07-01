import type { PatternInfo } from '@/domain/pattern-info';
import type { Cs2InventoryItemType } from '@/utils/cs2-item-type';

export type CaseItemData = {
  id: string;
  name: string;
  marketHashName: string;
  imageUrl: string | null;
  isActive: boolean;
};

export type InventoryItemType = Cs2InventoryItemType;

export type ScanResultItem = {
  caseItem: CaseItemData;
  type: InventoryItemType;
  rarity?: {
    name: string;
    color: string;
  };
  steamMarketUrl?: string;
  quantity: number;
  price: number;
  total: number;
  isManual?: boolean;
  sourceAccounts?: SourceAccount[];
  buffPriceCny?: number;
  priceSource?: 'buff163' | 'steam-market';
  holdDays?: number;
  onMarket?: boolean;
  tradeProtected?: boolean;
  id?: string;
  buyPrice?: number;
  buyDate?: string;
  storageUnitId?: string;
  storageUnitName?: string;
  storageUnitQuantity?: number;
  buffPriceManual?: number;
  buffRateManual?: number;
  scannedAt?: string;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: PatternInfo;
  identityKey?: string;
  variantKeysSet?: Set<string>;
  variantCount?: number;
  hasMixedVariants?: boolean;
  underlyingIds?: string[];
  note?: string;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: string;
};

export type SteamProfile = {
  name: string;
  avatarUrl: string | null;
};

export type SourceAccount = {
  steamId64: string;
  name: string;
  quantity?: number;
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

export type ScanResponse = {
  steamId64: string;
  profile: SteamProfile;
  items: ScanResultItem[];
  totalPrice: number;
  totalQuantity: number;
  totalInventoryCount: number;
  cached: boolean;
  scannedAt: string;
  expiresAt: string;
  marketScanWarning?: boolean;
  walletBalance?: string | null;
  walletBalanceVnd?: number | null;
};

export type ScanProgress = {
  status: 'queued' | 'running' | 'done' | 'error';
  stage: string;
  message: string;
  percent: number;
  detail?: Record<string, number | string>;
  result?: ScanResponse;
  error?: string;
  updatedAt?: string;
};

export type AccountEntry = {
  id: string;
  url: string;
  steamCookie?: string;
  steamSessionId?: string;
  scanJobId?: string | null;
  status: 'idle' | 'scanning' | 'done' | 'error';
  result: ScanResponse | null;
  error: string | null;
  progress: ScanProgress | null;
};

export type SearchResult = {
  caseItem: CaseItemData;
  price: number;
};
