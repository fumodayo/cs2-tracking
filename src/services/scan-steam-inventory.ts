import { getDatabase } from '@/infrastructure/db/mongo-client';
import { updateScanJob } from '@/services/scan-job-store';
import { fetchSteamWithRateLimitRetry } from '@/services/steam-fetch-retry';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

const STEAM_INVENTORY_FETCH_TIMEOUT_MS = 25_000;
const STEAM_MARKET_LISTINGS_TIMEOUT_MS = 20_000;

export type SteamInventoryAsset = {
  classid: string;
  instanceid: string;
  amount: string;
  assetid: string;
  onMarket?: boolean;
};

export type SteamInventoryDescription = {
  classid: string;
  instanceid: string;
  name?: string;
  market_hash_name: string;
  marketable: number;
  type: string;
  icon_url?: string;
  tags?: Array<{
    category?: string;
    internal_name?: string;
    localized_tag_name?: string;
    color?: string;
  }>;
  owner_descriptions?: Array<{
    type: string;
    value: string;
    color?: string;
  }>;
  descriptions?: Array<{
    type: string;
    value: string;
    color?: string;
  }>;
  actions?: Array<{
    name?: string;
    link?: string;
  }>;
};

export type SteamAssetProperties = {
  appid?: number;
  contextid?: string;
  assetid: string;
  asset_properties?: Array<{
    propertyid: number;
    int_value?: string;
    float_value?: string;
    string_value?: string;
    name?: string;
  }>;
};

type SteamInventoryApiResponse = {
  success?: boolean | number;
  Error?: string;
  assets?: SteamInventoryAsset[];
  descriptions?: SteamInventoryDescription[];
  asset_properties?: SteamAssetProperties[];
  total_inventory_count?: number;
  more_items?: boolean;
  last_assetid?: string;
};

type SteamMarketListing = {
  asset?: {
    appid?: number;
    id: string;
    amount?: string;
  };
};

type SteamMarketAssetDescription = {
  classid: string;
  instanceid: string;
  name?: string;
  market_hash_name?: string;
  type?: string;
  icon_url?: string;
  tags?: SteamInventoryDescription['tags'];
};

type SteamMarketListingsResponse = {
  success?: boolean;
  listings?: SteamMarketListing[];
  assets?: {
    '730'?: {
      '2'?: Record<string, SteamMarketAssetDescription>;
    };
  };
  total_count?: number;
};

type FetchSteamInventorySnapshotParams = {
  jobId: string;
  steamId64: string;
  ownerId?: string;
  hasCookie: boolean;
  steamHeaders: Record<string, string>;
};

