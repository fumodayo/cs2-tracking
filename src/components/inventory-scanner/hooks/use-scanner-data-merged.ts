'use client';

import { useCallback, useMemo } from 'react';
import type { AccountEntry, ScanResponse, ScanResultItem, SourceAccount } from '../types';
import { getScanResultItemGroupKey, getScanResultItemRowId } from '../utils';
import { buildItemIdentityKey, buildItemVariantKey } from '@/utils/item-identity';

interface UseScannerDataMergedProps {
  accounts: AccountEntry[];
  manualItems: ScanResultItem[];
  removedKeys: Set<string>;
  selectedTypes: Set<string>;
  globalFilter: string;
  buffPricesCny: Record<string, number>;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  mode?: 'case-summary' | 'transactions';
}

export function groupItemsForSummary(items: ScanResultItem[]): ScanResultItem[] {
  const map = new Map<string, ScanResultItem[]>();
  for (const item of items) {
    const key = getScanResultItemGroupKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  return Array.from(map.entries()).map(([key, group]) => {
    const [first] = group;
    if (group.length === 1) {
      return {
        ...first,
        identityKey: key,
        variantCount: 1,
        hasMixedVariants: false,
        underlyingIds: [getScanResultItemRowId(first)],
        storageUnitQuantity:
          first.storageUnitQuantity ?? (first.storageUnitId ? first.quantity : undefined),
      };
    }

    const totalQuantity = group.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = group.reduce((sum, item) => sum + item.total, 0);
    const maxHoldDays = group.reduce((max, item) => Math.max(max, item.holdDays ?? 0), 0);
    const anyOnMarket = group.some((item) => item.onMarket);
    const anyTradeProtected = group.some((item) => item.tradeProtected);
    const totalStorageUnitQuantity = group.reduce((sum, item) => {
      const itemStorageQty = item.storageUnitQuantity ?? (item.storageUnitId ? item.quantity : 0);
      return sum + itemStorageQty;
    }, 0);

    // Gộp tài khoản nguồn
    const sourceAccountsMap = new Map<string, SourceAccount>();
    for (const item of group) {
      if (item.sourceAccounts) {
        for (const sa of item.sourceAccounts) {
          const ex = sourceAccountsMap.get(sa.steamId64);
          if (ex) {
            ex.quantity = (ex.quantity ?? 0) + (sa.quantity ?? 0);
            if (sa.breakdown) {
              if (!ex.breakdown) {
                ex.breakdown = {
                  tradeable: 0,
                  onMarket: 0,
                  tradeProtected: 0,
                  hold: 0,
                  holdDetails: [],
                };
              }
              ex.breakdown.tradeable += sa.breakdown.tradeable ?? 0;
              ex.breakdown.onMarket += sa.breakdown.onMarket ?? 0;
              ex.breakdown.tradeProtected += sa.breakdown.tradeProtected ?? 0;
              ex.breakdown.hold += sa.breakdown.hold ?? 0;
              if (sa.breakdown.holdDetails) {
                ex.breakdown.holdDetails = [
                  ...(ex.breakdown.holdDetails || []),
                  ...sa.breakdown.holdDetails,
                ];
              }
            }
          } else {
            sourceAccountsMap.set(sa.steamId64, {
              ...sa,
              breakdown: sa.breakdown ? { ...sa.breakdown } : undefined,
            });
          }
        }
      }
    }

    // Xác định số lượng biến thể
    const variantKeys = new Set(
      group.map((item) =>
        buildItemVariantKey({
          caseId: item.caseItem.id,
          marketHashName: item.caseItem.marketHashName,
          dopplerPhase: item.dopplerPhase,
          inspectLink: item.inspectLink,
          patternInfo: item.patternInfo,
        })
      )
    );

    return {
      ...first,
      identityKey: key,
      quantity: totalQuantity,
      total: totalPrice,
      price: totalQuantity > 0 ? Math.round(totalPrice / totalQuantity) : first.price,
      holdDays: maxHoldDays > 0 ? maxHoldDays : undefined,
      onMarket: anyOnMarket || undefined,
      tradeProtected: anyTradeProtected || undefined,
      sourceAccounts: Array.from(sourceAccountsMap.values()),
      isManual: group.every((item) => item.isManual),
      variantCount: variantKeys.size,
      hasMixedVariants: variantKeys.size > 1,
      underlyingIds: group.map(getScanResultItemRowId),
      storageUnitQuantity: totalStorageUnitQuantity || undefined,
    };
  });
}

export function groupCommoditiesForMobile(items: ScanResultItem[]): ScanResultItem[] {
  const commodities: ScanResultItem[] = [];
  const skins: ScanResultItem[] = [];

  for (const item of items) {
    if (item.type !== 'Skin') {
      commodities.push(item);
    } else {
      skins.push(item);
    }
  }

  const groupedCommodities = groupItemsForSummary(commodities);
  return [...groupedCommodities, ...skins];
}

export function useScannerDataMerged({
  accounts,
  manualItems,
  removedKeys,
  selectedTypes,
  globalFilter,
  buffPricesCny,
  buffCnyToVndRate,
  rateAll,
  rateLe,
}: UseScannerDataMergedProps) {
  /**
   * Áp dụng phép tính tỷ giá BUFF163 bên thứ ba cho vật phẩm đã quét.
   */
  const applyBuffPricing = useCallback(
    (item: ScanResultItem): ScanResultItem => {
      if (item.type !== 'Skin') {
        return item;
      }

      const buffPriceCny = buffPricesCny[item.caseItem.marketHashName];
      if (!Number.isFinite(buffPriceCny) || buffPriceCny <= 0) {
        return { ...item, buffPriceCny: undefined };
      }

      const price = Math.round(buffPriceCny * buffCnyToVndRate);
      return {
        ...item,
        price,
        total: price * item.quantity,
        buffPriceCny,
        priceSource: 'buff163',
      };
    },
    [buffCnyToVndRate, buffPricesCny]
  );

  // Suy ra dữ liệu tổng hợp bằng useMemo
  const mergedRaw = useMemo(() => {
    const done = accounts.filter((a) => a.result).map((a) => a.result!);
    const hasScanned = done.length > 0;
    const hasManual = manualItems.length > 0;
    if (!hasScanned && !hasManual) return null;

    const map = new Map<string, ScanResultItem>();
    for (const r of done) {
      for (const item of r.items) {
        const isMarket = !!item.onMarket;
        const isProtected = !!item.tradeProtected;
        const isHold = !isProtected && !!item.holdDays && item.holdDays > 0;
        const isTradeable = !isMarket && !isProtected && !isHold;

        const sourceAccount = {
          steamId64: r.steamId64,
          name: r.profile?.name || r.steamId64,
          quantity: item.quantity,
          breakdown: {
            tradeable: isTradeable ? item.quantity : 0,
            onMarket: isMarket ? item.quantity : 0,
            tradeProtected: isProtected ? item.quantity : 0,
            hold: isHold ? item.quantity : 0,
            holdDetails:
              isHold || isProtected
                ? [{ quantity: item.quantity, holdDays: item.holdDays || 0 }]
                : [],
          },
        };

        const k = buildItemIdentityKey({
          marketHashName: item.caseItem.marketHashName,
          dopplerPhase: item.dopplerPhase,
          inspectLink: item.inspectLink,
          patternInfo: item.patternInfo,
          sourceAccounts: [sourceAccount],
          holdDays: item.holdDays,
          onMarket: item.onMarket,
          tradeProtected: item.tradeProtected,
        });

        if (removedKeys.has(k) || removedKeys.has(item.caseItem.marketHashName)) continue;

        const ex = map.get(k);
        if (ex) {
          ex.quantity += item.quantity;
          ex.total += item.total;
          ex.holdDays = Math.max(ex.holdDays ?? 0, item.holdDays ?? 0) || undefined;

          if (r.scannedAt && (!ex.scannedAt || new Date(r.scannedAt) > new Date(ex.scannedAt))) {
            ex.scannedAt = r.scannedAt;
          }

          if (item.onMarket) ex.onMarket = true;
          if (item.tradeProtected) ex.tradeProtected = true;

          const sourceAccounts = [...(ex.sourceAccounts ?? [])];
          const existingAccount = sourceAccounts.find(
            (account) => account.steamId64 === sourceAccount.steamId64
          );
          if (existingAccount) {
            existingAccount.quantity = (existingAccount.quantity ?? 0) + item.quantity;
            if (!existingAccount.breakdown) {
              existingAccount.breakdown = {
                tradeable: 0,
                onMarket: 0,
                tradeProtected: 0,
                hold: 0,
                holdDetails: [],
              };
            }
            existingAccount.breakdown.tradeable += sourceAccount.breakdown.tradeable;
            existingAccount.breakdown.onMarket += sourceAccount.breakdown.onMarket;
            existingAccount.breakdown.tradeProtected += sourceAccount.breakdown.tradeProtected;
            existingAccount.breakdown.hold += sourceAccount.breakdown.hold;
            if (sourceAccount.breakdown.holdDetails.length > 0) {
              existingAccount.breakdown.holdDetails = [
                ...(existingAccount.breakdown.holdDetails || []),
                ...sourceAccount.breakdown.holdDetails,
              ];
            }
          } else {
            sourceAccounts.push(sourceAccount);
          }
          ex.sourceAccounts = sourceAccounts;
        } else {
          map.set(k, {
            ...item,
            identityKey: k,
            scannedAt: r.scannedAt,
            sourceAccounts: [sourceAccount],
            onMarket: isMarket ? true : undefined,
            tradeProtected: isProtected ? true : undefined,
          });
        }
      }
    }

    const scannedItems = Array.from(map.values());
    const items = [...manualItems, ...scannedItems];
    return {
      items,
      scannedItems,
      totalInventoryCount: done.reduce(
        (s: number, r: ScanResponse) => s + r.totalInventoryCount,
        0
      ),
      accountCount: done.length,
    };
  }, [accounts, manualItems, removedKeys]);

  const merged = useMemo(() => {
    if (!mergedRaw) return null;
    const pricedItems = mergedRaw.items.map(applyBuffPricing);
    const pricedScannedItems = mergedRaw.scannedItems.map(applyBuffPricing);
    const items = pricedItems.filter((i) => selectedTypes.size === 0 || selectedTypes.has(i.type));
    const scannedItems = pricedScannedItems.filter(
      (i) => selectedTypes.size === 0 || selectedTypes.has(i.type)
    );
    return {
      ...mergedRaw,
      items,
      scannedItems,
      totalPrice: items.reduce((s: number, i: ScanResultItem) => s + i.total, 0),
      totalQuantity: items.reduce((s: number, i: ScanResultItem) => s + i.quantity, 0),
    };
  }, [applyBuffPricing, mergedRaw, selectedTypes]);

  const totalSi = useMemo(() => {
    if (!merged?.items) return 0;
    return merged.items.reduce((sum: number, item: ScanResultItem) => {
      return sum + (item.priceSource === 'buff163' ? item.total : (item.total * rateAll) / 100);
    }, 0);
  }, [merged, rateAll]);

  const totalLe = useMemo(() => {
    if (!merged?.items) return 0;
    return merged.items.reduce((sum: number, item: ScanResultItem) => {
      return sum + (item.priceSource === 'buff163' ? item.total : (item.total * rateLe) / 100);
    }, 0);
  }, [merged, rateLe]);

  const filteredManualItems = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    const items = manualItems
      .filter((i) => selectedTypes.size === 0 || selectedTypes.has(i.type))
      .map(applyBuffPricing);
    if (!query) return items;
    return items.filter((i) => i.caseItem.name.toLowerCase().includes(query));
  }, [manualItems, globalFilter, selectedTypes, applyBuffPricing]);

  const zeroPricedItems = useMemo(
    () => merged?.items.filter((item: ScanResultItem) => item.price <= 0) ?? [],
    [merged]
  );

  return {
    mergedRaw,
    merged,
    totalSi,
    totalLe,
    filteredManualItems,
    zeroPricedItems,
    applyBuffPricing,
  };
}
