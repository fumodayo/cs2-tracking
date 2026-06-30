import type { CaseItem } from "./case-item";
import type { PortfolioItem } from "./portfolio-item";
import type { PriceRange } from "./price";

export type PriceChange = {
  amount: number | null;
  percent: number | null;
  baselinePrice: number | null;
  baselineDate: string | null;
};

export type PortfolioReportRow = {
  item: PortfolioItem;
  case: CaseItem;
  currentPrice: number | null;
  skinCurrentPrice?: number | null;
  currentPriceCapturedAt: string | null;
  investedValue: number;
  currentValue: number | null;
  profitAmount: number | null;
  profitPercent: number | null;
  marketChanges: Record<PriceRange, PriceChange>;
};

export type PortfolioSummary = {
  totalInvested: number;
  totalCurrentValue: number;
  totalProfit: number;
  totalProfitPercent: number;
  itemCount: number;
  caseCount: number;
};

export type PortfolioReport = {
  summary: PortfolioSummary;
  rows: PortfolioReportRow[];
};
