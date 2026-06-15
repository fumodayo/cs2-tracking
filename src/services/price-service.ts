import type { CaseItem } from "@/domain/case-item";
import type { PriceProvider } from "@/domain/price-provider";
import type { PriceSnapshotRepository } from "@/domain/repositories";
import type { PriceSnapshot } from "@/domain/price";

const STEAM_PRICE_CACHE_MINUTES = 15;

type PriceLookupOptions = {
  forceRefresh?: boolean;
  refreshStale?: boolean;
  preferFallback?: boolean;
};

export class PriceService {
  constructor(
    private readonly snapshotRepository: PriceSnapshotRepository,
    private readonly priceProvider: PriceProvider,
  ) {}

  async getCurrentPrice(
    caseItem: CaseItem,
    options?: PriceLookupOptions,
  ): Promise<PriceSnapshot | null> {
    const latest = await this.snapshotRepository.findLatest(caseItem.id);
    const shouldRefreshStale = options?.refreshStale ?? true;

    if (
      !options?.forceRefresh &&
      latest &&
      (!shouldRefreshStale ||
        isFresh(latest.capturedAt, STEAM_PRICE_CACHE_MINUTES))
    ) {
      return { ...latest, isCached: true };
    }

    if (!options?.forceRefresh && !shouldRefreshStale) {
      return latest ? { ...latest, isCached: true } : null;
    }

    const livePrice = await this.priceProvider.getCurrentPrice(caseItem, {
      preferFallback: options?.preferFallback,
    });

    if (!livePrice) {
      return latest ? { ...latest, isCached: true } : null;
    }

    const created = await this.snapshotRepository.create(livePrice);
    return { ...created, isCached: false };
  }
}

function isFresh(date: Date, cacheMinutes: number): boolean {
  const ageMs = Date.now() - date.getTime();
  return ageMs <= cacheMinutes * 60 * 1000;
}
