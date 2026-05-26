import type { CaseItem } from "@/domain/case-item";
import type { PortfolioItem } from "@/domain/portfolio-item";
import type { PortfolioReport, PortfolioReportRow, PriceChange } from "@/domain/portfolio-report";
import { PRICE_RANGES, type PriceRange } from "@/domain/price";
import type {
  CaseRepository,
  PortfolioRepository,
  PriceSnapshotRepository,
} from "@/domain/repositories";
import { PriceService } from "./price-service";
import { getRangeStartDate } from "./date-range";

export class PortfolioReportService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly caseRepository: CaseRepository,
    private readonly priceService: PriceService,
    private readonly snapshotRepository: PriceSnapshotRepository,
  ) {}

  async buildReport(options?: { forceRefresh?: boolean }): Promise<PortfolioReport> {
    const items = await this.portfolioRepository.list();
    const cases = await this.caseRepository.findByIds(items.map((item) => item.caseId));
    const caseMap = new Map(cases.map((caseItem) => [caseItem.id, caseItem]));

    const rows = await Promise.all(
      items.flatMap((item) => {
        const caseItem = caseMap.get(item.caseId);
        return caseItem ? [this.buildRow(item, caseItem, options)] : [];
      }),
    );

    return {
      rows,
      summary: buildSummary(rows),
    };
  }

  private async buildRow(
    item: PortfolioItem,
    caseItem: CaseItem,
    options?: { forceRefresh?: boolean },
  ): Promise<PortfolioReportRow> {
    const currentPrice = await this.priceService.getCurrentPrice(caseItem, options);
    const investedValue = item.buyPrice * item.quantity;
    const currentValue = currentPrice ? currentPrice.price * item.quantity : null;
    const profitAmount = currentValue === null ? null : currentValue - investedValue;
    const profitPercent = profitAmount === null ? null : (profitAmount / investedValue) * 100;
    const marketChanges = await this.buildMarketChanges(caseItem.id, currentPrice?.price ?? null);

    return {
      item,
      case: caseItem,
      currentPrice: currentPrice?.price ?? null,
      currentPriceCapturedAt: currentPrice?.capturedAt.toISOString() ?? null,
      investedValue,
      currentValue,
      profitAmount,
      profitPercent,
      marketChanges,
    };
  }

  private async buildMarketChanges(
    caseId: string,
    currentPrice: number | null,
  ): Promise<Record<PriceRange, PriceChange>> {
    const entries = await Promise.all(
      PRICE_RANGES.map(async (range) => {
        if (currentPrice === null) {
          return [range, emptyChange()] as const;
        }

        const baseline = await this.snapshotRepository.findClosestBefore(caseId, getRangeStartDate(range));

        if (!baseline || baseline.price <= 0) {
          return [range, emptyChange()] as const;
        }

        const amount = currentPrice - baseline.price;
        return [
          range,
          {
            amount,
            percent: (amount / baseline.price) * 100,
            baselinePrice: baseline.price,
            baselineDate: baseline.capturedAt.toISOString(),
          },
        ] as const;
      }),
    );

    return Object.fromEntries(entries) as Record<PriceRange, PriceChange>;
  }
}

function buildSummary(rows: PortfolioReportRow[]) {
  const totalInvested = rows.reduce((sum, row) => sum + row.investedValue, 0);
  const totalCurrentValue = rows.reduce((sum, row) => sum + (row.currentValue ?? 0), 0);
  const totalProfit = totalCurrentValue - totalInvested;

  return {
    totalInvested,
    totalCurrentValue,
    totalProfit,
    totalProfitPercent: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
    itemCount: rows.reduce((sum, row) => sum + row.item.quantity, 0),
    caseCount: rows.length,
  };
}

function emptyChange(): PriceChange {
  return {
    amount: null,
    percent: null,
    baselinePrice: null,
    baselineDate: null,
  };
}
