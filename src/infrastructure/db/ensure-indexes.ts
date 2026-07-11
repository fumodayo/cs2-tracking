import { Db } from 'mongodb';
import { SCAN_CACHE_STALE_RETENTION_SECONDS } from '@/services/scan-cache-policy';

export async function ensureIndexes(db: Db): Promise<void> {
  console.log('[MongoDB] Bootstrapping indexes...');

  const createSafeIndex = async (
    collectionName: string,
    spec: Record<string, number>,
    options: { unique?: boolean; expireAfterSeconds?: number } = {}
  ) => {
    try {
      await db.collection(collectionName).createIndex(spec, options);
    } catch (err) {
      console.warn(
        `[MongoDB] Failed to create index on ${collectionName} with spec ${JSON.stringify(spec)}:`,
        err
      );
    }
  };

  await Promise.all([
    createSafeIndex('portfolio_items', { ownerId: 1 }),
    createSafeIndex('portfolio_items', { ownerId: 1, createdAt: -1 }),
    createSafeIndex('portfolio_accounts', { ownerId: 1, steamId64: 1 }, { unique: true }),
    createSafeIndex('storage_units', { ownerId: 1 }),
    createSafeIndex('storage_units', { ownerId: 1, steamId64: 1 }),
    createSafeIndex('users', { id: 1 }, { unique: true }),
    createSafeIndex('users', { provider: 1, providerAccountId: 1 }, { unique: true }),
    createSafeIndex('user_buff_prices', { ownerId: 1, marketHashName: 1 }, { unique: true }),
    createSafeIndex('user_buff_prices', { ownerId: 1 }),
    createSafeIndex('portfolio_realtime_events', { ownerId: 1, createdAt: 1 }),
    createSafeIndex('portfolio_realtime_events', { createdAt: 1 }, { expireAfterSeconds: 3600 }),
    createSafeIndex('bug_reports', { createdAt: -1 }),
    createSafeIndex('bug_reports', { status: 1 }),
    createSafeIndex(
      'inventory_scan_cache',
      { expiresAt: 1 },
      { expireAfterSeconds: SCAN_CACHE_STALE_RETENTION_SECONDS }
    ),
    createSafeIndex('inventory_scan_cache', { steamId64: 1 }),
    createSafeIndex('inventory_scan_cache', { cacheKey: 1 }),
    createSafeIndex('inventory_scan_cache', { ownerId: 1, steamId64: 1, hasCookie: 1 }),
    createSafeIndex('scan_jobs', { createdAt: 1 }, { expireAfterSeconds: 3600 }),
    createSafeIndex('scan_jobs', { id: 1 }, { unique: true }),
    createSafeIndex('rate_limits', { updatedAt: 1 }, { expireAfterSeconds: 3600 }),
    createSafeIndex('rate_limits', { key: 1 }, { unique: true }),
  ]);

  console.log('[MongoDB] Indexes bootstrap verification done.');
}
