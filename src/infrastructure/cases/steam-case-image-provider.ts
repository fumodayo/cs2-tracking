import { fetchSteamWithRateLimitRetry } from '@/services/steam-fetch-retry';
import { USER_AGENTS } from '@/utils/api-client';

type SteamMarketSearchResponse = {
  success?: boolean;
  results?: SteamMarketSearchResult[];
};

type SteamMarketSearchResult = {
  hash_name?: string;
  asset_description?: {
    icon_url?: string;
    market_hash_name?: string;
  };
};

const STEAM_IMAGE_CDN_BASE_URL = 'https://community.cloudflare.steamstatic.com/economy/image';
const STEAM_MARKET_SEARCH_URL = 'https://steamcommunity.com/market/search/render/';
const STEAM_IMAGE_SIZE = '96fx96f';
const STEAM_SEARCH_TIMEOUT_MS = 10_000;

const imageUrlCache = new Map<string, string>();
const pendingImageRequests = new Map<string, Promise<string | null>>();

export async function getSteamCaseImageUrl(marketHashName: string): Promise<string | null> {
  const normalizedMarketHashName = marketHashName.trim();
  const cacheKey = normalizedMarketHashName.toLowerCase();
  const cachedImageUrl = imageUrlCache.get(cacheKey);
  if (cachedImageUrl) {
    return cachedImageUrl;
  }

  const pendingRequest = pendingImageRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = fetchSteamCaseImageUrl(normalizedMarketHashName, cacheKey).finally(() => {
    pendingImageRequests.delete(cacheKey);
  });
  pendingImageRequests.set(cacheKey, request);

  return request;
}

async function fetchSteamCaseImageUrl(
  marketHashName: string,
  cacheKey: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      query: marketHashName,
      start: '0',
      count: '10',
      search_descriptions: '0',
      sort_column: 'popular',
      sort_dir: 'desc',
      appid: '730',
      norender: '1',
    });

    const response = await fetchSteamWithRateLimitRetry(
      `${STEAM_MARKET_SEARCH_URL}?${params}`,
      {
        cache: 'no-store',
        headers: {
          'User-Agent': USER_AGENTS.steamApi,
        },
      },
      STEAM_SEARCH_TIMEOUT_MS,
      {
        maxAttempts: 2,
        baseDelayMs: 250,
        maxDelayMs: 1_000,
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SteamMarketSearchResponse;
    const result = data.results?.find((item) => matchesMarketHashName(item, marketHashName));
    const iconUrl = result?.asset_description?.icon_url;

    if (!data.success || !iconUrl) {
      return null;
    }

    const imageUrl = `${STEAM_IMAGE_CDN_BASE_URL}/${iconUrl}/${STEAM_IMAGE_SIZE}`;
    imageUrlCache.set(cacheKey, imageUrl);

    return imageUrl;
  } catch {
    return null;
  }
}

function matchesMarketHashName(result: SteamMarketSearchResult, marketHashName: string): boolean {
  const expected = marketHashName.toLowerCase();
  return (
    result.hash_name?.toLowerCase() === expected ||
    result.asset_description?.market_hash_name?.toLowerCase() === expected
  );
}
