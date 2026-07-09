'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import type { PortfolioTableRow } from '@/components/portfolio';
import { TbPercentage, TbShoppingBag, TbInfoCircle } from 'react-icons/tb';
import { CountUp } from '@/components/ui/animation/count-up';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';

type RateCardsProps = {
  rows: PortfolioTableRow[];
  totalInvested: number;
};

const RATE_ITEM_TYPES = new Set(['case', 'sticker', 'capsule']);

const LS_KEY_RATE_SI = 'cs2t_rateSi';
const LS_KEY_RATE_LE = 'cs2t_rateLe';

function readRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) || fallback : fallback;
}

/**
 *
 * Kiểm tra dòng skin có giá Buff override hay không.
 * Khi đã đặt giá Buff, currentPrice sẽ khác steamPrice.
 *
 */
function hasBuff(row: PortfolioTableRow): boolean {
  return (
    row.currentPrice !== null &&
    row.steamPrice !== null &&
    row.steamPrice !== undefined &&
    row.currentPrice !== row.steamPrice
  );
}

function computeRateValue(rows: PortfolioTableRow[], ratePercent: number): number {
  let total = 0;

  for (const r of rows) {
    const value = r.currentValue ?? r.investedValue;

    if (r.itemType === 'skin') {
      // Skin có giá Buff → 100%, skin không có Buff → áp rate
      total += hasBuff(r) ? value : value * (ratePercent / 100);
    } else if (RATE_ITEM_TYPES.has(r.itemType)) {
      // Case, sticker, capsule → áp rate
      total += value * (ratePercent / 100);
    }
  }

  return total;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(v);

function ProfitBadge({ profit, invested }: { profit: number; invested: number }) {
  const percent = invested > 0 ? (profit / invested) * 100 : 0;
  const isPositive = profit >= 0;

  return (
    <p className={`mt-1.5 text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? '+' : ''}
      {fmt(profit)} đ
      <span className="ml-1.5 text-xs opacity-70">
        ({isPositive ? '+' : ''}
        {percent.toFixed(1)}%)
      </span>
    </p>
  );
}

/**
 * Render dưới dạng fragment — thiết kế để gắn vào lưới SummaryCards.
 */
export function RateCards({ rows, totalInvested }: RateCardsProps) {
  const { t } = useTranslation();
  const [rateSi, setRateSi] = useState(() => readRate(LS_KEY_RATE_SI, 60));
  const [rateLe, setRateLe] = useState(() => readRate(LS_KEY_RATE_LE, 65));

  useEffect(() => {
    localStorage.setItem(LS_KEY_RATE_SI, String(rateSi));
  }, [rateSi]);

  useEffect(() => {
    localStorage.setItem(LS_KEY_RATE_LE, String(rateLe));
  }, [rateLe]);

  const valueSi = computeRateValue(rows, rateSi);
  const valueLe = computeRateValue(rows, rateLe);

  const profitSi = valueSi - totalInvested;
  const profitLe = valueLe - totalInvested;

  return (
    <>
      {/* Rate sỉ (all) */}
      <Card className="border-accent/24 bg-accent/8 text-foreground h-full border p-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
                {t('rateCards.rateSi')}
              </p>
              <TooltipProvider>
                <Tooltip
                  content={<span>{t('rateCards.rateSiTooltip')}</span>}
                  side="top"
                  align="start"
                >
                  <span className="text-muted-foreground cursor-help opacity-60 transition-opacity hover:opacity-100">
                    <TbInfoCircle className="size-3.5" />
                  </span>
                </Tooltip>
              </TooltipProvider>
              <div className="border-accent/24 bg-accent/12 flex items-center gap-1 rounded-md border px-1.5 py-0.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rateSi}
                  onChange={(e) => setRateSi(Number(e.target.value) || 0)}
                  aria-label={t('rateCards.rateSiAriaLabel')}
                  className="text-accent w-10 [appearance:textfield] bg-transparent text-center text-sm font-bold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-muted-foreground text-xs">%</span>
              </div>
            </div>
            <p className="text-accent mt-2 text-2xl font-semibold tracking-normal">
              <CountUp to={valueSi} decimals={0} separator="." />₫
            </p>
            <div className="mt-2">
              <ProfitBadge profit={profitSi} invested={totalInvested} />
              <p className="text-muted-foreground mt-1 text-xs">{t('rateCards.rateSiDesc')}</p>
            </div>
          </div>
          <div className="bg-accent/12 text-accent border-accent/20 grid size-10 shrink-0 place-items-center rounded-md border transition-colors duration-200">
            <TbPercentage className="size-5.5" />
          </div>
        </div>
      </Card>

      {/* Rate lẻ */}
      <Card className="text-foreground h-full border border-amber-500/20 bg-amber-500/5 p-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
                {t('rateCards.rateLe')}
              </p>
              <TooltipProvider>
                <Tooltip
                  content={<span>{t('rateCards.rateLeTooltip')}</span>}
                  side="top"
                  align="start"
                >
                  <span className="text-muted-foreground cursor-help opacity-60 transition-opacity hover:opacity-100">
                    <TbInfoCircle className="size-3.5" />
                  </span>
                </Tooltip>
              </TooltipProvider>
              <div className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rateLe}
                  onChange={(e) => setRateLe(Number(e.target.value) || 0)}
                  aria-label={t('rateCards.rateLeAriaLabel')}
                  className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-bold text-amber-500 outline-none dark:text-amber-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-muted-foreground text-xs">%</span>
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-amber-500 dark:text-amber-400">
              <CountUp to={valueLe} decimals={0} separator="." />₫
            </p>
            <div className="mt-2">
              <ProfitBadge profit={profitLe} invested={totalInvested} />
              <p className="text-muted-foreground mt-1 text-xs">{t('rateCards.rateLeDesc')}</p>
            </div>
          </div>
          <div className="text-amber-550 grid size-10 shrink-0 place-items-center rounded-md border border-amber-500/20 bg-amber-500/10 transition-colors duration-200 dark:text-amber-400">
            <TbShoppingBag className="size-5.5" />
          </div>
        </div>
      </Card>
    </>
  );
}
