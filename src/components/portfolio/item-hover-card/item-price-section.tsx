"use client";

"use client";

import React from "react";
import { TbCoins } from "react-icons/tb";
import { PortfolioTableRow } from "../portfolio-table-model";
import { formatIntegerViInput, formatVND } from "@/utils/format";
import { useTranslation } from "react-i18next";

interface ItemPriceSectionProps {
  item: PortfolioTableRow;
  quantity: string;
  setQuantity: (val: string) => void;
  priceCny: string;
  updateCny: (val: string) => void;
  buyRate: string;
  updateBuyRate: (val: string) => void;
  sellRate?: string;
  updateSellRate?: (val: string) => void;
  note: string;
  setNote: (val: string) => void;
  priceVnd: string;
  updateVnd: (val: string) => void;
  submit: () => void;
  showStickerFormulaTotal?: boolean;
  stickerFormulaTotalPrice?: number | null;
  useSellLabel?: boolean;
  hasBuff?: boolean;
}

export function ItemPriceSection({
  item,
  quantity,
  setQuantity,
  priceCny,
  updateCny,
  buyRate,
  updateBuyRate,
  sellRate,
  updateSellRate,
  note,
  setNote,
  priceVnd,
  updateVnd,
  submit,
  showStickerFormulaTotal = false,
  stickerFormulaTotalPrice = null,
  useSellLabel = false,
  hasBuff = true,
}: ItemPriceSectionProps) {
  const { t } = useTranslation();
  const stickerFormulaDisplay =
    stickerFormulaTotalPrice !== null && Number.isFinite(stickerFormulaTotalPrice)
      ? formatVND(stickerFormulaTotalPrice)
      : priceVnd
        ? `${priceVnd} ₫`
        : "";

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950/20 p-3.5 space-y-3 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]">
      <div className="text-[10px] font-extrabold tracking-wide text-stone-400 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <TbCoins className="size-3.5 text-amber-500" />
          {t("portfolio.quantityAndPrice", "Số lượng & Đơn giá bán")}
        </div>
        {item.sourceType === "existing" && (
          <span className="text-[8px] font-extrabold text-accent/90 bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20 select-none shadow-[0_0_10px_rgba(59,130,246,0.08)] tracking-wide">
            {t("portfolio.scannedFromInventory", "Scan từ Inventory")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t("portfolio.quantity", "Số lượng")}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              aria-label={t("portfolio.quantity", "Quantity")}
              value={quantity}
              onChange={(e) => setQuantity(formatIntegerViInput(e.target.value))}
              disabled={item.sourceType === "existing"}
              className="h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-12 text-right text-xs font-bold text-stone-100 placeholder:text-stone-600 transition-all duration-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wide text-stone-400 bg-stone-900/60 border border-stone-800/50 px-1.5 py-0.5 rounded select-none">
              SL
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {hasBuff
              ? (useSellLabel ? "Giá bán CNY" : t("portfolio.buyPriceCny", "Giá mua CNY"))
              : (useSellLabel ? "Giá Market (VND)" : "Giá Market (VND)")}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              aria-label={hasBuff ? t("portfolio.priceCny", "CNY Price") : "Market Price VND"}
              value={priceCny}
              onChange={(e) => updateCny(e.target.value)}
              className="h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-12 text-right text-xs font-bold text-stone-100 placeholder:text-stone-600 transition-all duration-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none"
            />
            <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wide text-stone-400 bg-stone-900/60 border border-stone-800/50 px-1.5 py-0.5 rounded select-none">
              {hasBuff ? "CNY" : "VND"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {hasBuff
              ? t("portfolio.buyRate", "Tỷ giá mua")
              : "Tỷ lệ chiết khấu (%)"}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              aria-label={hasBuff ? t("portfolio.buyRate", "Buy Rate") : "Rate Percent"}
              value={buyRate}
              onChange={(e) => updateBuyRate(e.target.value)}
              className="h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-14 text-right text-xs font-bold text-stone-100 placeholder:text-stone-600 transition-all duration-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none"
            />
            <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wide text-stone-400 bg-stone-900/60 border border-stone-800/50 px-1.5 py-0.5 rounded select-none">
              {hasBuff ? "Tỷ giá" : "%"}
            </span>
          </div>
        </div>

        {hasBuff && sellRate !== undefined && updateSellRate && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-extrabold tracking-wide text-emerald-500/80">
              {t("portfolio.sellRate", "Tỷ giá bán")}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                aria-label={t("portfolio.sellRate", "Sell Rate")}
                value={sellRate}
                onChange={(e) => updateSellRate(e.target.value)}
                className="h-9 w-full rounded-lg border border-emerald-800/30 bg-emerald-950/10 pr-3 pl-14 text-right text-xs font-bold text-emerald-300 placeholder:text-stone-600 transition-all duration-200 hover:border-emerald-700/40 hover:bg-emerald-950/20 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none"
              />
              <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wide text-emerald-500/60 bg-emerald-900/20 border border-emerald-800/20 px-1.5 py-0.5 rounded select-none">
                Tỷ giá
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t("portfolio.note", "Ghi chú")}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={t("portfolio.notePlaceholder", "E.g.: Storage unit...")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-14 text-xs font-semibold text-stone-100 placeholder:text-stone-600 transition-all duration-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none"
            />
            <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wide text-stone-400 bg-stone-900/60 border border-stone-800/50 px-1.5 py-0.5 rounded select-none">
              Ghi chú
            </span>
          </div>
        </div>
      </div>

      {/* Tổng giá bán VND */}
      <div className="mt-3.5 flex items-center justify-between rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3.5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)] transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/8">
        <div className="flex flex-col">
          <span className="text-[9px] font-extrabold tracking-wide text-emerald-400">
            {t("portfolio.totalBuyPriceVnd", "Tổng giá mua (VND)")}
          </span>
          <span className="text-[8px] text-stone-500">
            {t("portfolio.skinStickerFormula", "Giá Skin + (giá Sticker × %)")}
          </span>
        </div>
        {showStickerFormulaTotal && (
          <div className="max-w-[12rem] text-right text-xs font-extrabold leading-snug text-emerald-300">
            {stickerFormulaDisplay}
          </div>
        )}
        <div className={showStickerFormulaTotal ? "hidden" : "relative flex items-center"}>
          <input
            type="text"
            aria-label={t("portfolio.buyPriceVnd", "Buy Price VND")}
            value={priceVnd}
            onChange={(e) => updateVnd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="w-36 bg-transparent pr-5 text-right text-lg font-extrabold text-emerald-400 outline-none focus:ring-0 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]"
          />
          <span className="absolute right-0 text-sm font-bold text-emerald-500">
            ₫
          </span>
        </div>
      </div>
    </div>
  );
}
