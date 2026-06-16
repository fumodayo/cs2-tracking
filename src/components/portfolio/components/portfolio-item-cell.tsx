import React, { useState } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import { motion } from "framer-motion";
import { FaSteam } from "react-icons/fa";
import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CopyButton } from "@/components/ui/actions";
import { SlidePanel, SlidePanelContent } from "@/components/ui/slide-panel";
import { CaseThumbnail } from "../case-thumbnail";

import {
  PortfolioTableRow,
  PortfolioTableMode,
  getItemStatusBreakdown,
} from "../portfolio-table-model";

import {
  formatSourceAccountTitle,
  getSteamMarketListingUrl,
  getItemTypeColor,
  getItemTypeLabel,
  colorWithAlpha,
} from "../portfolio-table-utils";

import { ItemHoverCard } from "./item-hover-card";
import { TradeHoldBadge } from "./trade-hold-badge";

export function ItemCell({
  item,
  mode,
  relatedRows,
  onUpdateQuantity,
  onUpdateBuyPrice,
  onUpdateNote,
  onUpdateLot,
  onUpdateBuffRate,
  fetchBuffPrice,
  buffLoadingKeys,
  buffCnyToVndRate,
  buffPricesCny,
  onUpdateBuffPrice,
  onDelete,
  deletingId,
}: {
  item: PortfolioTableRow;
  mode: PortfolioTableMode;
  relatedRows: PortfolioTableRow[];
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
  onUpdateNote?: (id: string, note: string) => Promise<void> | void;
  onUpdateLot?: (
    id: string,
    payload: {
      quantity?: number;
      buyPrice?: number;
      note?: string;
      sourceAccounts?: Array<{ steamId64: string; name: string }>;
      storageUnitId?: string;
      tradeHoldUntil?: string | null;
    },
  ) => Promise<void> | void;
  onUpdateBuffRate?: (rate: number) => void;
  fetchBuffPrice?: (marketHashName: string) => void;
  buffLoadingKeys?: Set<string>;
  buffCnyToVndRate?: number;
  buffPricesCny?: Record<string, number>;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const steamMarketUrl = getSteamMarketListingUrl(item.case.marketHashName);
  const typeColor =
    item.itemType === "capsule" || item.itemType === "case"
      ? "#b0c3d9"
      : (item.case.rarity?.color ?? getItemTypeColor(item.itemType));

  const [hoverCardOpen, setHoverCardOpen] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  return (
    <>
      <HoverCard.Root
        open={hoverCardOpen || isSelectOpen}
        onOpenChange={(val) => {
          if (!val && isSelectOpen) return;
          setHoverCardOpen(val);
        }}
        openDelay={100}
        closeDelay={150}
      >
        <HoverCard.Trigger asChild>
          <div className="relative flex w-fit items-center gap-3 outline-none">
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-stone-800 bg-surface-muted transition-all duration-300 hover:scale-[1.06] hover:border-blue-500/40 hover:shadow-lg active:scale-95 focus:outline-none"
              title="Click để Tùy chỉnh / Sửa đợt mua"
            >
              <CaseThumbnail
                imageUrl={item.case.imageUrl}
                name={item.case.name}
                size="lg"
              />
              <span
                className="absolute inset-x-0 bottom-0 h-1"
                style={{ backgroundColor: typeColor }}
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(true)}
                  className="inline-flex max-w-[24rem] cursor-pointer items-center gap-1.5 truncate text-left font-bold text-foreground transition-colors hover:text-blue-400 focus:outline-none"
                  title="Click để Tùy chỉnh / Sửa đợt mua"
                >
                  <span className="truncate">{item.case.name}</span>
                </button>
                <CopyButton value={item.case.marketHashName} />
                <a
                  href={steamMarketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex cursor-pointer items-center justify-center rounded border border-stone-800 bg-stone-900 p-1 text-stone-400 shadow-sm transition-all hover:border-white hover:bg-white hover:text-[#171a21]"
                  title="Mở trên Steam Market"
                >
                  <FaSteam className="size-3.5" />
                </a>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  style={{
                    backgroundColor: colorWithAlpha(typeColor, 0.14),
                    color: typeColor,
                  }}
                >
                  {getItemTypeLabel(item.itemType)}
                </span>
                {item.storageUnitQuantity && item.storageUnitQuantity > 0 ? (
                  <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    🔒 {item.storageUnitQuantity} {t("portfolio.inStorageUnit", "trong Storage Unit")}
                  </span>
                ) : null}
                <TradeHoldBadge tradeHoldUntil={item.tradeHoldUntil} />
                {(() => {
                  const breakdown = getItemStatusBreakdown(item);
                  return (
                    <>
                      {breakdown.tradeable > 0 &&
                        breakdown.tradeable !== item.quantity ? (
                        <span className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          🟢 {breakdown.tradeable}
                        </span>
                      ) : null}
                      {breakdown.onMarket > 0 ? (
                        <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                          🟡 {breakdown.onMarket} Market
                        </span>
                      ) : null}
                      {breakdown.tradeProtected > 0 ? (
                        <span className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400">
                          🔵 {breakdown.tradeProtected} Protected
                        </span>
                      ) : null}
                      {breakdown.hold > 0 &&
                        breakdown.hold !== item.quantity ? (
                        <span className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                          🔴 {breakdown.hold} Hold
                        </span>
                      ) : null}
                    </>
                  );
                })()}
                {item.sourceType === "manual" ? (
                  <span className="inline-flex rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">
                    {t("common.manual", "Thủ công")}
                  </span>
                ) : null}
                {relatedRows.length > 1 ? (
                  <span className="inline-flex rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-sky-300 uppercase">
                    {t("common.lot_other", `${relatedRows.length} lot`, { count: relatedRows.length })}
                  </span>
                ) : null}
                {item.note &&
                  !item.note.toLowerCase().includes("inventory scanner") &&
                  !item.note.toLowerCase().includes("import từ inventory scanner") &&
                  !item.note.toLowerCase().includes("đồng bộ từ") &&
                  !item.note.toLowerCase().includes("trade history") &&
                  item.note !== "Thủ công" ? (
                  <span
                    className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-300 uppercase shadow-[0_0_8px_rgba(16,185,129,0.08)]"
                    title={item.note === "Thủ công" ? t("common.manual") : item.note}
                  >
                    <Tag className="size-2.5 shrink-0 text-emerald-400" />
                    <span className="truncate">
                      {item.note === "Thủ công"
                        ? t("common.manual")
                        : item.note === "Import từ inventory scanner"
                        ? t("portfolio.noteInventoryScan")
                        : item.note}
                    </span>
                  </span>
                ) : null}
              </div>
              {item.sourceAccounts.length > 0 ? (
                <div
                  className="mt-1 flex max-w-[28rem] flex-wrap gap-1"
                  title={formatSourceAccountTitle(item.sourceAccounts)}
                >
                  {item.sourceAccounts.slice(0, 3).map((account) => (
                    <span
                      key={account.steamId64}
                      className="inline-flex max-w-40 items-center truncate rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                    >
                      <span className="truncate">{account.name}</span>
                    </span>
                  ))}
                  {item.sourceAccounts.length > 3 ? (
                    <span className="inline-flex items-center rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      +{item.sourceAccounts.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {mode === "case-summary" ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("common.purchasesWithCount", `${item.lotCount} lần mua`, { count: item.lotCount })}
                </div>
              ) : null}
            </div>
          </div>
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            side="right"
            sideOffset={12}
            className="z-[100] outline-none"
            asChild
          >
            <motion.div
              initial={{ opacity: 0, x: -12, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.25, 0.25, 0, 1] }}
            >
              <ItemHoverCard
                key={item.id}
                item={item}
                relatedRows={relatedRows}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateBuyPrice={onUpdateBuyPrice}
                onUpdateNote={onUpdateNote}
                onUpdateLot={onUpdateLot}
                onUpdateBuffRate={onUpdateBuffRate}
                fetchBuffPrice={fetchBuffPrice}
                buffLoadingKeys={buffLoadingKeys}
                buffCnyToVndRate={buffCnyToVndRate}
                buffPricesCny={buffPricesCny}
                onUpdateBuffPrice={onUpdateBuffPrice}
                onDelete={onDelete}
                deletingId={deletingId}
                onSelectOpenChange={setIsSelectOpen}
              />
            </motion.div>
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>

      {/* SlidePanel for details and editing/deleting individual lots */}
      <SlidePanel open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SlidePanelContent
          title={item.case.name}
          hideHeader
          noPadding
          className="border-stone-850/80 max-w-[440px] overflow-hidden border-l border-border bg-[#0e121a] text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
        >
          <ItemHoverCard
            item={item}
            relatedRows={relatedRows}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateBuyPrice={onUpdateBuyPrice}
            onUpdateNote={onUpdateNote}
            onUpdateLot={onUpdateLot}
            onUpdateBuffRate={onUpdateBuffRate}
            fetchBuffPrice={fetchBuffPrice}
            buffLoadingKeys={buffLoadingKeys}
            buffCnyToVndRate={buffCnyToVndRate}
            buffPricesCny={buffPricesCny}
            onUpdateBuffPrice={onUpdateBuffPrice}
            onDelete={onDelete}
            deletingId={deletingId}
            embedded
          />
        </SlidePanelContent>
      </SlidePanel>
    </>
  );
}
