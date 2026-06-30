import type { PriceRange } from "@/domain/price";

export type CaseDto = {
  id: string;
  name: string;
  marketHashName: string;
  imageUrl?: string;
  rarity?: {
    name: string;
    color: string;
  };
  isActive: boolean;
};

export type PriceChangeDto = {
  amount: number | null;
  percent: number | null;
  baselinePrice: number | null;
  baselineDate: string | null;
};

export type PortfolioReportRowDto = {
  item: {
    id: string;
    caseId: string;
    quantity: number;
    buyPrice: number;
    buyCurrency: "VND";
    buyDate: string;
    note?: string;
    sourceAccounts?: Array<{
      steamId64: string;
      name: string;
    }>;
    tradeHoldUntil?: string;
    isTemporaryPrice?: boolean;
    storageUnitId?: string;
    storageUnitQuantity?: number;
    storageUnitDetails?: Array<{
      storageUnitId: string;
      storageUnitName: string;
      quantity: number;
      steamId64?: string;
    }>;
    dopplerPhase?: string;
    inspectLink?: string;
    patternInfo?: any;
    stickerPriceRate?: number;
    stickerPriceAdd?: number;
    stickerBuyPriceRate?: number;
    stickerBuyPriceAdd?: number;
    stickerScanTotalPrice?: number;
    stickerScanPriceCapturedAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  case: CaseDto;
  currentPrice: number | null;
  skinCurrentPrice?: number | null;
  currentPriceCapturedAt: string | null;
  investedValue: number;
  currentValue: number | null;
  profitAmount: number | null;
  profitPercent: number | null;
  marketChanges: Record<PriceRange, PriceChangeDto>;
};

export type PortfolioReportDto = {
  summary: {
    totalInvested: number;
    totalCurrentValue: number;
    totalProfit: number;
    totalProfitPercent: number;
    itemCount: number;
    caseCount: number;
  };
  rows: PortfolioReportRowDto[];
};
