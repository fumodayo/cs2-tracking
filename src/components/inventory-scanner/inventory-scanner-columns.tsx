import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Loader2, Badge, Sparkles } from "lucide-react";
import { FaSteam, FaCoins, FaSyncAlt, FaSearch } from "react-icons/fa";
import * as HoverCard from "@radix-ui/react-hover-card";
import { motion } from "framer-motion";

import { Tooltip } from "@/components/ui/tooltip";
import { CopyButton, DataTableColumnHeader } from "@/components/ui/actions";
import { formatRelative } from "@/utils/date";
import { CaseThumbnail } from "@/components/portfolio";
import type { ScanResultItem } from "./types";
import { Button } from "@/components/ui/button";
import { DopplerBadge, FadeBadge, BlueGemBadge, MarbleFadeBadge } from "@/components/shared/pattern-badge";
import type { InspectPatternResult } from "./hooks/use-pattern-inspect";
import type { StickerInfo, CharmInfo } from "@/domain/pattern-info";
import { proxySteamUrl } from "@/utils/url";
import {
  getSteamMarketListingUrl,
  getItemTypeColor,
  colorWithAlpha,
  formatVND,
  formatPlainNumber,
} from "./utils";

export type BuildInventoryColumnsParams = {
  t: any;
  buffLoadingKeys: Set<string>;
  buffPricesCny: Record<string, number>;
  buffPriceErrors: Record<string, string>;
  fetchBuffPrice: (marketHashName: string) => void;
  updateBuffPriceCny: (marketHashName: string, rawValue: string) => void;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  updateManualItemQty?: (id: string, qty: number) => void;
  mergedRawItems?: ScanResultItem[];
  inspectingKeys: Set<string>;
  patternResults: Record<string, InspectPatternResult>;
  inspectPattern: (inspectLink: string, marketHashName: string, dopplerPhase?: string) => void;
  mode: "case-summary" | "transactions";
  onSelectItem?: (item: ScanResultItem) => void;
};

function getScannerItemStatusBreakdown(item: {
  isManual?: boolean;
  quantity: number;
  holdDays?: number;
  sourceAccounts?: Array<{
    steamId64: string;
    name: string;
    breakdown?: {
      tradeable: number;
      onMarket: number;
      tradeProtected: number;
      hold: number;
    };
  }>;
}) {
  const consolidated = {
    tradeable: 0,
    onMarket: 0,
    tradeProtected: 0,
    hold: 0,
  };

  let hasBreakdown = false;
  if (item.sourceAccounts && item.sourceAccounts.length > 0) {
    for (const acc of item.sourceAccounts) {
      if (acc.breakdown) {
        hasBreakdown = true;
        consolidated.tradeable += acc.breakdown.tradeable ?? 0;
        consolidated.onMarket += acc.breakdown.onMarket ?? 0;
        consolidated.tradeProtected += acc.breakdown.tradeProtected ?? 0;
        consolidated.hold += acc.breakdown.hold ?? 0;
      }
    }
  }

  if (!hasBreakdown) {
    if (item.holdDays && item.holdDays > 0) {
      consolidated.hold = item.quantity;
    } else {
      consolidated.tradeable = item.quantity;
    }
  }

  return consolidated;
}

