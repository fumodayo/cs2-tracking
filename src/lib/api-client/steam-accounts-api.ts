export interface SteamAccountDto {
  id: string;
  steamId64: string;
  steamUrl: string;
  name: string;
  avatarUrl: string | null;
  steamCookie?: string | null;
  cookieError?: string | null;
  walletBalance?: string | null;
  walletBalanceVnd?: number | null;
}

export interface CookieCheckResult {
  isValid: boolean;
  isExpired?: boolean;
  message?: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message ?? 'requestFailed');
  }
  return data as T;
}

export async function fetchSteamAccounts(
  fallbackErrorMsg = 'cannotLoadAccounts'
): Promise<SteamAccountDto[]> {
  const res = await fetch('/api/portfolio/accounts');
  if (!res.ok) throw new Error(fallbackErrorMsg);
  return parseResponse<SteamAccountDto[]>(res);
}

export async function triggerBackgroundSync(): Promise<void> {
  const res = await fetch('/api/portfolio/accounts/sync', {
    method: 'POST',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message ?? 'bgSyncFailed');
  }
}

export async function checkSteamCookieStatus(accountId: string): Promise<CookieCheckResult> {
  const res = await fetch('/api/portfolio/accounts/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });
  return parseResponse<CookieCheckResult>(res);
}

export async function addSteamAccount(
  payload: { steamUrl: string; steamCookie?: string },
  fallbackErrorMsg = 'cannotLinkAccount'
): Promise<SteamAccountDto> {
  const res = await fetch('/api/portfolio/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? fallbackErrorMsg);
  }
  return parseResponse<SteamAccountDto>(res);
}

export async function updateSteamAccountCookie(
  payload: { id: string; steamCookie: string },
  fallbackErrorMsg = 'cannotSaveCookie'
): Promise<{ success: boolean }> {
  const res = await fetch('/api/portfolio/accounts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? fallbackErrorMsg);
  }
  return parseResponse<{ success: boolean }>(res);
}

export async function deleteSteamAccount(
  id: string,
  fallbackErrorMsg = 'cannotDeleteAccount'
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/portfolio/accounts?id=${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? fallbackErrorMsg);
  }
  return parseResponse<{ success: boolean }>(res);
}

export const STEAM_ACCOUNTS_QUERY_KEY = ['portfolio-accounts'];
export const STORAGE_UNITS_QUERY_KEY = (steamId64: string) => [
  'portfolio-storage-units',
  steamId64,
];

export interface StorageUnitItemDto {
  caseId: string;
  marketHashName: string;
  name: string;
  imageUrl?: string;
  rarity?: { name: string; color: string } | null;
  quantity: number;
  storageUnitItems?: Array<{
    storageUnitId: string;
    quantity: number;
  }>;
}

export interface StorageUnitDto {
  id: string;
  steamId64?: string;
  name: string;
  currentCount: number;
  maxCapacity: number;
  items: StorageUnitItemDto[];
}

export async function fetchAccountStorageUnits(
  steamId64: string,
  options?: { aggregate?: boolean }
): Promise<StorageUnitDto[]> {
  const params = new URLSearchParams({ steamId64 });
  if (options?.aggregate) {
    params.set('aggregate', '1');
  }
  const res = await fetch(`/api/portfolio/storage-units?${params.toString()}`);
  if (!res.ok) throw new Error('cannotLoadStorageUnits');
  const data = await res.json();
  return data.storageUnits as StorageUnitDto[];
}
