import { getLocalApiKey } from '@/utils/local-api-key';

export interface BuffPriceResponse {
  priceCny: number;
}

export async function refreshBuffPrice(
  marketHashName: string,
  cnyToVndRate: number
): Promise<{ priceCny: number } | null> {
  const localKey = getLocalApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (localKey) {
    headers['x-cs2cap-api-key'] = localKey;
  }

  const response = await fetch('/api/inventory/buff-price', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      marketHashName,
      cnyToVndRate,
      forceRefresh: true,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (data && typeof data.priceCny === 'number' && data.priceCny > 0) {
    return { priceCny: data.priceCny };
  }
  return null;
}
