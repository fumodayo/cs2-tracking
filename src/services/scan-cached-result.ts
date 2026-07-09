import type { CachedScanResult, ScanItem, SteamProfile } from '@/services/scan-cache';
import { inferInventoryItemType } from '@/utils/cs2-item-type';

export function buildCachedScanJobResult({
  cached,
  includePrivateFields,
  profile,
  normalizeItems = false,
}: {
  cached: CachedScanResult;
  includePrivateFields: boolean;
  profile?: SteamProfile;
  normalizeItems?: boolean;
}) {
  // Entry cache cũ có thể chứa loại vật phẩm lỗi thời; chỉ chuẩn hóa cho caller cần dùng.
  const items = normalizeItems ? normalizeScanItemTypes(cached.items) : cached.items;

  return {
    steamId64: cached.steamId64,
    profile: cached.profile ?? profile,
    items,
    totalPrice: cached.totalPrice,
    totalQuantity: cached.totalQuantity,
    totalInventoryCount: cached.totalInventoryCount,
    cached: true,
    scannedAt: cached.scannedAt,
    expiresAt: cached.expiresAt,
    marketScanWarning: cached.marketScanWarning,
    // Các trường quét private chỉ được trả về khi request có cookie.
    storageUnits: includePrivateFields ? (cached.storageUnits ?? []) : [],
    ...(includePrivateFields
      ? {
          walletBalance: cached.walletBalance,
          walletBalanceVnd: cached.walletBalanceVnd,
        }
      : {}),
  };
}

function normalizeScanItemTypes(items: ScanItem[]): ScanItem[] {
  return items.map((item) => {
    const inferredType = inferInventoryItemType({
      name: item.caseItem.name,
      marketHashName: item.caseItem.marketHashName,
    });

    return item.type === inferredType ? item : { ...item, type: inferredType };
  });
}
