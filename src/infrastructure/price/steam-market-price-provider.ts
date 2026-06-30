import type { CaseItem } from '@/domain/case-item';
import type { PriceProvider } from '@/domain/price-provider';
import type { CurrentPrice } from '@/domain/price';
import { USER_AGENTS } from '@/utils/api-client';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

type SteamPriceOverviewResponse = {
  success?: boolean;
  lowest_price?: string;
  median_price?: string;
};

type ExchangeRateResponse = {
  result?: string;
  rates?: {
    VND?: number;
  };
  time_next_update_unix?: number;
};

const FALLBACK_USD_TO_VND_RATE = 25000;
const EXCHANGE_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const EXCHANGE_RATE_REVALIDATE_SECONDS = 60 * 60;
const STEAM_PRICE_TIMEOUT_MS = 8_000;
const STEAM_PRICE_MAX_ATTEMPTS = 2;
const STEAM_PRICE_RETRY_DELAY_MS = 700;
const EXCHANGE_RATE_TIMEOUT_MS = 5_000;

let cachedUsdToVndRate: { rate: number; expiresAt: number } | null = null;
let pendingUsdToVndRate: Promise<number> | null = null;

import * as fs from 'fs';
import * as path from 'path';

const FALLBACK_PRICES_CACHE_FILE = path.join(process.cwd(), 'steam_prices_fallback_cache.json');
const FALLBACK_PRICES_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

let inMemoryFallbackPrices: Record<string, number> | null = null;
let lastLoadedTime = 0;
let pendingFallbackPrices: Promise<Record<string, number>> | null = null;

interface CsgoTraderSteamItem {
  last_24h?: number;
  last_7d?: number;
  last_30d?: number;
  last_90d?: number;
}

async function getFallbackPrices(): Promise<Record<string, number>> {
  if (inMemoryFallbackPrices && Date.now() - lastLoadedTime < 30 * 60 * 1000) {
    return inMemoryFallbackPrices;
  }

  pendingFallbackPrices ??= loadFallbackPrices().finally(() => {
    pendingFallbackPrices = null;
  });

  return pendingFallbackPrices;
}

async function loadFallbackPrices(): Promise<Record<string, number>> {
  try {
    if (fs.existsSync(FALLBACK_PRICES_CACHE_FILE)) {
      const stats = fs.statSync(FALLBACK_PRICES_CACHE_FILE);
      if (Date.now() - stats.mtimeMs < FALLBACK_PRICES_CACHE_MAX_AGE_MS) {
        const content = fs.readFileSync(FALLBACK_PRICES_CACHE_FILE, 'utf-8');
        inMemoryFallbackPrices = JSON.parse(content);
        lastLoadedTime = Date.now();
        return inMemoryFallbackPrices!;
      }
    }
  } catch (err) {
    console.error('Failed to read fallback prices cache file:', err);
  }

  try {
    const res = await fetchWithTimeout(
      'https://prices.csgotrader.app/latest/steam.json',
      {
        headers: {
          'User-Agent': USER_AGENTS.steamBrowser,
          Accept: 'application/json',
        },
      },
      15000
    );

    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = (await res.json()) as Record<string, CsgoTraderSteamItem>;
        const pricesMap: Record<string, number> = {};

        for (const [name, item] of Object.entries(data)) {
          if (item && typeof item === 'object') {
            const price = item.last_24h ?? item.last_7d ?? item.last_30d ?? item.last_90d;
            if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
              pricesMap[name] = price;
            }
          }
        }

        inMemoryFallbackPrices = pricesMap;
        lastLoadedTime = Date.now();

        fs.writeFile(FALLBACK_PRICES_CACHE_FILE, JSON.stringify(pricesMap), 'utf-8', (err) => {
          if (err) console.error('Failed to write fallback prices cache file:', err);
        });

        return pricesMap;
      }
    }
  } catch (err) {
    console.error('Failed to fetch fresh fallback prices from CSGOTrader:', err);
  }

  try {
    if (fs.existsSync(FALLBACK_PRICES_CACHE_FILE)) {
      const content = fs.readFileSync(FALLBACK_PRICES_CACHE_FILE, 'utf-8');
      inMemoryFallbackPrices = JSON.parse(content);
      lastLoadedTime = Date.now();
      return inMemoryFallbackPrices!;
    }
  } catch {
    // ignore fallback cache failure
  }

  return {};
}

async function fetchFallbackUsdPrice(marketHashName: string): Promise<number | null> {
  try {
    const prices = await getFallbackPrices();
    const price = prices[marketHashName];
    if (typeof price === 'number' && price > 0) {
      return price;
    }
  } catch (err) {
    console.error('Failed to get fallback USD price from CSGOTrader database:', err);
  }
  return null;
}

