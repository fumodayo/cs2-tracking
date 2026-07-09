export const BUFF_PRICES_STORAGE_KEY = 'cs2t_buffPricesCny';

export type BuffPricesCny = Record<string, number>;

export function normalizeBuffPricesCny(value: unknown): BuffPricesCny {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: BuffPricesCny = {};
  for (const [marketHashName, rawPrice] of Object.entries(value)) {
    const name = marketHashName.trim();
    const priceCny = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
    if (name && Number.isFinite(priceCny) && priceCny > 0) {
      normalized[name] = priceCny;
    }
  }

  return normalized;
}

export function hasBuffPrices(prices: BuffPricesCny): boolean {
  return Object.keys(prices).length > 0;
}

export function readLocalBuffPrices(): BuffPricesCny {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(BUFF_PRICES_STORAGE_KEY);
    return raw ? normalizeBuffPricesCny(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function writeLocalBuffPrices(prices: BuffPricesCny): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BUFF_PRICES_STORAGE_KEY, JSON.stringify(prices));
}

export function clearLocalBuffPrices(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BUFF_PRICES_STORAGE_KEY);
}
