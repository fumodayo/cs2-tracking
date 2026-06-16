"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { formatPercent } from "@/utils/format";

interface SellSelectedMetricsProps {
  metrics: {
    totalInvested: number;
    totalCurrentValue: number;
    profitAmount: number;
    profitPercent: number;
  };
  formatCurrency: (value: number) => string;
}

export function SellSelectedMetrics({
  metrics,
  formatCurrency,
}: SellSelectedMetricsProps) {
  return (
    <div className="flex shrink-0 flex-col justify-between gap-6 border-t border-stone-800/80 pt-4 lg:col-span-4 xl:col-span-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
      <div className="space-y-4">
        <h3 className="font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
          Thống kê phiên bán
        </h3>

        <div className="space-y-4.5 rounded-[5px] border border-stone-800 bg-gradient-to-b from-stone-950/60 to-stone-950/20 p-4.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
          {/* Total Invested */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-min break-words font-mono text-[10px] font-medium leading-tight tracking-wider text-stone-500 uppercase">
              Tổng vốn thu hồi
            </span>
            <span className="font-mono text-lg font-bold text-stone-100">
              {formatCurrency(metrics.totalInvested)}
            </span>
          </div>

          {/* Total Current Value */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-min break-words font-mono text-[10px] font-medium leading-tight tracking-wider text-stone-500 uppercase">
              Tổng tiền nhận về
            </span>
            <span className="font-mono text-lg font-extrabold text-stone-100">
              {formatCurrency(metrics.totalCurrentValue)}
            </span>
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-stone-800/60" />

          {/* Realized Profit/Loss block */}
          <div
            className={`rounded-[5px] border p-5 transition-all duration-300 ${
              metrics.profitAmount >= 0
                ? "border-emerald-500/20 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.02)] hover:border-emerald-500/30"
                : "border-red-500/20 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.02)] hover:border-red-500/30"
            }`}
          >
            <span className="block w-32 font-mono text-[9px] font-bold leading-normal tracking-widest text-stone-500 uppercase">
              Ước tính Lãi/Lỗ ròng
            </span>
            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                {metrics.profitAmount >= 0 ? (
                  <div className="flex size-6 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <TrendingUp className="size-3.5" />
                  </div>
                ) : (
                  <div className="flex size-6 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                    <TrendingDown className="size-3.5" />
                  </div>
                )}
                <span
                  className={`font-mono text-3xl leading-none font-black tracking-tighter ${metrics.profitAmount >= 0 ? "text-emerald-400" : "text-red-500"}`}
                >
                  {metrics.profitAmount >= 0 ? "+" : ""}
                  {formatCurrency(metrics.profitAmount).replace(/\s*[đ₫]/g, "").trim()}
                </span>
              </div>
              <div className="flex">
                <span
                  className={`rounded-[3px] border px-2.5 py-1 font-mono text-[10px] font-black shadow-sm ${
                    metrics.profitAmount >= 0
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.05)]"
                      : "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.05)]"
                  }`}
                >
                  {metrics.profitPercent >= 0 ? "+" : ""}
                  {formatPercent(metrics.profitPercent)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
