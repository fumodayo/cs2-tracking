import type { PortfolioReportDto } from '@/types/report';

const REPORT_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  report: PortfolioReportDto;
  cachedAt: Date;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedPortfolioReport(ownerId: string): PortfolioReportDto | null {
  return getCachedPortfolioReportEntry(ownerId)?.report ?? null;
}

export function getCachedPortfolioReportEntry(ownerId: string): CacheEntry | null {
  const entry = cache.get(ownerId);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(ownerId);
    return null;
  }

  return entry;
}

export function setCachedPortfolioReport(ownerId: string, report: PortfolioReportDto): void {
  cache.set(ownerId, {
    report,
    cachedAt: new Date(),
    expiresAt: Date.now() + REPORT_CACHE_TTL_MS,
  });
}

export function invalidateCachedPortfolioReport(ownerId: string): void {
  cache.delete(ownerId);
}
