import type { CharmInfo, StickerInfo } from "@/domain/pattern-info";

export function collectUniqueAccessories(rows: Array<{
  patternInfo?: {
    stickers?: StickerInfo[];
    charms?: CharmInfo[];
  };
}>) {
  const seen = new Set<string>();
  const stickers: StickerInfo[] = [];
  const charms: CharmInfo[] = [];

  for (const row of rows) {
    for (const sticker of row.patternInfo?.stickers ?? []) {
      const key = getAccessoryIdentity("sticker", sticker);
      if (seen.has(key)) continue;
      seen.add(key);
      stickers.push(sticker);
    }
    for (const charm of row.patternInfo?.charms ?? []) {
      const key = getAccessoryIdentity("charm", charm);
      if (seen.has(key)) continue;
      seen.add(key);
      charms.push(charm);
    }
  }

  return { stickers, charms };
}

function getAccessoryIdentity(
  kind: "sticker" | "charm",
  accessory: StickerInfo | CharmInfo,
) {
  return [
    kind,
    accessory.marketHashName ?? accessory.name,
    accessory.slot ?? "slot",
    accessory.id ?? "id",
  ].join(":");
}