export function buildInventoryColumns({
  t,
  buffLoadingKeys,
  buffPricesCny,
  buffPriceErrors,
  fetchBuffPrice,
  updateBuffPriceCny,
  buffCnyToVndRate,
  rateAll,
  rateLe,
  updateManualItemQty,
  mergedRawItems,
  inspectingKeys,
  patternResults,
  inspectPattern,
  mode,
  onSelectItem,
}: BuildInventoryColumnsParams): ColumnDef<ScanResultItem>[] {
  const renderVND = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "--";
    }
    const formattedNumber = new Intl.NumberFormat("vi-VN").format(Math.round(value));
    return (
      <>
        {formattedNumber}
        <span className="text-[10px] text-stone-500 font-normal ml-0.5 select-none font-sans">đ</span>
      </>
    );
  };

  return [
    {
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="border-stone-750 size-4 cursor-pointer rounded bg-stone-900 text-blue-500 accent-blue-500"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            aria-label={t("inventoryScanner.selectAll")}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="border-stone-750 size-4 cursor-pointer rounded bg-stone-900 text-blue-500 accent-blue-500"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
            aria-label={t("inventoryScanner.selectRow")}
          />
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "case",
      enableHiding: false,
      header: t("inventoryScanner.item"),
      accessorFn: (row) => row.caseItem.name,
      cell: ({ row }) => {
        const isSkin = row.original.type === "Skin";
        const marketHashName = row.original.caseItem.marketHashName;
        const isWeaponOrKnifeOrGlove =
          isSkin && (
            /Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred/i.test(marketHashName) ||
            marketHashName.startsWith("★")
          );
        const isLoadingBuff = buffLoadingKeys.has(marketHashName);
        const patternInfo = row.original.patternInfo ?? patternResults[marketHashName]?.patternInfo;
        const dopplerPhase = row.original.dopplerPhase ?? patternInfo?.dopplerPhase;
        const fadePercentage = patternInfo?.fadePercentage;
        const blueGemTier = patternInfo?.blueGemTier;
        const marbleFadeTier = patternInfo?.marbleFadeTier;
        const overpayInfo = patternResults[marketHashName]?.overpay;
        const buffPriceCny =
          row.original.buffPriceCny ?? buffPricesCny[marketHashName];
        const hasBuffPrice = Number.isFinite(buffPriceCny) && buffPriceCny > 0;
        const rawItem = mergedRawItems?.find(
          (i) => i.caseItem.marketHashName === marketHashName,
        );
        const steamPrice = rawItem?.price ?? row.original.price ?? 0;
        const steamMarketUrl =
          row.original.steamMarketUrl ??
          getSteamMarketListingUrl(marketHashName);
        const buffMarketUrl = `https://buff.market/market/all?search=${marketHashName}`;
        const consolidated = {
          tradeable: 0,
          onMarket: 0,
          tradeProtected: 0,
          hold: 0,
          holdDetails: [] as Array<{ quantity: number; holdDays: number }>,
        };
        if (row.original.sourceAccounts) {
          for (const acc of row.original.sourceAccounts) {
            if (acc.breakdown) {
              consolidated.tradeable += acc.breakdown.tradeable ?? 0;
              consolidated.onMarket += acc.breakdown.onMarket ?? 0;
              consolidated.tradeProtected += acc.breakdown.tradeProtected ?? 0;
              consolidated.hold += acc.breakdown.hold ?? 0;
              if (acc.breakdown.holdDetails) {
                consolidated.holdDetails.push(...acc.breakdown.holdDetails);
              }
            }
          }
        }

        const content = (
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectItem?.(row.original);
              }}
              className="group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-stone-800 bg-stone-900 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg active:scale-95 focus:outline-none"
              title={t("inventoryScanner.clickToViewDetails", "Click to view details")}
            >
              <CaseThumbnail
                imageUrl={row.original.caseItem.imageUrl ?? undefined}
                name={row.original.caseItem.name}
                size="lg"
              />
              <span
                className="absolute inset-x-0 bottom-0 h-1"
                style={{
                  backgroundColor:
                    row.original.type === "Capsule" ||
                      row.original.type === "Case"
                      ? "#b0c3d9"
                      : (row.original.rarity?.color ??
                        getItemTypeColor(row.original.type)),
                }}
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectItem?.(row.original);
                  }}
                  className="inline-flex max-w-[24rem] cursor-pointer items-center gap-1.5 truncate text-left font-semibold text-stone-200 hover:text-blue-300 transition-colors focus:outline-none"
                  title={t("inventoryScanner.clickToViewDetails", "Click to view details")}
                >
                  <span className="truncate">{row.original.caseItem.name}</span>
                </button>
                <CopyButton value={marketHashName} />
                <a
                  href={steamMarketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-[20px] w-[20px] cursor-pointer items-center justify-center rounded border border-stone-850 bg-stone-900 text-stone-400 shadow-sm transition-all hover:border-white hover:bg-white hover:text-[#171a21]"
                  title={t("inventoryScanner.openSteamMarket", "Open on Steam Market")}
                >
                  <FaSteam className="size-2.5" />
                </a>
                <a
                  href={buffMarketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-[20px] cursor-pointer items-center justify-center rounded border border-stone-850 bg-stone-900 px-1.5 text-[10px] font-bold text-stone-400 shadow-sm transition-all hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400 select-none"
                  title={t("common.openBuffMarket", "Open on BUFF.Market")}
                >
                  BUFF
                </a>
                {row.original.isManual && (
                  <span className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-blue-400 uppercase">
                    {t("common.manual")}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  style={{
                    backgroundColor: colorWithAlpha(
                      row.original.type === "Capsule" ||
                        row.original.type === "Case"
                        ? "#b0c3d9"
                        : (row.original.rarity?.color ??
                          getItemTypeColor(row.original.type)),
                      0.14,
                    ),
                    color:
                      row.original.type === "Capsule" ||
                        row.original.type === "Case"
                        ? "#b0c3d9"
                        : (row.original.rarity?.color ??
                          getItemTypeColor(row.original.type)),
                  }}
                >
                  {row.original.type}
                </span>
                {row.original.rarity ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: row.original.rarity.color }}
                    />
                    {row.original.rarity.name}
                  </span>
                ) : null}
                {dopplerPhase && <DopplerBadge phase={dopplerPhase} />}
                {fadePercentage !== undefined && <FadeBadge percentage={fadePercentage} />}
                {blueGemTier && blueGemTier !== "Normal" && (
                  <BlueGemBadge tier={blueGemTier} />
                )}
                {marbleFadeTier && marbleFadeTier !== "Normal" && (
                  <MarbleFadeBadge tier={marbleFadeTier} />
                )}
                {row.original.onMarket ? (
                  <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                    Market
                  </span>
                ) : null}
                {row.original.tradeProtected ? (
                  <span className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                    Trade Protected
                  </span>
                ) : null}
                {row.original.holdDays && row.original.holdDays > 0 ? (
                  <span className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
                    {t("inventoryScanner.holdDaysCount", { count: row.original.holdDays })}
                  </span>
                ) : null}
                {row.original.storageUnitQuantity && row.original.storageUnitQuantity > 0 ? (
                  <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    🔒 {row.original.storageUnitQuantity} {t("portfolio.inStorageUnit", "trong Storage Unit")}
                  </span>
                ) : null}
                {(() => {
                  const breakdown = getScannerItemStatusBreakdown(row.original);
                  return (
                    <>
                      {breakdown.tradeable > 0 &&
                        breakdown.tradeable !== row.original.quantity ? (
                        <span
                          aria-label={t("portfolio.tradeableStatusWithQty", "{{count}} tradeable items", { count: breakdown.tradeable })}
                          className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400"
                        >
                          🟢 {breakdown.tradeable}
                        </span>
                      ) : null}
                      {breakdown.onMarket > 0 ? (
                        <span
                          aria-label={t("portfolio.onMarketStatusWithQty", "{{count}} items on market", { count: breakdown.onMarket })}
                          className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400"
                        >
                          🟡 {breakdown.onMarket} Market
                        </span>
                      ) : null}
                      {breakdown.tradeProtected > 0 ? (
                        <span
                          aria-label={t("portfolio.tradeProtectedStatusWithQty", "{{count}} trade-protected items", { count: breakdown.tradeProtected })}
                          className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400"
                        >
                          🔵 {breakdown.tradeProtected} Protected
                        </span>
                      ) : null}
                      {breakdown.hold > 0 &&
                        breakdown.hold !== row.original.quantity ? (
                        <span
                          aria-label={t("portfolio.holdStatusWithQty", "{{count}} items on hold", { count: breakdown.hold })}
                          className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400"
                        >
                          🔴 {breakdown.hold} Hold
                        </span>
                      ) : null}
                    </>
                  );
                })()}
              </div>
              {row.original.sourceAccounts && row.original.sourceAccounts.length > 0 ? (
                <div
                  className="mt-1 flex max-w-[28rem] flex-wrap gap-1"
                  title={row.original.sourceAccounts.map((account) => account.name).join(", ")}
                >
                  {row.original.sourceAccounts.slice(0, 3).map((account) => (
                    <span
                      key={account.steamId64}
                      className="inline-flex max-w-40 items-center truncate rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                    >
                      <span className="truncate">{account.name}</span>
                    </span>
                  ))}
                  {row.original.sourceAccounts.length > 3 ? (
                    <span className="inline-flex items-center rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      +{row.original.sourceAccounts.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {/* Sticker & Charm preview strip */}
              {mode === "transactions" && (() => {
                const stickers = patternInfo?.stickers ?? [];
                const charms = patternInfo?.charms ?? [];
                if (stickers.length === 0 && charms.length === 0) return null;
                return (
                  <div className="mt-1.5 flex items-center gap-2">
                    {stickers.length > 0 && (
                      <StickerPreviewStrip stickers={stickers} t={t} />
                    )}
                    {charms.length > 0 && (
                      <CharmPreviewStrip charms={charms} t={t} />
                    )}
                  </div>
                );
              })()}
              {row.original.isManual && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                  {row.original.buyPrice && (
                    <span className="font-medium text-blue-400/90">{t("inventoryScanner.buyPriceLabel")}{renderVND(row.original.buyPrice)}</span>
                  )}
                  {row.original.buyDate && (
                    <span>{t("inventoryScanner.dateLabel")}{row.original.buyDate.split("-").reverse().join("/")}</span>
                  )}
                  {row.original.sourceAccounts && row.original.sourceAccounts.length > 0 && (
                    <span className="max-w-[12rem] truncate" title={row.original.sourceAccounts[0].name}>
                      {t("inventoryScanner.accountLabelShort")}{row.original.sourceAccounts[0].name}
                    </span>
                  )}
                  {row.original.storageUnitId && (
                    <span className="rounded border border-blue-500/25 bg-blue-500/10 px-1.5 text-[10px] font-medium tracking-wide text-stone-400 uppercase">
                      {row.original.storageUnitName || "Storage Unit"}
                    </span>
                  )}
                </div>
              )}
              {isSkin && !hasBuffPrice && steamPrice > 5000 && (
                <button
                  type="button"
                  onClick={() => fetchBuffPrice(marketHashName)}
                  disabled={isLoadingBuff}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-colors disabled:cursor-wait select-none"
                >
                  {isLoadingBuff ? (
                    <Loader2 className="size-3 animate-spin text-blue-400" />
                  ) : (
                    <FaSyncAlt className="size-2.5 text-blue-400" />
                  )}
                  <span>Dùng giá BUFF</span>
                </button>
              )}
              {isSkin && hasBuffPrice && (
                <button
                  type="button"
                  onClick={() => updateBuffPriceCny(marketHashName, "")}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-400 hover:underline transition-colors select-none"
                >
                  <FaSyncAlt className="size-2.5" />
                  <span>Dùng giá Steam</span>
                </button>
              )}
              {isWeaponOrKnifeOrGlove && row.original.inspectLink && !patternInfo && (
                <button
                  type="button"
                  onClick={() => inspectPattern(row.original.inspectLink!, marketHashName, dopplerPhase)}
                  disabled={inspectingKeys.has(marketHashName)}
                  className="mt-1.5 ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 hover:text-emerald-400 hover:underline transition-colors disabled:cursor-wait select-none"
                >
                  {inspectingKeys.has(marketHashName) ? (
                    <Loader2 className="size-3 animate-spin text-emerald-400" />
                  ) : (
                    <FaSearch className="size-2.5 text-emerald-400" />
                  )}
                  <span>Inspect</span>
                </button>
              )}
            </div>
          </div>
        );

        if (!row.original.sourceAccounts?.length) {
          return content;
        }

        return (
          <HoverCard.Root openDelay={100} closeDelay={150}>
            <HoverCard.Trigger asChild>
              <div className="w-fit cursor-help outline-none">{content}</div>
            </HoverCard.Trigger>
            <HoverCard.Portal>
              <HoverCard.Content
                side="right"
                align="start"
                sideOffset={12}
                className="z-[100] outline-none"
                asChild
              >
                <motion.div
                  initial={{ opacity: 0, x: -8, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.25, 0, 1] }}
                  className="w-80 rounded-xl border border-stone-800 bg-stone-950 p-4 text-stone-100 shadow-[0_12px_36px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur-md"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-stone-800/80 pb-2.5">
                    <div className="max-w-[14rem] truncate text-xs font-bold text-accent">
                      {row.original.caseItem.name}
                    </div>
                    <span className="text-[10px] font-medium text-stone-500">
                      {t("inventoryScanner.totalItems", { count: row.original.quantity })}
                    </span>
                  </div>

                  {/* Consolidated breakdown */}
                  <div className="mb-3 space-y-2 border-b border-stone-800/80 pb-3 text-xs">
                    <div className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                      {t("inventoryScanner.statusBreakdown")}
                    </div>
                    {consolidated.tradeable > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          <span>{t("inventoryScanner.tradeableNow")}</span>
                        </span>
                        <span className="font-bold text-emerald-400">
                          {consolidated.tradeable}
                        </span>
                      </div>
                    )}
                    {consolidated.onMarket > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          <span>{t("inventoryScanner.onMarketNow")}</span>
                        </span>
                        <span className="font-bold text-amber-400">
                          {consolidated.onMarket}
                        </span>
                      </div>
                    )}
                    {consolidated.tradeProtected > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-cyan-400" />
                          <span>Trade Protected</span>
                        </span>
                        <span className="font-bold text-cyan-400">
                          {consolidated.tradeProtected}
                        </span>
                      </div>
                    )}
                    {consolidated.hold > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                          <span>{t("inventoryScanner.holdTrade")}</span>
                        </span>
                        <span className="font-bold text-red-400">
                          {consolidated.hold}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pattern Info Section */}
                  {patternInfo && (
                    <div className="mb-3 space-y-2 border-b border-stone-800/80 pb-3 text-xs">
                      <div className="mb-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                        {t("inventoryScanner.patternInfo")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {dopplerPhase && <DopplerBadge phase={dopplerPhase} />}
                        {fadePercentage !== undefined && <FadeBadge percentage={fadePercentage} />}
                        {blueGemTier && blueGemTier !== "Normal" && (
                          <BlueGemBadge tier={blueGemTier} />
                        )}
                        {marbleFadeTier && marbleFadeTier !== "Normal" && (
                          <MarbleFadeBadge tier={marbleFadeTier} />
                        )}
                      </div>
                      {patternInfo.paintSeed !== undefined && (
                        <div className="flex justify-between text-stone-300">
                          <span>{t("inventoryScanner.paintSeed")}</span>
                          <span className="font-semibold text-stone-100">{patternInfo.paintSeed}</span>
                        </div>
                      )}
                      {patternInfo.floatValue !== undefined && (
                        <div className="flex justify-between text-stone-300">
                          <span>{t("inventoryScanner.floatValue")}</span>
                          <span className="font-semibold text-stone-100">{patternInfo.floatValue.toFixed(8)}</span>
                        </div>
                      )}
                      {overpayInfo && (
                        <div className="mt-2 rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-400">
                          <div className="font-bold text-[10px] uppercase tracking-wider text-emerald-500">
                            {t("inventoryScanner.overpayEstimate")} ({overpayInfo.multiplierSource})
                          </div>
                          <div className="flex justify-between mt-1 text-[11px] font-semibold">
                            <span>BUFF + Overpay:</span>
                            <span className="font-mono">
                              {formatVND(Math.round(overpayInfo.estimatedTypical * buffCnyToVndRate))}{" "}
                              <span className="text-[10px] text-stone-400 font-normal font-sans">
                                ({new Intl.NumberFormat("vi-VN").format(overpayInfo.estimatedTypical)} x {new Intl.NumberFormat("vi-VN").format(buffCnyToVndRate)})
                              </span>
                            </span>
                          </div>
                          <div className="text-[9px] text-stone-400 mt-1">
                            {t("inventoryScanner.overpayDisclaimer")}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sticker & Charm Section in Hover Card */}
                  {patternInfo && (patternInfo.stickers?.length || patternInfo.charms?.length) ? (
                    <HoverCardAccessorySection patternInfo={patternInfo} t={t} />
                  ) : null}

                  {/* Per-account list breakdown */}
                  <div className="max-h-48 space-y-2.5 overflow-y-auto pr-1 text-xs">
                    <div className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                      {t("inventoryScanner.detailsByAccount")}
                    </div>
                    {row.original.sourceAccounts.map((account) => {
                      const accHold = account.breakdown?.hold ?? 0;
                      const accMarket = account.breakdown?.onMarket ?? 0;
                      const accProtected =
                        account.breakdown?.tradeProtected ?? 0;
                      const accTradeable = account.breakdown?.tradeable ?? 0;

                      return (
                        <div
                          key={account.steamId64}
                          className="border-stone-850 rounded border bg-stone-900/40 p-2"
                        >
                          <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-accent">
                            <span className="max-w-[12rem] truncate">
                              {account.name}
                            </span>
                            <span>x{account.quantity}</span>
                          </div>
                          <div className="space-y-1 text-[10px] text-stone-200">
                            {accTradeable > 0 && (
                              <div className="flex justify-between">
                                <span>{t("inventoryScanner.tradeableLabel")}</span>
                                <span className="font-semibold text-emerald-400">
                                  {accTradeable}
                                </span>
                              </div>
                            )}
                            {accMarket > 0 && (
                              <div className="flex justify-between">
                                <span>{t("inventoryScanner.onMarketLabel")}</span>
                                <span className="font-semibold text-amber-400">
                                  {accMarket}
                                </span>
                              </div>
                            )}
                            {accProtected > 0 && (
                              <div className="flex justify-between">
                                <span>{t("inventoryScanner.tradeProtectedLabel")}</span>
                                <span className="font-semibold text-cyan-400">
                                  {accProtected}
                                </span>
                              </div>
                            )}
                            {accHold > 0 && (
                              <div className="flex justify-between">
                                <span>{t("inventoryScanner.holdTradeLabel")}</span>
                                <span className="font-semibold text-red-400">
                                  {accHold}
                                </span>
                              </div>
                            )}
                            {account.breakdown?.holdDetails &&
                              account.breakdown.holdDetails.length > 0 && (
                                <div className="border-stone-850 mt-1.5 space-y-0.5 border-t pt-1 text-[9px] text-stone-400">
                                  {account.breakdown.holdDetails.map(
                                    (detail, dIdx) => (
                                      <div
                                        key={dIdx}
                                        className="flex justify-between"
                                      >
                                        <span>• Qty: {detail.quantity}</span>
                                        <span>{t("inventoryScanner.holdDaysValue", { count: detail.holdDays })}</span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </HoverCard.Content>
            </HoverCard.Portal>
          </HoverCard.Root>
        );
      },
    },
    {
      id: "quantity",
      enableHiding: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("inventoryScanner.quantity")}
          align="right"
        />
      ),
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => {
        if (row.original.isManual && updateManualItemQty && mode === "transactions") {
          return (
            <div className="flex items-center justify-end gap-2.5">
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateManualItemQty(row.original.id || row.original.caseItem.marketHashName, row.original.quantity - 1);
                }}
                className="inline-flex size-6 items-center justify-center rounded bg-stone-800 font-bold text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200"
              >
                -
              </Button>
              <span className="w-8 text-center font-bold text-blue-400">{row.original.quantity}</span>
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateManualItemQty(row.original.id || row.original.caseItem.marketHashName, row.original.quantity + 1);
                }}
                className="inline-flex size-6 items-center justify-center rounded bg-stone-800 font-bold text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200"
              >
                +
              </Button>
            </div>
          );
        }
        return (
          <div className="text-right font-bold text-stone-100 font-mono">
            {new Intl.NumberFormat("vi-VN").format(row.original.quantity)}
          </div>
        );
      },
    },
    {
      id: "price",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("inventoryScanner.unitPriceBuffCny")}
          align="right"
        />
      ),
      accessorFn: (row) => row.price,
      cell: ({ row }) => {
        const item = row.original;
        const buyPriceSection = item.isManual && item.buyPrice && item.buyPrice > 0 ? (
          <span className="text-[10px] font-medium text-blue-400/90 font-sans">
            {t("inventoryScanner.buyPriceLabel")}{renderVND(item.buyPrice)}
          </span>
        ) : null;

        if (item.type !== "Skin") {
          const steamMarketUrl = item.steamMarketUrl ?? getSteamMarketListingUrl(item.caseItem.marketHashName);
          return (
            <div className="flex min-h-[3rem] flex-col items-end justify-center text-right font-mono">
              <a
                href={steamMarketUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-1.5 hover:text-blue-300 transition-colors"
              >
                <span className="text-[13px] font-medium text-stone-300 group-hover:text-stone-200">
                  {renderVND(item.price)}
                </span>
                <FaSteam className="size-3.5 text-stone-500 transition-colors group-hover:text-sky-400" />
              </a>
              {buyPriceSection}
            </div>
          );
        }

        const marketHashName = item.caseItem.marketHashName;
        const patternInfo = item.patternInfo ?? patternResults[marketHashName]?.patternInfo;
        const overpayInfo = patternResults[marketHashName]?.overpay;
        const buffPriceCny =
          item.buffPriceCny ?? buffPricesCny[marketHashName];
        const rawItem = mergedRawItems?.find(
          (i) => i.caseItem.marketHashName === marketHashName,
        );
        const steamPrice = rawItem?.price ?? item.price ?? 0;
        const hasBuffPrice = Number.isFinite(buffPriceCny) && buffPriceCny > 0;
        const buffError = buffPriceErrors[marketHashName];
        const steamMarketUrl = item.steamMarketUrl ?? getSteamMarketListingUrl(marketHashName);
        const buffMarketUrl = `https://buff.market/market/all?search=${marketHashName}`;

        return (
          <div className="flex min-h-[3rem] w-full flex-col items-end justify-center py-1 gap-1">
            {/* Steam Price */}
            <Tooltip content={t("inventoryScanner.steamPriceTooltip")}>
              <a
                href={steamMarketUrl}
                target="_blank"
                rel="noreferrer"
                className="group relative flex cursor-help items-center gap-1.5 hover:text-blue-300 transition-colors"
              >
                <span className="text-[13px] font-medium text-stone-300 group-hover:text-stone-250 font-mono">
                  {renderVND(steamPrice)}
                </span>
                <FaSteam className="size-3.5 text-stone-500 transition-colors group-hover:text-sky-400" />
              </a>
            </Tooltip>

            {/* Buff Price */}
            {hasBuffPrice && (
              <Tooltip
                content={
                  <>
                    {overpayInfo
                      ? `${t("inventoryScanner.buffPriceTooltip", {
                        price: formatPlainNumber(buffPriceCny),
                        rate: formatPlainNumber(buffCnyToVndRate),
                      })} + Overpay (${overpayInfo.multiplierSource})`
                      : t("inventoryScanner.buffPriceTooltip", {
                        price: formatPlainNumber(buffPriceCny),
                        rate: formatPlainNumber(buffCnyToVndRate),
                      })}
                  </>
                }
              >
                <a
                  href={buffMarketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative flex cursor-help items-center gap-1.5 hover:text-blue-300 transition-colors"
                >
                  <span className={`text-[13px] font-medium font-mono ${overpayInfo ? "text-emerald-400" : "text-blue-400"} group-hover:underline`}>
                    {renderVND(
                      overpayInfo
                         ? Math.round(overpayInfo.estimatedTypical * buffCnyToVndRate)
                         : Math.round(buffPriceCny * buffCnyToVndRate)
                    )}{" "}
                    <span className="text-[10px] text-stone-500 font-normal font-sans">
                      {overpayInfo
                        ? `(¥${formatPlainNumber(overpayInfo.estimatedTypical)} x ${formatPlainNumber(buffCnyToVndRate)})`
                        : `(¥${formatPlainNumber(buffPriceCny)} x ${formatPlainNumber(buffCnyToVndRate)})`}
                    </span>
                  </span>
                  <FaCoins className={`size-3.5 ${overpayInfo ? "text-emerald-400" : "text-blue-400"} transition-transform group-hover:scale-110`} />
                </a>
              </Tooltip>
            )}
            {buyPriceSection}
            {buffError ? (
              <span className="mt-1 max-w-44 text-right text-[11px] text-red-350 font-sans">
                {buffError}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "total",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("inventoryScanner.total100")}
          align="right"
        />
      ),
      accessorFn: (row) => row.total,
      cell: ({ row }) => {
        const item = row.original;
        const marketHashName = item.caseItem.marketHashName;
        const patternInfo = item.patternInfo ?? patternResults[marketHashName]?.patternInfo;
        const overpayInfo = patternResults[marketHashName]?.overpay;

        let basePrice = item.price;
        if (item.type === "Skin") {
          const buffPriceCny = item.buffPriceCny ?? buffPricesCny[marketHashName];
          if (Number.isFinite(buffPriceCny) && buffPriceCny > 0) {
            basePrice = Math.round(buffPriceCny * buffCnyToVndRate);
          }
        }

        let finalPrice = basePrice;
        if (overpayInfo) {
          finalPrice = Math.round(overpayInfo.estimatedTypical * buffCnyToVndRate);
        }

        const total = finalPrice * item.quantity;

        return (
          <div className="flex flex-col items-end text-right">
            <span className="font-bold text-emerald-400 font-mono">
              {renderVND(total)}
            </span>
            {overpayInfo && (
              <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider font-sans">
                Overpay
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "scannedAt",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("inventoryScanner.updatedAt")}
          align="right"
        />
      ),
      accessorFn: (row) =>
        row.scannedAt ? new Date(row.scannedAt).getTime() : 0,
      cell: ({ row }) => {
        const val = row.original.scannedAt;
        return (
          <div className="text-right text-[13px] font-medium text-stone-500">
            {formatRelative(val)}
          </div>
        );
      },
    },
    {
      id: "rateAll",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("inventoryScanner.wholesale", { rate: rateAll })}
          align="right"
        />
      ),
      accessorFn: (row) =>
        row.priceSource === "buff163" ? row.total : (row.total * rateAll) / 100,
      cell: ({ row }) => (
        <div className="text-right font-medium text-blue-300 font-mono">
          {renderVND(
            row.original.priceSource === "buff163"
              ? row.original.total
              : (row.original.total * rateAll) / 100,
          )}
        </div>
      ),
    },
    {
      id: "rateLe",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("inventoryScanner.retail", { rate: rateLe })}
          align="right"
        />
      ),
      accessorFn: (row) =>
        row.priceSource === "buff163" ? row.total : (row.total * rateLe) / 100,
      cell: ({ row }) => (
        <div className="text-right font-medium text-amber-400 font-mono">
          {renderVND(
            row.original.priceSource === "buff163"
              ? row.original.total
              : (row.original.total * rateLe) / 100,
          )}
        </div>
      ),
    },
  ];
}

type AccessoryPrice = {
  marketHashName: string;
  price: number;
};

function StickerPreviewStrip({ stickers, t }: { stickers: StickerInfo[]; t: any }) {
  const marketHashNames = useMemo(
    () =>
      Array.from(
        new Set(
          stickers
            .map((item) => item.marketHashName)
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    [stickers],
  );

  const pricesQuery = useQuery({
    queryKey: ["sticker-charm-prices", marketHashNames],
    queryFn: async () => {
      const res = await fetch("/api/inventory/sticker-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketHashNames }),
      });
      if (!res.ok) throw new Error("failedToFetchStickerPrices");
      const data = (await res.json()) as { results?: AccessoryPrice[] };
      return new Map(
        (data.results ?? []).map((item) => [item.marketHashName, item.price]),
      );
    },
    enabled: marketHashNames.length > 0,
    staleTime: 15 * 60 * 1000,
  });

  const priceMap = pricesQuery.data ?? new Map<string, number>();

  const totalStickerPrice = useMemo(
    () =>
      stickers.reduce((sum: number, sticker: any) => {
        if (!sticker.marketHashName) return sum;
        return sum + (priceMap.get(sticker.marketHashName) ?? 0);
      }, 0),
    [stickers, priceMap],
  );

  return (
    <div className="inline-flex h-9 items-center gap-2">
      <div className="inline-flex h-9 items-center gap-0.5">
        {stickers.map((sticker, index) => {
          const wearPercent = formatStickerWearPercent(sticker.wear);
          const stickerPrice = sticker.marketHashName ? priceMap.get(sticker.marketHashName) : undefined;
          const titleParts = [
            sticker.name,
            stickerPrice ? `Price: ${new Intl.NumberFormat("vi-VN").format(stickerPrice)}đ` : null,
            wearPercent ? t("inventoryScanner.stickerCondition", "{{percent}} intact", { percent: wearPercent }) : null,
            sticker.slot !== undefined ? `Slot ${sticker.slot + 1}` : null,
          ].filter(Boolean);

          return (
            <span
              key={`sticker-${sticker.id ?? index}-${sticker.slot ?? index}`}
              className="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-stone-700/70 bg-stone-950 shadow-sm"
              title={titleParts.join(" - ")}
            >
              {sticker.imageUrl ? (
                <img
                  src={proxySteamUrl(sticker.imageUrl)}
                  alt={sticker.name}
                  className="size-full object-contain p-0.5"
                  loading="lazy"
                />
              ) : (
                <Badge className="size-4 text-stone-500" />
              )}
              {wearPercent ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-0.5 text-center text-[8px] font-black leading-3 text-white shadow-[0_-1px_4px_rgba(0,0,0,0.5)]">
                  {wearPercent}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {totalStickerPrice > 0 && (
        <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors" title="Total sticker value (Steam Market)">
          +{new Intl.NumberFormat("vi-VN").format(totalStickerPrice)}đ
        </span>
      )}
    </div>
  );
}

function CharmPreviewStrip({ charms, t }: { charms: CharmInfo[]; t: any }) {
  const marketHashNames = useMemo(
    () =>
      Array.from(
        new Set(
          charms
            .map((item) => item.marketHashName)
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    [charms],
  );

  const pricesQuery = useQuery({
    queryKey: ["sticker-charm-prices", marketHashNames],
    queryFn: async () => {
      const res = await fetch("/api/inventory/sticker-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketHashNames }),
      });
      if (!res.ok) throw new Error("failedToFetchStickerPrices");
      const data = (await res.json()) as { results?: AccessoryPrice[] };
      return new Map(
        (data.results ?? []).map((item) => [item.marketHashName, item.price]),
      );
    },
    enabled: marketHashNames.length > 0,
    staleTime: 15 * 60 * 1000,
  });

  const priceMap = pricesQuery.data ?? new Map<string, number>();

  const totalCharmPrice = useMemo(
    () =>
      charms.reduce((sum: number, charm: any) => {
        if (!charm.marketHashName) return sum;
        return sum + (priceMap.get(charm.marketHashName) ?? 0);
      }, 0),
    [charms, priceMap],
  );

  return (
    <div className="inline-flex h-9 items-center gap-2">
      <div className="inline-flex h-9 items-center gap-0.5">
        {charms.map((charm, index) => {
          const charmPrice = charm.marketHashName ? priceMap.get(charm.marketHashName) : undefined;
          const titleParts = [
            charm.name,
            charmPrice ? `Price: ${new Intl.NumberFormat("vi-VN").format(charmPrice)}đ` : null,
          ].filter(Boolean);

          return (
            <span
              key={`charm-${charm.id ?? index}-${charm.slot ?? index}`}
              className="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-amber-700/40 bg-stone-950 shadow-sm"
              title={titleParts.join(" - ")}
            >
              {charm.imageUrl ? (
                <img
                  src={proxySteamUrl(charm.imageUrl)}
                  alt={charm.name}
                  className="size-full object-contain p-0.5"
                  loading="lazy"
                />
              ) : (
                <Sparkles className="size-4 text-amber-500/60" />
              )}
            </span>
          );
        })}
      </div>
      {totalCharmPrice > 0 && (
        <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors" title="Total charm value (Steam Market)">
          +{new Intl.NumberFormat("vi-VN").format(totalCharmPrice)}đ
        </span>
      )}
    </div>
  );
}

function HoverCardAccessorySection({
  patternInfo,
  t,
}: {
  patternInfo: any;
  t: any;
}) {
  const stickers = patternInfo?.stickers ?? [];
  const charms = patternInfo?.charms ?? [];
  const hasAccessories = stickers.length > 0 || charms.length > 0;

  const marketHashNames = useMemo(
    () =>
      Array.from(
        new Set(
          [...stickers, ...charms]
            .map((item) => item.marketHashName)
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    [stickers, charms],
  );

  const pricesQuery = useQuery({
    queryKey: ["sticker-charm-prices", marketHashNames],
    queryFn: async () => {
      const res = await fetch("/api/inventory/sticker-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketHashNames }),
      });
      if (!res.ok) throw new Error("failedToFetchStickerPrices");
      const data = (await res.json()) as { results?: AccessoryPrice[] };
      return new Map(
        (data.results ?? []).map((item) => [item.marketHashName, item.price]),
      );
    },
    enabled: marketHashNames.length > 0,
    staleTime: 15 * 60 * 1000,
  });

  const priceMap = pricesQuery.data ?? new Map<string, number>();

  const totalStickerPrice = useMemo(
    () =>
      stickers.reduce((sum: number, sticker: any) => {
        if (!sticker.marketHashName) return sum;
        return sum + (priceMap.get(sticker.marketHashName) ?? 0);
      }, 0),
    [stickers, priceMap],
  );

  const totalCharmPrice = useMemo(
    () =>
      charms.reduce((sum: number, charm: any) => {
        if (!charm.marketHashName) return sum;
        return sum + (priceMap.get(charm.marketHashName) ?? 0);
      }, 0),
    [charms, priceMap],
  );

  const totalAccessoryPrice = totalStickerPrice + totalCharmPrice;

  if (!hasAccessories) return null;

  return (
    <div className="mb-3 space-y-2.5 border-b border-stone-800/80 pb-3 text-xs">
      {stickers.length > 0 && (
        <>
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-stone-500 uppercase">
            <span>{t("inventoryScanner.stickersLabel", "Stickers")}</span>
            {totalStickerPrice > 0 && (
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                {formatVND(totalStickerPrice)}
              </span>
            )}
          </div>
          <div className="grid gap-1.5">
            {stickers.map((sticker: any, sIdx: number) => {
              const wearPercent = formatStickerWearPercent(sticker.wear);
              const stickerPrice = sticker.marketHashName ? priceMap.get(sticker.marketHashName) : undefined;
              return (
                <div
                  key={`hc-sticker-${sticker.id ?? sIdx}-${sticker.slot ?? sIdx}`}
                  className="flex items-center justify-between gap-1.5 rounded border border-stone-800/60 bg-stone-900/40 px-2 py-1.5 hover:bg-stone-900/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {sticker.imageUrl ? (
                      <img
                        src={proxySteamUrl(sticker.imageUrl)}
                        alt={sticker.name}
                        className="size-7 shrink-0 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Badge className="size-4 shrink-0 text-stone-500" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-[10px] font-medium text-stone-200 pr-1">
                        {sticker.name}
                      </span>
                      {wearPercent && (
                        <span className="text-[9px] font-bold text-stone-400">
                          {t("inventoryScanner.stickerCondition", "{{percent}} intact", { percent: wearPercent })}
                        </span>
                      )}
                    </div>
                  </div>
                  {stickerPrice !== undefined && stickerPrice > 0 && (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10">
                      {formatVND(stickerPrice)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {charms.length > 0 && (
        <>
          <div className="mb-1 mt-2 flex items-center justify-between text-[10px] font-bold tracking-wider text-stone-500 uppercase">
            <span>{t("inventoryScanner.charmsLabel", "Charms")}</span>
            {totalCharmPrice > 0 && (
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                {formatVND(totalCharmPrice)}
              </span>
            )}
          </div>
          <div className="grid gap-1.5">
            {charms.map((charm: any, cIdx: number) => {
              const charmPrice = charm.marketHashName ? priceMap.get(charm.marketHashName) : undefined;
              return (
                <div
                  key={`hc-charm-${charm.id ?? cIdx}-${charm.slot ?? cIdx}`}
                  className="flex items-center justify-between gap-1.5 rounded border border-stone-800/60 bg-stone-900/40 px-2 py-1.5 hover:bg-stone-900/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {charm.imageUrl ? (
                      <img
                        src={proxySteamUrl(charm.imageUrl)}
                        alt={charm.name}
                        className="size-7 shrink-0 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Sparkles className="size-4 shrink-0 text-stone-500" />
                    )}
                    <span className="truncate text-[10px] font-medium text-stone-200 pr-1">
                      {charm.name}
                    </span>
                  </div>
                  {charmPrice !== undefined && charmPrice > 0 && (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10">
                      {formatVND(charmPrice)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {totalAccessoryPrice > 0 && (
        <div className="flex justify-between items-center pt-2 border-t border-stone-800/50 text-[10px] text-stone-400 font-semibold">
          <span>{t("inventoryScanner.accessoryTotalLabel", "Total Sticker/Charm Value:")}</span>
          <span className="font-mono text-emerald-400 font-extrabold text-[11px]">
            {formatVND(totalAccessoryPrice)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatStickerWearPercent(wear?: number) {
  if (wear === undefined || !Number.isFinite(wear)) return null;
  const intact = 100 - Math.round(Math.max(0, Math.min(1, wear)) * 100);
  return `${intact}%`;
}
