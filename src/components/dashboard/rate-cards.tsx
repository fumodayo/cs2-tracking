"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import type { PortfolioTableRow } from "@/components/portfolio/portfolio-table-model";
import { TbPercentage, TbShoppingBag, TbInfoCircle } from "react-icons/tb";
import { CountUp } from "@/components/ui/animation/count-up";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

type RateCardsProps = {
  rows: PortfolioTableRow[];
  totalInvested: number;
};

const RATE_ITEM_TYPES = new Set(["case", "sticker", "capsule"]);

const LS_KEY_RATE_SI = "cs2t_rateSi";
const LS_KEY_RATE_LE = "cs2t_rateLe";

function readRate(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) || fallback : fallback;
}

/**
 * Check if a skin row has a buff price override.
 * When buff price was set, currentPrice differs from steamPrice.
 */
function hasBuff(row: PortfolioTableRow): boolean {
  return (
    row.currentPrice !== null &&
    row.steamPrice !== null &&
    row.steamPrice !== undefined &&
    row.currentPrice !== row.steamPrice
  );
}

function computeRateValue(
  rows: PortfolioTableRow[],
  ratePercent: number,
): number {
  let total = 0;

  for (const r of rows) {
    const value = r.currentValue ?? r.investedValue;

    if (r.itemType === "skin") {
      // Skin with buff price → 100%, skin without buff → apply rate
      total += hasBuff(r) ? value : value * (ratePercent / 100);
    } else if (RATE_ITEM_TYPES.has(r.itemType)) {
      // Case, sticker, capsule → apply rate
      total += value * (ratePercent / 100);
    }
  }

  return total;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(v);

function ProfitBadge({
  profit,
  invested,
}: {
  profit: number;
  invested: number;
}) {
  const percent = invested > 0 ? (profit / invested) * 100 : 0;
  const isPositive = profit >= 0;

  return (
    <p
      className={`mt-1.5 text-sm font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}
    >
      {isPositive ? "+" : ""}
      {fmt(profit)} đ
      <span className="ml-1.5 text-xs opacity-70">
        ({isPositive ? "+" : ""}
        {percent.toFixed(1)}%)
      </span>
    </p>
  );
}

/**
 * Renders as a fragment — designed to be slotted into the SummaryCards grid.
 */
export function RateCards({ rows, totalInvested }: RateCardsProps) {
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
      <Card className="h-full border border-accent/24 bg-accent/8 p-4 text-foreground transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Rate sỉ (all)
              </p>
              <TooltipProvider>
                <Tooltip
                  content={
                    <span>
                      Giá trị quy đổi khi bán sỉ toàn bộ kho đồ. Áp dụng tỷ lệ chiết khấu cho hòm, capsule, sticker và skin thường. Skin có cài giá Buff được tính 100% giá Buff.
                    </span>
                  }
                  side="top"
                  align="start"
                >
                  <span className="cursor-help text-muted-foreground opacity-60 hover:opacity-100 transition-opacity">
                    <TbInfoCircle className="size-3.5" />
                  </span>
                </Tooltip>
              </TooltipProvider>
              <div className="flex items-center gap-1 rounded-md border border-accent/24 bg-accent/12 px-1.5 py-0.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rateSi}
                  onChange={(e) => setRateSi(Number(e.target.value) || 0)}
                  aria-label="Tỷ lệ chiết khấu sỉ"
                  className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-bold text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-accent">
              <CountUp to={valueSi} decimals={0} separator="." />
              ₫
            </p>
            <div className="mt-2">
              <ProfitBadge profit={profitSi} invested={totalInvested} />
              <p className="mt-1 text-xs text-muted-foreground">
                Giá bán khi bán sỉ toàn bộ
              </p>
            </div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent/12 text-accent border border-accent/20 transition-colors duration-200">
            <TbPercentage className="size-5.5" />
          </div>
        </div>
      </Card>

      {/* Rate lẻ */}
      <Card className="h-full border border-amber-500/20 bg-amber-500/5 p-4 text-foreground transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Rate lẻ
              </p>
              <TooltipProvider>
                <Tooltip
                  content={
                    <span>
                      Giá trị quy đổi khi bán lẻ. Áp dụng tỷ lệ chiết khấu lẻ cho hòm, capsule, sticker. Skin có cài giá Buff được tính 100% giá Buff.
                    </span>
                  }
                  side="top"
                  align="start"
                >
                  <span className="cursor-help text-muted-foreground opacity-60 hover:opacity-100 transition-opacity">
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
                  aria-label="Tỷ lệ chiết khấu lẻ"
                  className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-bold text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-amber-500 dark:text-amber-400">
              <CountUp to={valueLe} decimals={0} separator="." />
              ₫
            </p>
            <div className="mt-2">
              <ProfitBadge profit={profitLe} invested={totalInvested} />
              <p className="mt-1 text-xs text-muted-foreground">
                Giá bán khi bán lẻ từng hòm
              </p>
            </div>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-550 dark:text-amber-400 border border-amber-500/20 transition-colors duration-200">
            <TbShoppingBag className="size-5.5" />
          </div>
        </div>
      </Card>
    </>
  );
}
