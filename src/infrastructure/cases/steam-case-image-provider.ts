import { USER_AGENTS } from "@/utils/api-client";

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

const STEAM_IMAGE_CDN_BASE_URL =
  "https://community.cloudflare.steamstatic.com/economy/image";
const STEAM_MARKET_SEARCH_URL =
  "https://steamcommunity.com/market/search/render/";
const STEAM_IMAGE_SIZE = "96fx96f";

const imageUrlCache = new Map<string, string | null>();

export async function getSteamCaseImageUrl(
  marketHashName: string,
): Promise<string | null> {
  const cacheKey = marketHashName.toLowerCase();
  if (imageUrlCache.has(cacheKey)) {
    return imageUrlCache.get(cacheKey) ?? null;
  }

  try {
    const params = new URLSearchParams({
      query: marketHashName,
      start: "0",
      count: "10",
      search_descriptions: "0",
      sort_column: "popular",
      sort_dir: "desc",
      appid: "730",
      norender: "1",
    });

    const response = await fetch(`${STEAM_MARKET_SEARCH_URL}?${params}`, {
      next: { revalidate: 60 * 60 * 24 },
      headers: {
        "User-Agent": USER_AGENTS.steamApi,
      },
    });

    if (!response.ok) {
      imageUrlCache.set(cacheKey, null);
      return null;
    }

    const data = (await response.json()) as SteamMarketSearchResponse;
    const result = data.results?.find((item) =>
      matchesMarketHashName(item, marketHashName),
    );
    const iconUrl = result?.asset_description?.icon_url;

    if (!data.success || !iconUrl) {
      imageUrlCache.set(cacheKey, null);
      return null;
    }

    const imageUrl = `${STEAM_IMAGE_CDN_BASE_URL}/${iconUrl}/${STEAM_IMAGE_SIZE}`;
    imageUrlCache.set(cacheKey, imageUrl);

    return imageUrl;
  } catch {
    imageUrlCache.set(cacheKey, null);
    return null;
  }
}

function matchesMarketHashName(
  result: SteamMarketSearchResult,
  marketHashName: string,
): boolean {
  const expected = marketHashName.toLowerCase();
  return (
    result.hash_name?.toLowerCase() === expected ||
    result.asset_description?.market_hash_name?.toLowerCase() === expected
  );
}
