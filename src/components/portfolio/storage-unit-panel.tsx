"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TbSearch, TbInfoCircle } from "react-icons/tb";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatVND } from "@/utils/format";
import { proxySteamUrl } from "@/utils/url";
import type { PortfolioReportDto } from "@/types/report";
export interface StorageUnitItem {
  caseId: string;
  marketHashName: string;
  name: string;
  imageUrl?: string;
  rarity?: {
    name: string;
    color: string;
  } | null;
  quantity: number;
  storageUnitItems?: Array<{
    storageUnitId: string;
    quantity: number;
  }>;
}

export interface StorageUnit {
  id: string;
  steamId64?: string;
  name: string;
  currentCount: number;
  maxCapacity: number;
  items: StorageUnitItem[];
}

interface StorageUnitInspectPanelProps {
  storageUnit: StorageUnit;
  report: PortfolioReportDto | null;
  buffPricesCny: Record<string, number>;
  buffCnyToVndRate: number;
  onSelectItem?: (item: StorageUnitItem) => void;
  onDeleteItem?: (item: StorageUnitItem) => Promise<void> | void;
  deletingItemKey?: string | null;
}

export function StorageUnitInspectPanel({
  storageUnit,
  report,
  buffPricesCny,
  buffCnyToVndRate,
  onSelectItem,
  onDeleteItem,
  deletingItemKey,
}: StorageUnitInspectPanelProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StorageUnitItem | null>(null);

  // Helper to get Steam Price in VND
  const getSteamPrice = (marketHashName: string): number => {
    const matchedRow = report?.rows.find(
      (r) => r.case.marketHashName === marketHashName,
    );
    return matchedRow?.currentPrice ?? 0;
  };

  // Helper to get Buff Price in VND
  const getBuffPrice = (marketHashName: string): number => {
    const priceCny = buffPricesCny[marketHashName];
    if (priceCny && priceCny > 0) {
      return Math.round(priceCny * buffCnyToVndRate);
    }
    return 0;
  };

  // Get item price (Buff if available, fallback to Steam)
  const getItemPrice = (marketHashName: string): number => {
    const buff = getBuffPrice(marketHashName);
    return buff > 0 ? buff : getSteamPrice(marketHashName);
  };

  // Compute total values for summary
  const totals = useMemo(() => {
    let totalSteam = 0;
    let totalBuff = 0;

    for (const item of storageUnit.items) {
      const matchedRow = report?.rows.find(
        (r) => r.case.marketHashName === item.marketHashName,
      );
      const steam = matchedRow?.currentPrice ?? 0;

      const priceCny = buffPricesCny[item.marketHashName];
      const buff =
        priceCny && priceCny > 0 ? Math.round(priceCny * buffCnyToVndRate) : 0;

      totalSteam += steam * item.quantity;
      totalBuff += (buff > 0 ? buff : steam) * item.quantity;
    }

    return {
      steam: totalSteam,
      buff: totalBuff,
    };
  }, [storageUnit.items, report, buffPricesCny, buffCnyToVndRate]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return storageUnit.items;
    const query = searchQuery.toLowerCase().trim();
    return storageUnit.items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.marketHashName.toLowerCase().includes(query),
    );
  }, [storageUnit.items, searchQuery]);

  return (
    <div className="flex h-full flex-col space-y-5">
      {/* Summary HUD Header */}
      <div className="grid shrink-0 grid-cols-2 gap-3 rounded-sm border border-border bg-surface/10 p-4">
        <div>
          <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("portfolio.capacity", "Capacity")}
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-foreground">
            {storageUnit.currentCount}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              / {storageUnit.maxCapacity}
            </span>
          </span>
          {/* Progress bar */}
          <div className="border-stone-850 mt-1.5 h-1.5 w-full overflow-hidden rounded-none border bg-stone-900">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, (storageUnit.currentCount / storageUnit.maxCapacity) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {t("portfolio.totalValue", "Total Value")}
          </span>
          <span className="mt-0.5 block text-sm font-bold text-emerald-400">
            {formatVND(totals.buff)}
          </span>
          <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
            {t("portfolio.byBuffSteam", "Based on Buff163 / Steam Market prices")}
          </span>
        </div>
      </div>

      {/* Controls: Search Input */}
      <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <TbSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("portfolio.searchCaseItem", "Search item...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface py-2 pr-4 pl-9 font-sans text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Items List */}
      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, index) => {
            const unitPrice = getItemPrice(item.marketHashName);
            const totalPrice = unitPrice * item.quantity;
            const itemRarityColor = item.rarity?.color;
            const itemKey = getStorageUnitItemKey(item);
            const isDeleting = deletingItemKey === itemKey;

            return (
              <div
                key={`${item.caseId}-${item.marketHashName}-${index}`}
                role={onSelectItem ? "button" : undefined}
                tabIndex={onSelectItem ? 0 : undefined}
                onClick={() => onSelectItem?.(item)}
                onKeyDown={(event) => {
                  if (!onSelectItem) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectItem(item);
                  }
                }}
                className="group relative flex cursor-pointer items-center justify-between rounded-sm border border-border bg-stone-900/30 p-2.5 transition-all duration-150 hover:border-amber-500/25 hover:bg-stone-900/60 focus:border-amber-500/40 focus:outline-none"
                style={{
                  borderLeft: itemRarityColor
                    ? `3px solid ${itemRarityColor}`
                    : undefined,
                }}
              >
                {/* Left side: Image & Name */}
                <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                  <div className="border-stone-850 relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-stone-950 transition-colors group-hover:border-stone-800">
                    {item.imageUrl ? (
                      <img
                        src={proxySteamUrl(item.imageUrl)}
                        alt={item.name}
                        className="size-10 object-contain"
                      />
                    ) : (
                      <div className="size-8 rounded-sm bg-stone-900" />
                    )}
                    {/* Quantity Badge on Image */}
                    <div className="border-stone-850 absolute right-0 bottom-0 border-t border-l bg-stone-950/90 px-1 py-0.5 font-mono text-[9px] font-bold text-amber-400">
                      x{item.quantity}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span
                      className="block truncate text-xs font-semibold text-foreground transition-colors group-hover:text-amber-400"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                      {item.marketHashName}
                    </span>
                  </div>
                </div>

                {/* Right side: Prices & Value */}
                <div className="flex shrink-0 flex-col items-end text-right">
                  <span className="font-mono text-xs font-bold text-slate-100">
                    {totalPrice > 0 ? formatVND(totalPrice) : "—"}
                  </span>
                  {unitPrice > 0 ? (
                    <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      {formatVND(unitPrice)} / {t("portfolio.perUnit", "unit")}
                    </span>
                  ) : (
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-stone-600">
                      {t("portfolio.noPrice", "No price")} <TbInfoCircle className="size-2.5" />
                    </span>
                  )}
                </div>
                {onDeleteItem && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isDeleting}
                    title={t("portfolio.removeFromStorageUnit", "Remove from Storage Unit")}
                    aria-label={t("portfolio.removeFromStorageUnit", "Remove from Storage Unit")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(item);
                    }}
                    className="ml-2 size-8 shrink-0 rounded-sm border border-stone-800/70 bg-stone-950/50 text-stone-500 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 focus:border-red-500/30 focus:text-red-400 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-stone-800 py-12 text-center">
            <span className="mb-2 text-2xl">🔍</span>
            <p className="text-xs font-medium text-muted-foreground">
              {t("portfolio.noItemsFound", "No items found.")}
            </p>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("portfolio.confirmRemoveStorageUnitItemTitle", "Remove item from Storage Unit")}
        description={t(
          "portfolio.confirmRemoveStorageUnitItemDesc",
          "Remove all {{count}} unit(s) of \"{{name}}\" from this Storage Unit?",
          {
            count: deleteTarget?.quantity ?? 0,
            name: deleteTarget?.name ?? "",
          },
        )}
        confirmText={t("portfolio.removeFromStorageUnit", "Remove from Storage Unit")}
        cancelText={t("common.cancel", "Cancel")}
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget || !onDeleteItem) return;
          await onDeleteItem(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export function getStorageUnitItemKey(
  item: Pick<StorageUnitItem, "caseId" | "marketHashName">,
) {
  return item.caseId || item.marketHashName;
}
