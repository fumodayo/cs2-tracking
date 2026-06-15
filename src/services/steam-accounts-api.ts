export interface SteamAccountDto {
  id: string;
  steamId64: string;
  steamUrl: string;
  name: string;
  avatarUrl: string | null;
  steamCookie?: string | null;
  cookieError?: string | null;
}

export interface CookieCheckResult {
  isValid: boolean;
  isExpired?: boolean;
  message?: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message ?? "Yêu cầu thất bại.");
  }
  return data as T;
}

export async function fetchSteamAccounts(fallbackErrorMsg = "Không thể tải tài khoản"): Promise<SteamAccountDto[]> {
  const res = await fetch("/api/portfolio/accounts");
  if (!res.ok) throw new Error(fallbackErrorMsg);
  return parseResponse<SteamAccountDto[]>(res);
}

export async function triggerBackgroundSync(): Promise<void> {
  const res = await fetch("/api/portfolio/accounts/sync?bypassCooldown=true", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message ?? "Đồng bộ chạy ngầm thất bại.");
  }
}

export async function checkSteamCookieStatus(accountId: string): Promise<CookieCheckResult> {
  const res = await fetch("/api/portfolio/accounts/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  return parseResponse<CookieCheckResult>(res);
}

export async function addSteamAccount(
  payload: { steamUrl: string; steamCookie?: string },
  fallbackErrorMsg = "Không thể liên kết tài khoản"
): Promise<SteamAccountDto> {
  const res = await fetch("/api/portfolio/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  fallbackErrorMsg = "Không thể lưu cookie"
): Promise<{ success: boolean }> {
  const res = await fetch("/api/portfolio/accounts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
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
  fallbackErrorMsg = "Không thể xóa tài khoản"
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/portfolio/accounts?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? fallbackErrorMsg);
  }
  return parseResponse<{ success: boolean }>(res);
}
