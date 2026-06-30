"use client";

import { Badge, Gem } from "lucide-react";

import type { CharmInfo, StickerInfo } from "@/domain/pattern-info";
import { cn } from "@/utils/cn";
import { proxySteamUrl } from "@/utils/url";

type AccessoryPreviewStripProps = {
  stickers?: StickerInfo[];
  charms?: CharmInfo[];
  maxVisible?: number;
  size?: "sm" | "md";
  showNames?: boolean;
  emptyLabel?: string;
  className?: string;
};

type AccessoryPreviewItem = {
  kind: "sticker" | "charm";
  id?: number;
  slot?: number;
  name: string;
  imageUrl?: string;
  marketHashName?: string;
  wear?: number;
  pattern?: number;
};

export function AccessoryPreviewStrip({
  stickers = [],
  charms = [],
  maxVisible = 4,
  size = "sm",
  showNames = false,
  emptyLabel,
  className,
}: AccessoryPreviewStripProps) {
  const accessories = toAccessoryPreviewItems(stickers, charms);

  if (accessories.length === 0) {
    return emptyLabel ? (
      <span
        className={cn(
          "inline-flex min-h-7 items-center rounded-md border border-stone-800/70 bg-stone-950/45 px-2 text-[10px] font-semibold text-stone-500",
          className,
        )}
      >
        {emptyLabel}
      </span>
    ) : null;
  }

  const visibleAccessories = accessories.slice(0, maxVisible);
  const hiddenCount = Math.max(0, accessories.length - visibleAccessories.length);
  const tileClass =
    size === "md"
      ? "size-10 rounded"
      : "size-7 rounded-md";
  const iconClass = size === "md" ? "size-5" : "size-3.5";

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      <div className="flex shrink-0 items-center gap-1">
        {visibleAccessories.map((accessory, index) => {
          const wearPercent =
            accessory.kind === "sticker"
              ? formatStickerWearPercent(accessory.wear)
              : null;
          const title = getAccessoryTitle(accessory, wearPercent);

          return (
            <span
              key={`${accessory.kind}-${accessory.id ?? accessory.name}-${accessory.slot ?? index}`}
              className={cn(
                "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-stone-700/70 bg-stone-950 shadow-sm",
                tileClass,
              )}
              title={title}
            >
              {accessory.imageUrl ? (
                <img
                  src={proxySteamUrl(accessory.imageUrl)}
                  alt={accessory.name}
                  className="size-full object-contain p-0.5"
                  loading="lazy"
                />
              ) : accessory.kind === "charm" ? (
                <Gem className={cn("text-stone-500", iconClass)} />
              ) : (
                <Badge className={cn("text-stone-500", iconClass)} />
              )}
              {wearPercent ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/75 px-0.5 text-center text-[8px] font-black leading-3 text-white shadow-[0_-1px_4px_rgba(0,0,0,0.5)]">
                  {wearPercent}
                </span>
              ) : null}
            </span>
          );
        })}
        {hiddenCount > 0 ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center border border-stone-800 bg-stone-950/70 text-[10px] font-extrabold text-stone-400",
              tileClass,
            )}
            title={accessories.slice(maxVisible).map((item) => item.name).join(", ")}
          >
            +{hiddenCount}
          </span>
        ) : null}
      </div>
      {showNames ? (
        <span
          className="min-w-0 max-w-[16rem] truncate text-[10px] font-semibold text-stone-400"
          title={accessories.map((item) => item.name).join(", ")}
        >
          {getAccessorySummary(accessories)}
        </span>
      ) : null}
    </div>
  );
}

function toAccessoryPreviewItems(
  stickers: StickerInfo[],
  charms: CharmInfo[],
): AccessoryPreviewItem[] {
  return [
    ...stickers.map((sticker) => ({
      kind: "sticker" as const,
      id: sticker.id,
      slot: sticker.slot,
      name: sticker.name,
      imageUrl: sticker.imageUrl,
      marketHashName: sticker.marketHashName,
      wear: sticker.wear,
    })),
    ...charms.map((charm) => ({
      kind: "charm" as const,
      id: charm.id,
      slot: charm.slot,
      name: charm.name,
      imageUrl: charm.imageUrl,
      marketHashName: charm.marketHashName,
      pattern: charm.pattern,
    })),
  ];
}

function getAccessoryTitle(accessory: AccessoryPreviewItem, wearPercent: string | null) {
  const details = [
    accessory.name,
    accessory.slot !== undefined ? `Slot ${accessory.slot + 1}` : null,
    wearPercent ? `${wearPercent} intact` : null,
    accessory.pattern !== undefined ? `Pattern ${accessory.pattern}` : null,
  ].filter(Boolean);

  return details.join(" - ");
}

function getAccessorySummary(accessories: AccessoryPreviewItem[]) {
  const names = accessories.map((item) => item.name);
  if (names.length <= 2) {
    return names.join(", ");
  }

  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function formatStickerWearPercent(wear?: number) {
  if (wear === undefined || !Number.isFinite(wear)) return null;
  const intact = 100 - Math.round(Math.max(0, Math.min(1, wear)) * 100);
  return `${intact}%`;
}