export class SteamMarketPriceProvider implements PriceProvider {
  async getCurrentPrice(
    caseItem: CaseItem,
    options?: { preferFallback?: boolean }
  ): Promise<CurrentPrice | null> {
    if (options?.preferFallback) {
      const vndPrice = await fetchFallbackVndPrice(caseItem.marketHashName);
      if (vndPrice !== null) {
        return {
          caseId: caseItem.id,
          price: vndPrice,
          currency: 'VND',
          source: 'csgotrader-fallback',
          capturedAt: new Date(),
        };
      }
    }

    for (let attempt = 1; attempt <= STEAM_PRICE_MAX_ATTEMPTS; attempt++) {
      const vndPrice = await fetchVndMarketPrice(caseItem.marketHashName);
      if (vndPrice !== null) {
        return {
          caseId: caseItem.id,
          price: vndPrice,
          currency: 'VND',
          source: 'steam-market',
          capturedAt: new Date(),
        };
      }

      if (attempt < STEAM_PRICE_MAX_ATTEMPTS) {
        await delay(STEAM_PRICE_RETRY_DELAY_MS * attempt);
      }
    }

    return null;
  }
}

async function fetchFallbackVndPrice(marketHashName: string): Promise<number | null> {
  const usdPrice = await fetchFallbackUsdPrice(marketHashName);
  if (usdPrice !== null) {
    const usdToVndRate = await getUsdToVndRate();
    return Math.round(usdPrice * usdToVndRate);
  }
  return null;
}

async function fetchVndMarketPrice(marketHashName: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      appid: '730',
      currency: '15', // 15 = VND
      market_hash_name: marketHashName,
    });

    const response = await fetchWithTimeout(
      `https://steamcommunity.com/market/priceoverview/?${params}`,
      {
        next: { revalidate: 60 },
        headers: {
          'User-Agent': USER_AGENTS.steamApi,
        },
      },
      STEAM_PRICE_TIMEOUT_MS
    );

    if (response.status === 429) {
      console.warn(
        `Steam rate limit hit (429) for ${marketHashName}. Using CSGOTrader steam price database fallback.`
      );
      return await fetchFallbackVndPrice(marketHashName);
    }

    if (!response.ok) {
      return await fetchFallbackVndPrice(marketHashName);
    }

    const data = (await response.json()) as SteamPriceOverviewResponse;
    const rawPrice = data.lowest_price ?? data.median_price;

    const usdToVndRate = await getUsdToVndRate();
    const vndPrice = rawPrice ? parseVndPrice(rawPrice, usdToVndRate) : null;

    if (!data.success || vndPrice === null) {
      return await fetchFallbackVndPrice(marketHashName);
    }

    return vndPrice;
  } catch (error) {
    console.warn(
      `Error fetching Steam price for ${marketHashName}:`,
      error,
      '. Falling back to CSGOTrader database.'
    );
    return await fetchFallbackVndPrice(marketHashName);
  }
}

function parseUsdPrice(value: string): number | null {
  const normalized = value.replace(/[^0-9.,]/g, '').replace(',', '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseVndPrice(value: string, usdToVndRate: number): number | null {
  if (value.includes('$')) {
    const usd = parseUsdPrice(value);
    return usd !== null ? Math.round(usd * usdToVndRate) : null;
  }

  // Keep only digits, dots, and commas
  const cleaned = value.replace(/[^0-9.,]/g, '');

  let noThousands = cleaned;
  if (cleaned.includes(',')) {
    noThousands = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    noThousands = cleaned.replace(/\./g, '');
  }

  const parsed = Number(noThousands);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function getUsdToVndRate(): Promise<number> {
  if (cachedUsdToVndRate && cachedUsdToVndRate.expiresAt > Date.now()) {
    return cachedUsdToVndRate.rate;
  }

  pendingUsdToVndRate ??= fetchUsdToVndRate().finally(() => {
    pendingUsdToVndRate = null;
  });

  return pendingUsdToVndRate;
}

async function fetchUsdToVndRate(): Promise<number> {
  try {
    const response = await fetchWithTimeout(
      EXCHANGE_RATE_URL,
      {
        next: { revalidate: EXCHANGE_RATE_REVALIDATE_SECONDS },
        headers: {
          'User-Agent': USER_AGENTS.default,
        },
      },
      EXCHANGE_RATE_TIMEOUT_MS
    );

    if (!response.ok) {
      return getFallbackUsdToVndRate();
    }

    const data = (await response.json()) as ExchangeRateResponse;
    const rate = data.rates?.VND;

    if (data.result !== 'success' || !isValidRate(rate)) {
      return getFallbackUsdToVndRate();
    }

    cachedUsdToVndRate = {
      rate,
      expiresAt: getExchangeRateExpiry(data.time_next_update_unix),
    };

    return rate;
  } catch {
    return getFallbackUsdToVndRate();
  }
}

function getFallbackUsdToVndRate(): number {
  if (cachedUsdToVndRate) {
    return cachedUsdToVndRate.rate;
  }

  return FALLBACK_USD_TO_VND_RATE;
}

function getExchangeRateExpiry(nextUpdateUnix?: number): number {
  if (typeof nextUpdateUnix === 'number' && nextUpdateUnix > Date.now() / 1000) {
    return nextUpdateUnix * 1000;
  }

  return Date.now() + EXCHANGE_RATE_REVALIDATE_SECONDS * 1000;
}

function isValidRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
