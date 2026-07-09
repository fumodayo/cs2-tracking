import { normalizeBuffPricesCny, type BuffPricesCny } from '@/utils/buff-prices';

type UserBuffPricesResponse = {
  pricesCny?: BuffPricesCny;
  message?: string;
};

export async function fetchUserBuffPrices(): Promise<BuffPricesCny> {
  const response = await fetch('/api/user/buff-prices', { cache: 'no-store' });
  return parseBuffPricesResponse(response);
}

export async function mergeUserBuffPrices(pricesCny: BuffPricesCny): Promise<BuffPricesCny> {
  const response = await fetch('/api/user/buff-prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pricesCny }),
  });
  return parseBuffPricesResponse(response);
}

export async function replaceUserBuffPrices(pricesCny: BuffPricesCny): Promise<BuffPricesCny> {
  const response = await fetch('/api/user/buff-prices', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pricesCny }),
  });
  return parseBuffPricesResponse(response);
}

export async function updateUserBuffPrice(
  marketHashName: string,
  priceCny: number | null
): Promise<BuffPricesCny> {
  const response = await fetch('/api/user/buff-prices', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketHashName, priceCny }),
  });
  return parseBuffPricesResponse(response);
}

async function parseBuffPricesResponse(response: Response): Promise<BuffPricesCny> {
  const data = (await response.json().catch(() => ({}))) as UserBuffPricesResponse;
  if (!response.ok) {
    throw new Error(data.message ?? 'buffPricesRequestFailed');
  }

  return normalizeBuffPricesCny(data.pricesCny);
}
