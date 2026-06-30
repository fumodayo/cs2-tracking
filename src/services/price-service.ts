import type { CaseItem } from '@/domain/case-item';
import type { PriceProvider } from '@/domain/price-provider';
import type { PriceSnapshotRepository } from '@/domain/repositories';
import type { PriceSnapshot } from '@/domain/price';
import { mapWithConcurrency } from '@/services/parser/utils';

const STEAM_PRICE_CACHE_MINUTES = 15;
const DEFAULT_PRICE_LOOKUP_CONCURRENCY = 4;

type PriceLookupOptions = {
  forceRefresh?: boolean;
  refreshStale?: boolean;
  preferFallback?: boolean;
  concurrency?: number;
  onProgress?: (caseItem: CaseItem, snapshot: PriceSnapshot | null) => void;
};

export class PriceService {
  constructor(
    private readonly snapshotRepository: PriceSnapshotRepository,
    private readonly priceProvider: PriceProvider
  ) {}

  async getCurrentPrice(
    caseItem: CaseItem,
    options?: PriceLookupOptions
  ): Promise<PriceSnapshot | null> {
    const latest = await this.snapshotRepository.findLatest(caseItem.id);
    const shouldRefreshStale = options?.refreshStale ?? true;

    if (
      !options?.forceRefresh &&
      latest &&
      (!shouldRefreshStale || isFresh(latest.capturedAt, STEAM_PRICE_CACHE_MINUTES))
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

  async getCurrentPrices(
    caseItems: CaseItem[],
    options?: PriceLookupOptions
  ): Promise<Map<string, PriceSnapshot | null>> {
    const uniqueItems = Array.from(
      new Map(caseItems.map((caseItem) => [caseItem.id, caseItem])).values()
    );
    const result = new Map<string, PriceSnapshot | null>();
    if (uniqueItems.length === 0) {
      return result;
    }

    const latestByCaseId = await this.snapshotRepository.findLatestMany(
      uniqueItems.map((caseItem) => caseItem.id)
    );
    const shouldRefreshStale = options?.refreshStale ?? true;
    const needsRefresh: CaseItem[] = [];

    for (const caseItem of uniqueItems) {
      const latest = latestByCaseId.get(caseItem.id);

      if (
        !options?.forceRefresh &&
        latest &&
        (!shouldRefreshStale || isFresh(latest.capturedAt, STEAM_PRICE_CACHE_MINUTES))
      ) {
        const snapshot = { ...latest, isCached: true };
        result.set(caseItem.id, snapshot);
        options?.onProgress?.(caseItem, snapshot);
        continue;
      }

      if (!options?.forceRefresh && !shouldRefreshStale) {
        const snapshot = latest ? { ...latest, isCached: true } : null;
        result.set(caseItem.id, snapshot);
        options?.onProgress?.(caseItem, snapshot);
        continue;
      }

      needsRefresh.push(caseItem);
    }

    const refreshedEntries = await mapWithConcurrency(
      needsRefresh,
      options?.concurrency ?? DEFAULT_PRICE_LOOKUP_CONCURRENCY,
      async (caseItem): Promise<[string, PriceSnapshot | null]> => {
        const latest = latestByCaseId.get(caseItem.id);
        const livePrice = await this.priceProvider.getCurrentPrice(caseItem, {
          preferFallback: options?.preferFallback,
        });

        if (!livePrice) {
          const snapshot = latest ? { ...latest, isCached: true } : null;
          options?.onProgress?.(caseItem, snapshot);
          return [caseItem.id, snapshot];
        }

        const created = await this.snapshotRepository.create(livePrice);
        const snapshot = { ...created, isCached: false };
        options?.onProgress?.(caseItem, snapshot);
        return [caseItem.id, snapshot];
      }
    );

    for (const [caseId, snapshot] of refreshedEntries) {
      result.set(caseId, snapshot);
    }

    return result;
  }
}

function isFresh(date: Date, cacheMinutes: number): boolean {
  const ageMs = Date.now() - date.getTime();
  return ageMs <= cacheMinutes * 60 * 1000;
}
