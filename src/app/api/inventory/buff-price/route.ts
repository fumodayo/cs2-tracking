import { NextRequest, NextResponse } from 'next/server';
import { USER_AGENTS } from '@/utils/api-client';
import { buffPriceRateLimiter } from '@/infrastructure/rate-limiter';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

const CS2CAP_API_BASE_URL = 'https://api.cs2c.app';
const CS2CAP_TIMEOUT_MS = 8_000;
const DEFAULT_CNY_TO_VND_RATE = 3600;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ||
      (request as NextRequest & { ip?: string }).ip ||
      'unknown-ip';
    const { allowed, retryAfter } = await buffPriceRateLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { message: 'tooManyRequests', details: { retryAfter } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await request.json();
    const marketHashName =
      typeof body.marketHashName === 'string' ? body.marketHashName.trim() : '';
    const cnyToVndRate = normalizePositiveNumber(body.cnyToVndRate, DEFAULT_CNY_TO_VND_RATE);
    const forceRefresh = Boolean(body.forceRefresh);

    if (!marketHashName) {
      return NextResponse.json({ message: 'missingMarketHashName' }, { status: 400 });
    }

    let apiKey =
      request.headers.get('x-cs2cap-api-key')?.trim() ||
      request.headers.get('X-CS2Cap-API-Key')?.trim() ||
      '';

    if (!apiKey) {
      apiKey = process.env.CS2CAP_API_KEY?.trim() || '';
      try {
        const { getCurrentUser, getUserCs2capApiKey } = await import('@/services/auth-service');
        const user = await getCurrentUser();
        if (user?.id) {
          const userKey = await getUserCs2capApiKey(user.id);
          if (userKey) {
            apiKey = userKey;
          }
        }
      } catch {
        // Bỏ qua lỗi context khi ở ngoài request
      }
    }

    if (!apiKey) {
      return NextResponse.json({ message: 'noApiKeyConfigured' }, { status: 400 });
    }

    const itemId = await fetchCs2CapItemId(marketHashName, apiKey);
    if (itemId === null) {
      return NextResponse.json({ message: 'itemNotFoundOnCs2cap' }, { status: 404 });
    }

    const priceCny = await fetchCs2CapBuffPriceCny(itemId, apiKey, forceRefresh);
    if (priceCny === null) {
      return NextResponse.json({ message: 'buffPriceNotFound' }, { status: 404 });
    }

    return NextResponse.json({
      marketHashName,
      source: 'buff163',
      priceCny,
      priceVnd: Math.round(priceCny * cnyToVndRate),
      cnyToVndRate,
    });
  } catch {
    return NextResponse.json({ message: 'buffGeneric' }, { status: 500 });
  }
}

async function fetchCs2CapItemId(marketHashName: string, apiKey: string): Promise<number | null> {
  const response = await fetchWithTimeout(
    `${CS2CAP_API_BASE_URL}/v1/items`,
    {
      method: 'POST',
      headers: getCs2CapHeaders(apiKey),
      body: JSON.stringify({ market_hash_names: [marketHashName] }),
      next: { revalidate: 60 * 60 },
    },
    CS2CAP_TIMEOUT_MS
  );

  if (!response.ok) {
    return null;
  }

  return findCs2CapItemId(await response.json(), marketHashName);
}

async function fetchCs2CapBuffPriceCny(
  itemId: number,
  apiKey: string,
  forceRefresh?: boolean
): Promise<number | null> {
  const params = new URLSearchParams({
    item_id: String(itemId),
    providers: 'buff163',
    limit: '5',
    currency: 'CNY',
  });

  const response = await fetchWithTimeout(
    `${CS2CAP_API_BASE_URL}/v1/prices?${params}`,
    {
      headers: getCs2CapHeaders(apiKey),
      cache: forceRefresh ? 'no-store' : undefined,
      next: forceRefresh ? undefined : { revalidate: 60 * 10 },
    },
    CS2CAP_TIMEOUT_MS
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (getCs2CapCurrency(data) !== 'CNY') {
    return null;
  }

  const priceMinorUnits = findCs2CapLowestAsk(data);
  return priceMinorUnits === null ? null : priceMinorUnits / 100;
}

function getCs2CapHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENTS.default,
  };
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getCs2CapCurrency(value: unknown): 'CNY' | null {
  if (!isRecord(value) || !isRecord(value.meta) || typeof value.meta.currency !== 'string') {
    return null;
  }

  return value.meta.currency.toUpperCase() === 'CNY' ? 'CNY' : null;
}

function findCs2CapLowestAsk(value: unknown): number | null {
  const records = collectRecords(value);
  const record =
    records.find((candidate) => String(candidate.provider ?? '').toLowerCase() === 'buff163') ??
    records[0];
  const lowestAsk = record?.lowest_ask;
  return typeof lowestAsk === 'number' && Number.isFinite(lowestAsk) && lowestAsk > 0
    ? lowestAsk
    : null;
}

function findCs2CapItemId(value: unknown, marketHashName: string): number | null {
  const expected = marketHashName.toLowerCase();
  for (const record of collectRecords(value)) {
    const name =
      typeof record.market_hash_name === 'string' ? record.market_hash_name.toLowerCase() : '';
    const itemId = record.item_id;
    if (name === expected && typeof itemId === 'number' && Number.isFinite(itemId)) {
      return itemId;
    }
  }
  return null;
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectRecords);
  }

  if (!isRecord(value)) {
    return [];
  }

  const nestedRecords = Object.values(value).flatMap(collectRecords);
  return [value, ...nestedRecords];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
