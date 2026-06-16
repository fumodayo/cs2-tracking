"use client";

import React from "react";
import { TbUser } from "react-icons/tb";
import { PortfolioTableRow } from "@/components/portfolio";

interface AccountAllocationBreakdownProps {
  relatedRows: PortfolioTableRow[];
}

const PALETTES = [
  { barColor: "#38bdf8", bgClass: "bg-sky-500/5", borderClass: "border-sky-500/10" },
  { barColor: "#34d399", bgClass: "bg-emerald-500/5", borderClass: "border-emerald-500/10" },
  { barColor: "#fbbf24", bgClass: "bg-amber-500/5", borderClass: "border-amber-500/10" },
  { barColor: "#f87171", bgClass: "bg-rose-500/5", borderClass: "border-rose-500/10" },
  { barColor: "#2dd4bf", bgClass: "bg-teal-500/5", borderClass: "border-teal-500/10" },
  { barColor: "#fb923c", bgClass: "bg-orange-500/5", borderClass: "border-orange-500/10" },
  { barColor: "#a1a1aa", bgClass: "bg-zinc-500/5", borderClass: "border-zinc-500/10" },
];

export function AccountAllocationBreakdown({
  relatedRows,
}: AccountAllocationBreakdownProps) {
  const combinedAccounts = React.useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        steamId64: string;
        total: number;
        tradeable: number;
        onMarket: number;
        tradeProtected: number;
        hold: number;
      }
    >();

    for (const r of relatedRows) {
      for (const acc of r.sourceAccounts) {
        const existing = map.get(acc.steamId64) || {
          name: acc.name,
          steamId64: acc.steamId64,
          total: 0,
          tradeable: 0,
          onMarket: 0,
          tradeProtected: 0,
          hold: 0,
        };

        if (acc.breakdown) {
          existing.total += acc.breakdown.tradeable ?? 0;
          existing.total += acc.breakdown.onMarket ?? 0;
          existing.total += acc.breakdown.tradeProtected ?? 0;
          existing.total += acc.breakdown.hold ?? 0;

          existing.tradeable += acc.breakdown.tradeable ?? 0;
          existing.onMarket += acc.breakdown.onMarket ?? 0;
          existing.tradeProtected += acc.breakdown.tradeProtected ?? 0;
          existing.hold += acc.breakdown.hold ?? 0;
        } else {
          const qty = r.quantity;
          existing.total += qty;

          const holdDays = (() => {
            if (!r.tradeHoldUntil) return 0;
            const parsedHoldUntil = new Date(r.tradeHoldUntil);
            if (isNaN(parsedHoldUntil.getTime())) return 0;
            const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            return Math.max(0, diffDays);
          })();

          if (holdDays > 0) {
            existing.hold += qty;
          } else {
            existing.tradeable += qty;
          }
        }

        map.set(acc.steamId64, existing);
      }
    }

    return Array.from(map.values()).filter((a) => a.total > 0);
  }, [relatedRows]);

  const totalQuantity = React.useMemo(() => {
    return combinedAccounts.reduce((acc, curr) => acc + curr.total, 0);
  }, [combinedAccounts]);

  const slices = React.useMemo(() => {
    let accumulatedPercent = 0;
    const R = 35;
    const C = 2 * Math.PI * R; // ~219.911

    return combinedAccounts.map((accStats, idx) => {
      const percent = totalQuantity > 0 ? (accStats.total / totalQuantity) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * C} ${C}`;
      const strokeDashoffset = - (accumulatedPercent / 100) * C;
      accumulatedPercent += percent;

      const palette = PALETTES[idx % PALETTES.length];

      return {
        ...accStats,
        percent,
        strokeDasharray,
        strokeDashoffset,
        palette,
      };
    });
  }, [combinedAccounts, totalQuantity]);

  if (combinedAccounts.length <= 1) return null;

  return (
    <div className="mb-5 space-y-3 border-b border-slate-800/60 pb-5">
      <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-500 uppercase">
        <span className="flex items-center gap-1.5">
          <TbUser className="size-3.5 text-slate-400" />
          Phân bổ tài khoản
        </span>
        <span className="rounded-full bg-slate-800/50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-slate-300">
          {totalQuantity} tổng
        </span>
      </div>

      <div className="flex items-center gap-5 rounded-xl border border-slate-850 bg-slate-950/20 p-3">
        {/* SVG Donut Chart */}
        <div className="relative flex size-20 shrink-0 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 100 100">
            {/* Background track circle */}
            <circle
              cx="50"
              cy="50"
              r="35"
              className="fill-transparent stroke-slate-900/60"
              strokeWidth="9"
            />
            {slices.map((slice) => (
              <circle
                key={slice.steamId64}
                cx="50"
                cy="50"
                r="35"
                className="fill-transparent transition-all duration-500"
                style={{
                  stroke: slice.palette.barColor,
                  strokeWidth: 9,
                  strokeDasharray: slice.strokeDasharray,
                  strokeDashoffset: slice.strokeDashoffset,
                }}
              />
            ))}
          </svg>
          {/* Inner Total count */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-sm font-extrabold text-slate-100 leading-none">
              {totalQuantity}
            </span>
            <span className="text-[7.5px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
              tổng
            </span>
          </div>
        </div>

        {/* Legend list on the right */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {slices.map((slice) => (
            <div
              key={slice.steamId64}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.palette.barColor }}
                />
                <span className="font-bold text-slate-300 truncate" title={slice.name}>
                  {slice.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-slate-400 font-medium">
                <span className="text-slate-100 font-bold">{slice.total}</span>
                <span>({slice.percent.toFixed(0)}%)</span>
                
                {/* Breakdown badges */}
                <div className="flex items-center gap-0.5 ml-1">
                  {slice.tradeable > 0 && (
                    <span className="text-[8px] font-extrabold text-emerald-450 text-emerald-400/80" title={`${slice.tradeable} Tradeable`}>
                      {slice.tradeable}T
                    </span>
                  )}
                  {slice.hold > 0 && (
                    <span className="text-[8px] font-extrabold text-rose-450 text-rose-400/80" title={`${slice.hold} Hold`}>
                      {slice.hold}H
                    </span>
                  )}
                  {slice.tradeProtected > 0 && (
                    <span className="text-[8px] font-extrabold text-cyan-450 text-cyan-400/80" title={`${slice.tradeProtected} Protected`}>
                      {slice.tradeProtected}P
                    </span>
                  )}
                  {slice.onMarket > 0 && (
                    <span className="text-[8px] font-extrabold text-amber-450 text-amber-400/80" title={`${slice.onMarket} Market`}>
                      {slice.onMarket}M
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
