'use client';

'use client';

import React from 'react';
import { TbCoins } from 'react-icons/tb';
import { PortfolioTableRow } from '../portfolio-table-model';
import { formatIntegerViInput, formatVND } from '@/utils/format';
import { useTranslation } from 'react-i18next';
import { calculateLotTotal } from './item-price-section-values';

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
  isGuest?: boolean;
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
  isGuest = false,
}: ItemPriceSectionProps) {
  const { t } = useTranslation();
  const stickerFormulaDisplay =
    stickerFormulaTotalPrice !== null && Number.isFinite(stickerFormulaTotalPrice)
      ? formatVND(stickerFormulaTotalPrice)
      : priceVnd
        ? `${priceVnd} ₫`
        : '';
  const unitPriceForTotal =
    showStickerFormulaTotal &&
    stickerFormulaTotalPrice !== null &&
    Number.isFinite(stickerFormulaTotalPrice)
      ? stickerFormulaTotalPrice
      : priceVnd;
  const lotTotal = calculateLotTotal(quantity, unitPriceForTotal);

  return (
    <div className="space-y-3 rounded-xl border border-stone-800 bg-stone-950/20 p-3.5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between gap-1.5 text-[10px] font-extrabold tracking-wide text-stone-400">
        <div className="flex items-center gap-1.5">
          <TbCoins className="size-3.5 text-amber-500" />
          {isGuest || useSellLabel
            ? t('portfolio.quantityAndSellPrice', 'Số lượng & Đơn giá bán')
            : t('portfolio.quantityAndBuyPrice', 'Số lượng & Đơn giá mua')}
        </div>
        {item.sourceType === 'existing' && (
          <span className="text-accent/90 bg-accent/10 border-accent/20 rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-wide shadow-[0_0_10px_rgba(59,130,246,0.08)] select-none">
            {t('portfolio.scannedFromInventory', 'Scan từ Inventory')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t('portfolio.quantity', 'Số lượng')}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              aria-label={t('portfolio.quantity', 'Quantity')}
              value={quantity}
              onChange={(e) => setQuantity(formatIntegerViInput(e.target.value))}
              disabled={item.sourceType === 'existing'}
              className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-12 text-right text-xs font-bold text-stone-100 transition-all duration-200 placeholder:text-stone-600 hover:bg-stone-950/60 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
            <span className="pointer-events-none absolute left-2 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-stone-400 select-none">
              SL
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {hasBuff
              ? useSellLabel
                ? 'Giá bán CNY'
                : t('portfolio.buyPriceCny', 'Giá mua CNY')
              : useSellLabel
                ? 'Giá Market (VND)'
                : 'Giá Market (VND)'}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              aria-label={hasBuff ? t('portfolio.priceCny', 'CNY Price') : 'Market Price VND'}
              value={priceCny}
              onChange={(e) => updateCny(e.target.value)}
              readOnly={!hasBuff}
              aria-readonly={!hasBuff}
              className={`h-9 w-full rounded-lg border border-stone-800 pr-3 pl-12 text-right text-xs font-bold transition-all duration-200 focus:outline-none ${
                hasBuff
                  ? 'hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 bg-stone-950/30 text-stone-100 placeholder:text-stone-600 hover:bg-stone-950/60 focus:ring-2'
                  : 'cursor-default bg-stone-900/40 text-stone-400'
              }`}
            />
            <span className="pointer-events-none absolute left-2 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-stone-400 select-none">
              {hasBuff ? 'CNY' : 'VND'}
            </span>
          </div>
        </div>

        {hasBuff && (
          <div className="flex flex-col gap-1.5">
            <label
              className={`text-[9px] font-extrabold tracking-wide ${isGuest ? 'text-emerald-500/80' : 'text-stone-500'}`}
            >
              {isGuest
                ? t('portfolio.sellRate', 'Tỷ giá bán')
                : t('portfolio.buyRate', 'Tỷ giá mua')}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                aria-label={
                  isGuest
                    ? t('portfolio.sellRate', 'Sell Rate')
                    : t('portfolio.buyRate', 'Buy Rate')
                }
                value={buyRate}
                onChange={(e) => updateBuyRate(e.target.value)}
                className={
                  isGuest
                    ? 'h-9 w-full rounded-lg border border-emerald-800/30 bg-emerald-950/10 pr-3 pl-14 text-right text-xs font-bold text-emerald-300 transition-all duration-200 placeholder:text-stone-600 hover:border-emerald-700/40 hover:bg-emerald-950/20 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none'
                    : 'hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-14 text-right text-xs font-bold text-stone-100 transition-all duration-200 placeholder:text-stone-600 hover:bg-stone-950/60 focus:ring-2 focus:outline-none'
                }
              />
              <span
                className={
                  isGuest
                    ? 'pointer-events-none absolute left-2 rounded border border-emerald-800/20 bg-emerald-900/20 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-emerald-500/60 select-none'
                    : 'pointer-events-none absolute left-2 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-stone-400 select-none'
                }
              >
                Tỷ giá
              </span>
            </div>
          </div>
        )}

        {hasBuff && !isGuest && sellRate !== undefined && updateSellRate && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-extrabold tracking-wide text-emerald-500/80">
              {t('portfolio.sellRate', 'Tỷ giá bán')}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                aria-label={t('portfolio.sellRate', 'Sell Rate')}
                value={sellRate}
                onChange={(e) => updateSellRate(e.target.value)}
                className="h-9 w-full rounded-lg border border-emerald-800/30 bg-emerald-950/10 pr-3 pl-14 text-right text-xs font-bold text-emerald-300 transition-all duration-200 placeholder:text-stone-600 hover:border-emerald-700/40 hover:bg-emerald-950/20 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none"
              />
              <span className="pointer-events-none absolute left-2 rounded border border-emerald-800/20 bg-emerald-900/20 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-emerald-500/60 select-none">
                Tỷ giá
              </span>
            </div>
          </div>
        )}

        <div className={`flex flex-col gap-1.5 ${hasBuff ? '' : 'col-span-2'}`}>
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t('portfolio.note', 'Ghi chú')}
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={t('portfolio.notePlaceholder', 'E.g.: Storage unit...')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="hover:border-stone-750 focus:border-accent/40 focus:ring-accent/10 h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 pr-3 pl-14 text-xs font-semibold text-stone-100 transition-all duration-200 placeholder:text-stone-600 hover:bg-stone-950/60 focus:ring-2 focus:outline-none"
            />
            <span className="pointer-events-none absolute left-2 rounded border border-stone-800/50 bg-stone-900/60 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-stone-400 select-none">
              Ghi chú
            </span>
          </div>
        </div>
      </div>

      {/* Đơn giá và tổng giá trị của lô */}
      <div className="mt-3.5 flex items-center justify-between rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3.5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)] transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/8">
        <div className="flex flex-col">
          <span className="text-[9px] font-extrabold tracking-wide text-emerald-400">
            {isGuest || useSellLabel
              ? t('portfolio.unitSellPriceVnd', 'Đơn giá bán (VND)')
              : t('portfolio.unitBuyPriceVnd', 'Đơn giá mua (VND)')}
          </span>
          {showStickerFormulaTotal && (
            <span className="text-[8px] text-stone-500">
              {t('portfolio.skinStickerFormula', 'Giá Skin + (giá Sticker × %)')}
            </span>
          )}
          <span className="text-[8px] text-stone-500">
            {isGuest || useSellLabel
              ? t('portfolio.totalSellValue', 'Tổng giá bán')
              : t('portfolio.totalInvestedValue', 'Tổng vốn')}
            : {lotTotal === null ? '—' : formatVND(lotTotal)}
          </span>
        </div>
        {showStickerFormulaTotal && (
          <div className="max-w-[12rem] text-right text-xs leading-snug font-extrabold text-emerald-300">
            {stickerFormulaDisplay}
          </div>
        )}
        <div className={showStickerFormulaTotal ? 'hidden' : 'relative flex items-center'}>
          <input
            type="text"
            aria-label={
              isGuest || useSellLabel
                ? t('portfolio.unitSellPriceVnd', 'Unit Sell Price VND')
                : t('portfolio.unitBuyPriceVnd', 'Unit Buy Price VND')
            }
            value={priceVnd}
            onChange={(e) => updateVnd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="w-36 bg-transparent pr-5 text-right text-lg font-extrabold text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)] outline-none focus:ring-0"
          />
          <span className="absolute right-0 text-sm font-bold text-emerald-500">₫</span>
        </div>
      </div>
    </div>
  );
}
