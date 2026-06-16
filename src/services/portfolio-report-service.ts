import type { CaseItem } from "@/domain/case-item";
import type { PortfolioItem } from "@/domain/portfolio-item";
import type {
  PortfolioReport,
  PortfolioReportRow,
  PriceChange,
} from "@/domain/portfolio-report";
import {
  PRICE_RANGES,
  type PriceRange,
  type PriceSnapshot,
} from "@/domain/price";
import type {
  CaseRepository,
  PortfolioRepository,
  PriceSnapshotRepository,
} from "@/domain/repositories";
import { PriceService } from "./price-service";
import { getRangeStartDate } from "./date-range";


type BuildReportOptions = {
  forceRefresh?: boolean;
  refreshStalePrices?: boolean;
};

type BaselinesByRange = Map<PriceRange, Map<string, PriceSnapshot>>;

export class PortfolioReportService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly caseRepository: CaseRepository,
    private readonly priceService: PriceService,
    private readonly snapshotRepository: PriceSnapshotRepository,
    private readonly storageUnitRepository: import("@/domain/repositories").StorageUnitRepository,
    private readonly ownerId = "guest",
  ) {}

  async buildReport(options?: BuildReportOptions): Promise<PortfolioReport> {
    const items = await this.portfolioRepository.list();

    // Fetch storage units using repository
    const storageUnits = await this.storageUnitRepository.list();

    // Map storage unit items by caseId and storageUnitId
    const suNames = new Map(
      storageUnits.map((su) => [su.id, su.name]),
    );
    const suSteamIds = new Map(
      storageUnits.map((su) => [su.id, su.steamId64]),
    );
    const suItemsByCaseAndSu = new Map<string, number>();
    for (const su of storageUnits) {
      if (!Array.isArray(su.items)) continue;
      for (const item of su.items) {
        if (!item.caseId || !item.quantity) continue;
        const key = `${item.caseId}_${su.id}`;
        const qty = Number(item.quantity);
        suItemsByCaseAndSu.set(key, (suItemsByCaseAndSu.get(key) ?? 0) + qty);
      }
    }

    // Merge storage units into portfolio items
    const finalItems: PortfolioItem[] = [];
    for (const item of items) {
      const cloned = { ...item };
      if (cloned.storageUnitId) {
        const key = `${cloned.caseId}_${cloned.storageUnitId}`;
        const suQtyAvailable = suItemsByCaseAndSu.get(key) ?? 0;
        const matchQty = Math.min(cloned.quantity, suQtyAvailable);

        cloned.storageUnitQuantity = matchQty;
        cloned.storageUnitDetails =
          matchQty > 0
            ? [
                {
                  storageUnitId: cloned.storageUnitId,
                  storageUnitName:
                    suNames.get(cloned.storageUnitId) ?? "Storage Unit",
                  quantity: matchQty,
                  steamId64: suSteamIds.get(cloned.storageUnitId) ?? "",
                },
              ]
            : [];

        // Deduct from storage unit items so they don't get treated as virtual
        suItemsByCaseAndSu.set(key, suQtyAvailable - matchQty);
      } else {
        cloned.storageUnitQuantity = 0;
        cloned.storageUnitDetails = [];
      }
      finalItems.push(cloned);
    }

    const remainingByCase = new Map<
      string,
      Array<{
        storageUnitId: string;
        storageUnitName: string;
        quantity: number;
        steamId64?: string;
      }>
    >();
    for (const [key, qty] of suItemsByCaseAndSu.entries()) {
      if (qty <= 0) continue;
      const [caseId, suId] = key.split("_");
      let entry = remainingByCase.get(caseId);
      if (!entry) {
        entry = [];
        remainingByCase.set(caseId, entry);
      }
      entry.push({
        storageUnitId: suId,
        storageUnitName: suNames.get(suId) ?? "Storage Unit",
        quantity: qty,
        steamId64: suSteamIds.get(suId) ?? "",
      });
    }

    for (const [caseId, entry] of remainingByCase.entries()) {
      const now = new Date();
      const total = entry.reduce((sum, e) => sum + e.quantity, 0);
      finalItems.push({
        id: `virtual_${caseId}`,
        caseId,
        quantity: 0,
        buyPrice: 0, // Will be resolved to currentPrice in buildRow
        buyCurrency: "VND",
        buyDate: now,
        note: "Chỉ có trong Storage Unit",
        storageUnitQuantity: total,
        storageUnitDetails: entry,
        createdAt: now,
        updatedAt: now,
      });
    }

    const cases = await this.caseRepository.findByIds(
      finalItems.map((item) => item.caseId),
    );
    const caseMap = new Map(cases.map((caseItem) => [caseItem.id, caseItem]));
    const shouldFetchLive = options?.forceRefresh || options?.refreshStalePrices;
    let latestPricesMap = new Map<string, PriceSnapshot>();
    if (!shouldFetchLive) {
      latestPricesMap = await this.snapshotRepository.findLatestMany(
        cases.map((caseItem) => caseItem.id),
      );
    }

    const currentPricePromises = new Map(
      cases.map((caseItem) => {
        if (!shouldFetchLive) {
          const cached = latestPricesMap.get(caseItem.id) ?? null;
          return [caseItem.id, Promise.resolve(cached)];
        }
        return [
          caseItem.id,
          this.priceService.getCurrentPrice(caseItem, {
            forceRefresh: options?.forceRefresh,
            refreshStale: options?.refreshStalePrices,
          }),
        ];
      }),
    );
    const baselinesByRange = await this.loadBaselineSnapshots(
      cases.map((caseItem) => caseItem.id),
    );

    const rows = await Promise.all(
      finalItems.flatMap((item) => {
        const caseItem = caseMap.get(item.caseId);
        const currentPricePromise = caseItem
          ? currentPricePromises.get(caseItem.id)
          : null;
        return caseItem && currentPricePromise
          ? [
              this.buildRow(
                item,
                caseItem,
                currentPricePromise,
                baselinesByRange,
              ),
            ]
          : [];
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
    currentPricePromise: Promise<PriceSnapshot | null>,
    baselinesByRange: BaselinesByRange,
  ): Promise<PortfolioReportRow> {
    const currentPrice = await currentPricePromise;
    const totalQuantity =
      (item.storageUnitId ? 0 : item.quantity) +
      (item.storageUnitQuantity ?? 0);

    // If virtual item, set buy price to current price so profit is neutral, or default to 1000
    let resolvedBuyPrice = item.buyPrice;
    let isTemp = item.isTemporaryPrice;
    if (item.id.startsWith("virtual_") && item.buyPrice === 0) {
      resolvedBuyPrice = currentPrice ? currentPrice.price : 1000;
      isTemp = true;
    }

    const updatedItem = {
      ...item,
      buyPrice: resolvedBuyPrice,
      isTemporaryPrice: isTemp,
    };

    const investedValue = resolvedBuyPrice * totalQuantity;
    const currentValue = currentPrice
      ? currentPrice.price * totalQuantity
      : null;
    const profitAmount =
      currentValue === null ? null : currentValue - investedValue;
    const profitPercent =
      profitAmount === null || investedValue === 0
        ? null
        : (profitAmount / investedValue) * 100;
    const marketChanges = this.buildMarketChanges(
      caseItem.id,
      currentPrice?.price ?? null,
      baselinesByRange,
    );

    return {
      item: updatedItem,
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

  private async loadBaselineSnapshots(
    caseIds: string[],
  ): Promise<BaselinesByRange> {
    const entries = await Promise.all(
      PRICE_RANGES.map(
        async (range) =>
          [
            range,
            await this.snapshotRepository.findClosestBeforeMany(
              caseIds,
              getRangeStartDate(range),
            ),
          ] as const,
      ),
    );

    return new Map(entries);
  }

  private buildMarketChanges(
    caseId: string,
    currentPrice: number | null,
    baselinesByRange: BaselinesByRange,
  ): Record<PriceRange, PriceChange> {
    const entries = PRICE_RANGES.map((range) => {
      if (currentPrice === null) {
        return [range, emptyChange()] as const;
      }

      const baseline = baselinesByRange.get(range)?.get(caseId) ?? null;

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
    });

    return Object.fromEntries(entries) as Record<PriceRange, PriceChange>;
  }
}

function buildSummary(rows: PortfolioReportRow[]) {
  const totalInvested = rows.reduce((sum, row) => sum + row.investedValue, 0);
  const totalCurrentValue = rows.reduce(
    (sum, row) => sum + (row.currentValue ?? 0),
    0,
  );
  const totalProfit = totalCurrentValue - totalInvested;

  return {
    totalInvested,
    totalCurrentValue,
    totalProfit,
    totalProfitPercent:
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
    itemCount: rows.reduce(
      (sum, row) =>
        sum + row.item.quantity + (row.item.storageUnitQuantity ?? 0),
      0,
    ),
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
