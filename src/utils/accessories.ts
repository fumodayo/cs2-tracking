export type AccessoryWithMarketHashName = {
  marketHashName?: string | null;
};

export function collectAccessoryMarketHashNames(
  ...collections: Array<AccessoryWithMarketHashName[]>
): string[] {
  return Array.from(
    new Set(
      collections
        .flat()
        .map((item) => item.marketHashName)
        .filter((name): name is string => Boolean(name))
    )
  );
}

export function getAccessoryTotalPrice(
  accessories: AccessoryWithMarketHashName[],
  priceMap: Map<string, number>
): number {
  return accessories.reduce((sum, accessory) => {
    if (!accessory.marketHashName) return sum;
    return sum + (priceMap.get(accessory.marketHashName) ?? 0);
  }, 0);
}

export function formatStickerWearPercent(wear?: number): string | null {
  if (wear === undefined || !Number.isFinite(wear)) return null;
  const intact = 100 - Math.round(Math.max(0, Math.min(1, wear)) * 100);
  return `${intact}%`;
}
