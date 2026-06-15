"use client";

import { useCallback, useMemo } from "react";
import type { AccountEntry, ScanResponse, ScanResultItem } from "../types";

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
   * Applies third-party BUFF163 exchange calculations to a scanned item.
   */
  const applyBuffPricing = useCallback(
    (item: ScanResultItem): ScanResultItem => {
      if (item.type !== "Skin") {
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
        priceSource: "buff163",
      };
    },
    [buffCnyToVndRate, buffPricesCny],
  );

  // Aggregated data derivation using useMemo
  const mergedRaw = useMemo(() => {
    const done = accounts
      .filter((a) => a.status === "done" && a.result)
      .map((a) => a.result!);
    const hasScanned = done.length > 0;
    const hasManual = manualItems.length > 0;
    if (!hasScanned && !hasManual) return null;

    const map = new Map<string, ScanResultItem>();
    for (const r of done) {
      for (const item of r.items) {
        if (removedKeys.has(item.caseItem.marketHashName)) continue;
        const k = item.caseItem.marketHashName;

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

        const ex = map.get(k);
        if (ex) {
          ex.quantity += item.quantity;
          ex.total += item.total;
          ex.holdDays =
            Math.max(ex.holdDays ?? 0, item.holdDays ?? 0) || undefined;

          if (item.onMarket) ex.onMarket = true;
          if (item.tradeProtected) ex.tradeProtected = true;

          const sourceAccounts = [...(ex.sourceAccounts ?? [])];
          const existingAccount = sourceAccounts.find(
            (account) => account.steamId64 === sourceAccount.steamId64,
          );
          if (existingAccount) {
            existingAccount.quantity =
              (existingAccount.quantity ?? 0) + item.quantity;
            if (!existingAccount.breakdown) {
              existingAccount.breakdown = {
                tradeable: 0,
                onMarket: 0,
                tradeProtected: 0,
                hold: 0,
                holdDetails: [],
              };
            }
            existingAccount.breakdown.tradeable +=
              sourceAccount.breakdown.tradeable;
            existingAccount.breakdown.onMarket +=
              sourceAccount.breakdown.onMarket;
            existingAccount.breakdown.tradeProtected +=
              sourceAccount.breakdown.tradeProtected;
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
        0,
      ),
      accountCount: done.length,
    };
  }, [accounts, manualItems, removedKeys]);

  const merged = useMemo(() => {
    if (!mergedRaw) return null;
    const pricedItems = mergedRaw.items.map(applyBuffPricing);
    const pricedScannedItems = mergedRaw.scannedItems.map(applyBuffPricing);
    const items = pricedItems.filter(
      (i) => selectedTypes.size === 0 || selectedTypes.has(i.type),
    );
    const scannedItems = pricedScannedItems.filter(
      (i) => selectedTypes.size === 0 || selectedTypes.has(i.type),
    );
    return {
      ...mergedRaw,
      items,
      scannedItems,
      totalPrice: items.reduce(
        (s: number, i: ScanResultItem) => s + i.total,
        0,
      ),
      totalQuantity: items.reduce(
        (s: number, i: ScanResultItem) => s + i.quantity,
        0,
      ),
    };
  }, [applyBuffPricing, mergedRaw, selectedTypes]);

  const totalSi = useMemo(() => {
    if (!merged?.items) return 0;
    return merged.items.reduce((sum: number, item: ScanResultItem) => {
      return (
        sum +
        (item.priceSource === "buff163"
          ? item.total
          : (item.total * rateAll) / 100)
      );
    }, 0);
  }, [merged, rateAll]);

  const totalLe = useMemo(() => {
    if (!merged?.items) return 0;
    return merged.items.reduce((sum: number, item: ScanResultItem) => {
      return (
        sum +
        (item.priceSource === "buff163"
          ? item.total
          : (item.total * rateLe) / 100)
      );
    }, 0);
  }, [merged, rateLe]);

  const filteredManualItems = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    const items = manualItems
      .filter(
        (i) =>
          selectedTypes.size === 0 || selectedTypes.has(i.type),
      )
      .map(applyBuffPricing);
    if (!query) return items;
    return items.filter((i) => i.caseItem.name.toLowerCase().includes(query));
  }, [
    manualItems,
    globalFilter,
    selectedTypes,
    applyBuffPricing,
  ]);

  const zeroPricedItems = useMemo(
    () => merged?.items.filter((item: ScanResultItem) => item.price <= 0) ?? [],
    [merged],
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
