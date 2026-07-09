import {
  AccountEntry,
  InventoryItemType,
  ScanResponse,
  ScanResultItem,
  SourceAccount,
} from './types';
import { inferInventoryItemType } from '@/utils/cs2-item-type';
import { BUFF_PRICES_STORAGE_KEY } from '@/utils/buff-prices';

type TranslationOptions = Record<string, unknown>;
type TranslationFn = (key: string, options?: TranslationOptions) => string;

export const LS_RATE_ALL = 'cs2t_rateAll';
export const LS_RATE_LE = 'cs2t_rateLe';
export const LS_ACCOUNTS = 'cs2t_accounts';
export const LS_MANUAL_ITEMS = 'cs2t_manualItems';
export const LS_BUFF_CNY_TO_VND_RATE = 'cs2t_buffCnyToVndRate';
export const LS_BUFF_PRICES_CNY = BUFF_PRICES_STORAGE_KEY;
export const DEFAULT_BUFF_CNY_TO_VND_RATE = 3600;
export const SCAN_REQUEST_TIMEOUT_MS = 20 * 60_000;
export const SCAN_PROGRESS_IDLE_TIMEOUT_MS = 8 * 60_000;

/**
 * Đọc rate dạng số từ localStorage, có bảo vệ fallback.
 */
export function readRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return v ? Number(v) || fallback : fallback;
}

let nextId = 1;

/**
 * Khởi tạo layout entry tài khoản trống mới.
 */
export function createAccount(url: string): AccountEntry {
  return {
    id: `acc_${Date.now()}_${nextId++}`,
    url,
    steamCookie: '',
    steamSessionId: '',
    scanJobId: null,
    status: 'idle',
    result: null,
    error: null,
    progress: null,
  };
}

/**
 *
 * Chuẩn hóa Steam URL hoặc vanity input để so sánh trùng lặp.
 * Chuyển về chữ thường và bỏ dấu gạch chéo cuối.
 *
 */
export function normalizeSteamInput(raw: string): string {
  return raw.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 *
 * Trích key duy nhất có thể so sánh từ Steam URL.
 * Xử lý /profiles/[id], /id/[vanity] hoặc SteamID64 thô.
 *
 */
export function extractSteamKey(raw: string): string | null {
  const s = normalizeSteamInput(raw);
  if (!s) return null;

  const profileMatch = s.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  const idMatch = s.match(/\/id\/([^/]+)/);
  if (idMatch) return `vanity:${idMatch[1]}`;

  if (/^\d{17}$/.test(s)) return s;

  if (!s.includes('/')) return `vanity:${s}`;
  return s;
}

import { formatVND } from '@/utils/format';
export { formatVND };

/**
 * Định dạng số thô bằng dấu phân tách nhóm theo locale.
 */
export function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

/**
 * Định dạng mô tả tiến độ quét nhiều trang.
 */
export function formatProgressDetail(
  detail: Record<string, number | string>,
  t: TranslationFn
): string {
  const parts: string[] = [];
  if (detail.page) parts.push(`page ${detail.page}`);
  if (detail.assets)
    parts.push(t('inventoryScanner.apiErrors.itemsRead', { count: Number(detail.assets) }));
  if (detail.priced && detail.total)
    parts.push(
      t('inventoryScanner.apiErrors.itemsPriced', { priced: detail.priced, total: detail.total })
    );
  return parts.join(' · ');
}

/**
 * Suy ra giá trị enum InventoryItemType dựa trên quy ước tên.
 */
export function getInventoryItemType(name: string, marketHashName = name): InventoryItemType {
  return inferInventoryItemType({ name, marketHashName });
}

export function getScanResultItemRowId(
  item: Pick<ScanResultItem, 'caseItem' | 'id' | 'identityKey' | 'isManual'>
): string {
  return item.isManual && item.id ? item.id : item.identityKey || item.caseItem.marketHashName;
}

export function getScanResultItemGroupKey(
  item: Pick<ScanResultItem, 'caseItem' | 'dopplerPhase'>
): string {
  return `${item.caseItem.marketHashName}:${item.dopplerPhase ?? 'normal'}`;
}

export function findScannedItemByRowId(
  items: ScanResultItem[],
  rowId: string
): ScanResultItem | undefined {
  return items.find((item) => !item.isManual && getScanResultItemRowId(item) === rowId);
}

/**
 * Map các profile đóng góp vào vật phẩm theo marketHashName.
 */
export function getSourceAccountsForItem(
  results: ScanResponse[],
  marketHashName: string
): SourceAccount[] {
  return results
    .filter((result) =>
      result.items.some((item) => item.caseItem.marketHashName === marketHashName)
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
    case 'Skin':
      return '#b0c3d9'; // Dự phòng cấp Consumer
    case 'Sticker':
      return '#4b69ff';
    case 'Capsule':
    case 'Case':
    case 'Graffiti':
    case 'Agent':
    case 'Music Kit':
    case 'Patch':
    case 'Pin':
    case 'Charm':
    default:
      return '#b0c3d9'; // Luôn dùng màu cấp Consumer
  }
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export { getLocalApiKey, removeLocalApiKey, saveLocalApiKey } from '@/utils/local-api-key';

export const STEAM_PRIVACY_SETTINGS_URL = 'https://steamcommunity.com/my/edit/settings';

export {
  isCookieCredentialError,
  isFamilyViewAccountError,
  isPrivateInventoryAccountError,
  translateAccountError,
  translateImportProgressMessage,
  translateScanProgressMessage,
  translateSyncMessage,
} from './utils-translations';
