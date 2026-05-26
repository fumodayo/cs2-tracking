import type { CaseItem } from "@/domain/case-item";
import type { PriceProvider } from "@/domain/price-provider";
import type { CurrentPrice } from "@/domain/price";

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
const EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/USD";
const EXCHANGE_RATE_REVALIDATE_SECONDS = 60 * 60;

let cachedUsdToVndRate: { rate: number; expiresAt: number } | null = null;
let pendingUsdToVndRate: Promise<number> | null = null;

export class SteamMarketPriceProvider implements PriceProvider {
  async getCurrentPrice(caseItem: CaseItem): Promise<CurrentPrice | null> {
    const params = new URLSearchParams({
      appid: "730",
      currency: "1",
      market_hash_name: caseItem.marketHashName,
    });

    const response = await fetch(`https://steamcommunity.com/market/priceoverview/?${params}`, {
      next: { revalidate: 60 },
      headers: {
        "User-Agent": "cs2-case-tracker/0.1",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SteamPriceOverviewResponse;
    const rawPrice = data.lowest_price ?? data.median_price;
    const usdPrice = rawPrice ? parseUsdPrice(rawPrice) : null;

    if (!data.success || usdPrice === null) {
      return null;
    }

    const usdToVndRate = await getUsdToVndRate();

    return {
      caseId: caseItem.id,
      price: Math.round(usdPrice * usdToVndRate),
      currency: "VND",
      source: "steam-market",
      capturedAt: new Date(),
    };
  }
}

function parseUsdPrice(value: string): number | null {
  const normalized = value.replace(/[^0-9.,]/g, "").replace(",", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getUsdToVndRate(): Promise<number> {
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
    const response = await fetch(EXCHANGE_RATE_URL, {
      next: { revalidate: EXCHANGE_RATE_REVALIDATE_SECONDS },
      headers: {
        "User-Agent": "cs2-case-tracker/0.1",
      },
    });

    if (!response.ok) {
      return getFallbackUsdToVndRate();
    }

    const data = (await response.json()) as ExchangeRateResponse;
    const rate = data.rates?.VND;

    if (data.result !== "success" || !isValidRate(rate)) {
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
  if (typeof nextUpdateUnix === "number" && nextUpdateUnix > Date.now() / 1000) {
    return nextUpdateUnix * 1000;
  }

  return Date.now() + EXCHANGE_RATE_REVALIDATE_SECONDS * 1000;
}

function isValidRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}
