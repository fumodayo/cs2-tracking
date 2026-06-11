import {
  AccountEntry,
  InventoryItemType,
  ScanResponse,
  SourceAccount,
} from "./types";

export const LS_RATE_ALL = "cs2t_rateAll";
export const LS_RATE_LE = "cs2t_rateLe";
export const LS_ACCOUNTS = "cs2t_accounts";
export const LS_MANUAL_ITEMS = "cs2t_manualItems";
export const LS_BUFF_CNY_TO_VND_RATE = "cs2t_buffCnyToVndRate";
export const LS_BUFF_PRICES_CNY = "cs2t_buffPricesCny";
export const DEFAULT_BUFF_CNY_TO_VND_RATE = 3600;
export const SCAN_REQUEST_TIMEOUT_MS = 180_000;

/**
 * Reads a number rate from localStorage, with fallback protection.
 */
export function readRate(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v ? Number(v) || fallback : fallback;
}

let nextId = 1;

/**
 * Instantiates a new empty account entry layout.
 */
export function createAccount(url: string): AccountEntry {
  return {
    id: `acc_${Date.now()}_${nextId++}`,
    url,
    steamCookie: "",
    steamSessionId: "",
    status: "idle",
    result: null,
    error: null,
    progress: null,
  };
}

/**
 * Normalizes a Steam URL or vanity input for duplicate comparisons.
 * Converts to lowercase and removes trailing slashes.
 */
export function normalizeSteamInput(raw: string): string {
  return raw.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Extracts a comparable unique key from a Steam URL.
 * Handles /profiles/[id], /id/[vanity], or a raw SteamID64 input.
 */
export function extractSteamKey(raw: string): string | null {
  const s = normalizeSteamInput(raw);
  if (!s) return null;

  const profileMatch = s.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  const idMatch = s.match(/\/id\/([^\/]+)/);
  if (idMatch) return `vanity:${idMatch[1]}`;

  if (/^\d{17}$/.test(s)) return s;

  if (!s.includes("/")) return `vanity:${s}`;
  return s;
}

/**
 * Formats a currency value into standard Vietnamese Dong string format.
 */
export function formatVND(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

/**
 * Formats a raw number with local grouping separators.
 */
export function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

/**
 * Formats multi-page scanning progress descriptions.
 */
export function formatProgressDetail(
  detail: Record<string, number | string>,
): string {
  const parts: string[] = [];
  if (detail.page) parts.push(`page ${detail.page}`);
  if (detail.assets)
    parts.push(`${formatPlainNumber(Number(detail.assets))} item đã đọc`);
  if (detail.priced && detail.total)
    parts.push(`${detail.priced}/${detail.total} loại đã định giá`);
  return parts.join(" · ");
}

/**
 * Dispatches a standard fetch request wrapped in an AbortController timeout.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Quét inventory quá lâu. Steam có thể đang chậm hoặc inventory có quá nhiều item, hãy thử lại sau.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Derives an InventoryItemType enum value based on name conventions.
 */
export function getInventoryItemType(name: string): InventoryItemType {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("capsule") || nameLower.includes("package"))
    return "Capsule";
  if (nameLower.startsWith("sticker |")) return "Sticker";
  if (nameLower.includes(" | ")) return "Skin";
  return "Case";
}

/**
 * Maps which profiles contributed to a given marketHashName item.
 */
export function getSourceAccountsForItem(
  results: ScanResponse[],
  marketHashName: string,
): SourceAccount[] {
  return results
    .filter((result) =>
      result.items.some(
        (item) => item.caseItem.marketHashName === marketHashName,
      ),
    )
    .map((result) => ({
      steamId64: result.steamId64,
      name: result.profile?.name || result.steamId64,
    }));
}

export function getSteamMarketListingUrl(marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`;
}

export function getItemTypeColor(type: string): string {
  switch (type) {
    case "Skin":
      return "#b0c3d9"; // Consumer grade fallback
    case "Sticker":
      return "#4b69ff";
    case "Capsule":
    case "Case":
    default:
      return "#b0c3d9"; // ALWAYS Consumer grade color
  }
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
