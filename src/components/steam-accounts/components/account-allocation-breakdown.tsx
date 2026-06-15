"use client";

import React from "react";
import { TbUser } from "react-icons/tb";
import { PortfolioTableRow } from "@/components/portfolio";

interface AccountAllocationBreakdownProps {
  relatedRows: PortfolioTableRow[];
}

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

  if (combinedAccounts.length === 0) return null;

  const totalQuantity = combinedAccounts.reduce((acc, curr) => acc + curr.total, 0);

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
      <div className="space-y-2.5">
        {combinedAccounts.map((accStats) => {
          const percent = totalQuantity > 0 ? (accStats.total / totalQuantity) * 100 : 0;
          return (
            <div
              key={accStats.steamId64}
              className="group relative flex flex-col gap-2 rounded-xl border border-slate-800/40 bg-slate-950/20 p-3 transition duration-200 hover:border-slate-800 hover:bg-slate-900/10"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <TbUser className="size-3.5" />
                  </span>
                  <span className="truncate max-w-[12rem]">{accStats.name}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-extrabold text-slate-100">
                    {accStats.total}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    ({percent.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 w-full rounded-full bg-slate-900/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400/90 to-blue-500/90 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Badges Breakdown */}
              {(accStats.tradeable > 0 ||
                accStats.onMarket > 0 ||
                accStats.hold > 0 ||
                accStats.tradeProtected > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                    {accStats.tradeable > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 border border-emerald-500/20">
                        <span className="size-1 rounded-full bg-emerald-400" />
                        {accStats.tradeable} Tradeable
                      </span>
                    )}
                    {accStats.onMarket > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400 border border-amber-500/20">
                        <span className="size-1 rounded-full bg-amber-400" />
                        {accStats.onMarket} Market
                      </span>
                    )}
                    {accStats.hold > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400 border border-rose-500/20">
                        <span className="size-1 rounded-full bg-rose-400" />
                        {accStats.hold} Hold
                      </span>
                    )}
                    {accStats.tradeProtected > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400 border border-cyan-500/20">
                        <span className="size-1 rounded-full bg-cyan-400" />
                        {accStats.tradeProtected} Protected
                      </span>
                    )}
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