export async function fetchSteamInventorySnapshot({
  jobId,
  steamId64,
  ownerId,
  hasCookie,
  steamHeaders,
}: FetchSteamInventorySnapshotParams) {
  const assets: SteamInventoryAsset[] = [];
  const descriptions: SteamInventoryDescription[] = [];
  const assetProperties: SteamAssetProperties[] = [];
  let totalInventoryCount = 0;
  const contexts = [2];
  if (hasCookie) {
    contexts.push(16);
  }

  for (const contextId of contexts) {
    let startAssetId: string | undefined;
    let contextTotalAdded = false;

    for (let page = 0; page < 20; page++) {
      updateScanJob(jobId, {
        percent: 30 + Math.min(page * 2, 20) + (contextId === 16 ? 10 : 0),
        message: 'loadingInventory',
        detail: { group: contextId, page: page + 1 },
      });

      let inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/${contextId}?l=english&count=2000`;
      if (startAssetId) {
        inventoryUrl += `&start_assetid=${startAssetId}`;
      }

      const response = await fetchInventoryPage({
        jobId,
        inventoryUrl,
        steamHeaders,
        contextId,
        hasPartialResults: assets.length > 0,
      });

      if (!response) break;

      if (response.status === 403) {
        await handleInventoryForbiddenResponse({
          inventoryUrl,
          steamHeaders,
          contextId,
          hasCookie,
          steamId64,
          ownerId,
        });
      }

      if (!response.ok) {
        if (contextId === 16) {
          console.error(`Context 16 returned status ${response.status}. Skipping.`);
          break;
        }
        if (assets.length > 0) break;
        if (response.status === 429) {
          throw new Error('steamRateLimited');
        }
        throw new Error(`steamHttpError:status=${response.status}`);
      }

      const data = (await response.json()) as SteamInventoryApiResponse;

      if (data.success === false || data.success === 0) {
        if (contextId === 16) {
          console.error(`Context 16 returned success = false. Skipping.`);
          break;
        }
        if (assets.length > 0) break;
        throw new Error(data.Error || 'privateInventoryOrNotFound');
      }

      if (data.assets) assets.push(...data.assets);
      if (data.descriptions) descriptions.push(...data.descriptions);
      if (data.asset_properties) assetProperties.push(...data.asset_properties);

      if (data.total_inventory_count && !contextTotalAdded) {
        totalInventoryCount += data.total_inventory_count;
        contextTotalAdded = true;
      }

      if (!data.more_items || !data.last_assetid) break;
      startAssetId = data.last_assetid;
    }
  }

  const marketScanWarning = await appendSteamMarketListings({
    jobId,
    hasCookie,
    steamHeaders,
    assets,
    descriptions,
  });

  if (assets.length === 0) {
    throw new Error('emptyOrPrivateInventory');
  }

  return {
    assets,
    descriptions,
    assetProperties,
    totalInventoryCount,
    marketScanWarning,
  };
}

async function fetchInventoryPage({
  jobId,
  inventoryUrl,
  steamHeaders,
  contextId,
  hasPartialResults,
}: {
  jobId: string;
  inventoryUrl: string;
  steamHeaders: Record<string, string>;
  contextId: number;
  hasPartialResults: boolean;
}): Promise<Response | null> {
  try {
    return await fetchSteamWithRateLimitRetry(
      inventoryUrl,
      { headers: steamHeaders },
      STEAM_INVENTORY_FETCH_TIMEOUT_MS,
      {
        onRateLimitRetry: ({ nextAttempt, maxAttempts, delayMs }) => {
          updateScanJob(jobId, {
            message: 'steamRateLimitRetry',
            detail: {
              attempt: nextAttempt,
              max: maxAttempts,
              seconds: Math.ceil(delayMs / 1_000),
            },
          });
        },
      }
    );
  } catch (err) {
    if (contextId === 16) {
      console.error('Context 16 timed out/failed. Skipping trade-protected items.', err);
      return null;
    }
    if (hasPartialResults) {
      console.error('Inventory page timed out/failed after partial results. Continuing.', err);
      return null;
    }
    throw err;
  }
}

async function handleInventoryForbiddenResponse({
  inventoryUrl,
  steamHeaders,
  contextId,
  hasCookie,
  steamId64,
  ownerId,
}: {
  inventoryUrl: string;
  steamHeaders: Record<string, string>;
  contextId: number;
  hasCookie: boolean;
  steamId64: string;
  ownerId?: string;
}) {
  if (contextId === 16) {
    console.error('Context 16 returned 403 Forbidden. Skipping trade-protected items.');
    return;
  }

  if (!hasCookie) {
    throw new Error('privateInventoryNoCookie');
  }

  const fallbackHeaders = { ...steamHeaders };
  delete fallbackHeaders['Cookie'];
  const fallbackRes = await fetchWithTimeout(
    inventoryUrl,
    { headers: fallbackHeaders },
    STEAM_INVENTORY_FETCH_TIMEOUT_MS
  );

  if (ownerId) {
    const db = await getDatabase();
    const cookieError = fallbackRes.ok
      ? 'familyViewCookieRequired'
      : 'privateInventoryCookieRequired';
    await db.collection('portfolio_accounts').updateOne(
      { steamId64, ownerId },
      {
        $set: fallbackRes.ok ? { cookieError } : { steamCookie: '', cookieError },
      }
    );
  }

  if (fallbackRes.ok) {
    throw new Error('familyViewInvalidParentalCookie');
  }
  throw new Error('privateInventoryCookieRequired');
}

async function appendSteamMarketListings({
  jobId,
  hasCookie,
  steamHeaders,
  assets,
  descriptions,
}: {
  jobId: string;
  hasCookie: boolean;
  steamHeaders: Record<string, string>;
  assets: SteamInventoryAsset[];
  descriptions: SteamInventoryDescription[];
}): Promise<boolean> {
  const descriptionKeys = new Set(descriptions.map((desc) => `${desc.classid}_${desc.instanceid}`));
  if (!hasCookie) return true;

  try {
    let start = 0;
    const count = 100;
    let hasMoreListings = true;
    let success = true;
    let marketScanCount = assets.filter((asset) => asset.onMarket).length;

    while (hasMoreListings) {
      updateScanJob(jobId, {
        percent: 52,
        message: 'scanningMarketListings',
        detail: { count: marketScanCount },
      });

      const marketUrl = `https://steamcommunity.com/market/mylistings?norender=1&start=${start}&count=${count}`;
      const marketRes = await fetchWithTimeout(
        marketUrl,
        { headers: steamHeaders },
        STEAM_MARKET_LISTINGS_TIMEOUT_MS
      );
      if (!marketRes.ok) {
        console.error(`Steam Market listings error: HTTP ${marketRes.status}`);
        success = false;
        break;
      }

      const marketData = (await marketRes.json()) as SteamMarketListingsResponse;
      if (!marketData || marketData.success === false) {
        console.error('Steam Market listings success = false');
        success = false;
        break;
      }

      const listings = marketData.listings || [];
      const cs2Assets = marketData.assets?.['730']?.['2'] || {};

      for (const listing of listings) {
        const asset = listing.asset;
        if (!asset || asset.appid !== 730) continue;

        const assetId = asset.id;
        const assetDetail = cs2Assets[assetId];
        if (!assetDetail) continue;

        assets.push({
          classid: assetDetail.classid,
          instanceid: assetDetail.instanceid,
          amount: asset.amount || '1',
          assetid: assetId,
          onMarket: true,
        });
        marketScanCount += 1;

        const key = `${assetDetail.classid}_${assetDetail.instanceid}`;
        if (!descriptionKeys.has(key)) {
          descriptions.push({
            classid: assetDetail.classid,
            instanceid: assetDetail.instanceid,
            name: assetDetail.name,
            market_hash_name: assetDetail.market_hash_name || assetDetail.name || '',
            marketable: 1,
            type: assetDetail.type || '',
            icon_url: assetDetail.icon_url,
            tags: assetDetail.tags,
          });
          descriptionKeys.add(key);
        }
      }

      if (listings.length < count || start + listings.length >= (marketData.total_count ?? 0)) {
        hasMoreListings = false;
      } else {
        start += listings.length;
      }
    }

    return !success;
  } catch (err) {
    console.error('Failed to fetch market listings:', err);
    return true;
  }
}
