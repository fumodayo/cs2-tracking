import { getDatabase } from '@/infrastructure/db/mongo-client';
import type { StorageUnitInfo } from '@/domain/storage-unit';
import type { PatternInfo } from '@/domain/pattern-info';
import type { Cs2InventoryItemType } from '@/utils/cs2-item-type';

export type SteamProfile = {
  name: string;
  avatarUrl: string | null;
};

export type ScanItem = {
  caseItem: {
    id: string;
    name: string;
    marketHashName: string;
    imageUrl: string | null;
    isActive: boolean;
  };
  type: Cs2InventoryItemType;
  rarity?: {
    name: string;
    color: string;
  };
  steamMarketUrl?: string;
  quantity: number;
  price: number;
  total: number;
  holdDays?: number;
  tradeHoldUntil?: string;
  onMarket?: boolean;
  tradeProtected?: boolean;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: PatternInfo;
};

export type CachedScanResult = {
  steamId64: string;
  profile: SteamProfile;
  items: ScanItem[];
  totalPrice: number;
  totalQuantity: number;
  totalInventoryCount: number;
  scannedAt: Date;
  expiresAt: Date;
  marketScanWarning?: boolean;
  storageUnits?: StorageUnitInfo[];
  hasCookie?: boolean;
  walletBalance?: string | null;
  walletBalanceVnd?: number | null;
  cookieError?: string | null;
};

export type ScanCacheScope = {
  steamId64: string;
  ownerId?: string;
  hasCookie: boolean;
};

const COLLECTION_NAME = 'inventory_scan_cache';

/**
 * Calculates the next 14:00 (UTC+7) after the current moment.
 * If it's currently before 14:00 today → expires today at 14:00.
 * If it's 14:00 or later → expires tomorrow at 14:00.
 */
export function getNextExpiry(): Date {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
  const now = new Date();

  // Current time in Vietnam
  const nowVN = new Date(now.getTime() + VN_OFFSET_MS);

  // Build "today 14:00" in Vietnam time, then convert back to UTC
  const todayVN14 = new Date(
    Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate(), 14, 0, 0, 0)
  );
  // todayVN14 is in "VN wall-clock as UTC", subtract offset to get real UTC
  const todayUtc14 = new Date(todayVN14.getTime() - VN_OFFSET_MS);

  if (now < todayUtc14) {
    return todayUtc14; // today at 14:00 VN
  }
  return new Date(todayUtc14.getTime() + 24 * 60 * 60 * 1000); // tomorrow at 14:00 VN
}

export async function ensureCacheIndexes() {
  const db = await getDatabase();
  const col = db.collection(COLLECTION_NAME);
  // TTL index — MongoDB checks every ~60s and deletes docs whose expiresAt < now
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  await col.createIndex({ steamId64: 1 }).catch(() => {});
  await col.createIndex({ cacheKey: 1 }).catch(() => {});
  await col.createIndex({ ownerId: 1, steamId64: 1, hasCookie: 1 }).catch(() => {});
}

export async function getCachedScan(
  scopeOrSteamId: ScanCacheScope | string,
  optionsOrIgnoreExpiry: { ignoreExpiry?: boolean } | boolean = {}
): Promise<CachedScanResult | null> {
  const scope =
    typeof scopeOrSteamId === 'string'
      ? { steamId64: scopeOrSteamId, hasCookie: false }
      : scopeOrSteamId;
  const ignoreExpiry =
    typeof optionsOrIgnoreExpiry === 'boolean'
      ? optionsOrIgnoreExpiry
      : optionsOrIgnoreExpiry.ignoreExpiry === true;
  const cacheKey = buildCacheKey(scope);
  if (!cacheKey) {
    return null;
  }

  const db = await getDatabase();
  const query: Record<string, unknown> = { cacheKey };
  if (!ignoreExpiry) {
    query.expiresAt = { $gt: new Date() };
  }
  const doc = await db.collection(COLLECTION_NAME).findOne(query);
  if (!doc) {
    return null;
  }

  const result = doc as unknown as CachedScanResult;
  return scope.hasCookie ? result : stripPrivateScanFields(result);
}

export async function saveScanToCache(
  scopeOrResult: ScanCacheScope | CachedScanResult,
  maybeResult?: CachedScanResult
): Promise<void> {
  const scope =
    maybeResult === undefined
      ? {
          steamId64: (scopeOrResult as CachedScanResult).steamId64,
          hasCookie: Boolean((scopeOrResult as CachedScanResult).hasCookie),
        }
      : (scopeOrResult as ScanCacheScope);
  const result = maybeResult ?? (scopeOrResult as CachedScanResult);
  const cacheKey = buildCacheKey(scope);
  if (!cacheKey) {
    return;
  }

  const db = await getDatabase();
  const ownerId = normalizeOwnerId(scope.ownerId);
  const safeResult = scope.hasCookie ? result : stripPrivateScanFields(result);
  const doc = {
    ...safeResult,
    steamId64: scope.steamId64,
    hasCookie: scope.hasCookie,
    cacheKey,
    ...(scope.hasCookie && ownerId ? { ownerId } : {}),
  };

  await db.collection(COLLECTION_NAME).updateOne(
    { cacheKey },
    {
      $set: doc,
      ...(scope.hasCookie ? {} : { $unset: { ownerId: '' } }),
    },
    { upsert: true }
  );
}

function normalizeOwnerId(ownerId?: string): string | undefined {
  const trimmed = ownerId?.trim();
  return trimmed && trimmed !== 'guest' ? trimmed : undefined;
}

function buildCacheKey(scope: ScanCacheScope): string | null {
  if (!scope.hasCookie) {
    return `public:${scope.steamId64}`;
  }

  const ownerId = normalizeOwnerId(scope.ownerId);
  if (!ownerId) {
    return null;
  }

  return `private:${ownerId}:${scope.steamId64}`;
}

function stripPrivateScanFields(result: CachedScanResult): CachedScanResult {
  const publicResult: CachedScanResult = { ...result };
  delete publicResult.walletBalance;
  delete publicResult.walletBalanceVnd;
  delete publicResult.storageUnits;
  return {
    ...publicResult,
    hasCookie: false,
  };
}
