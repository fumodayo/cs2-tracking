"use client";

import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { formatPercent } from "@/utils/format";

interface SellSelectedMetricsProps {
  metrics: {
    totalInvested: number;
    totalCurrentValue: number;
    profitAmount: number;
    profitPercent: number;
  };
  itemsCount: number;
  bulkLoading: boolean;
  onConfirmBulk: () => void;
  formatCurrency: (value: number) => string;
}

export function SellSelectedMetrics({
  metrics,
  itemsCount,
  bulkLoading,
  onConfirmBulk,
  formatCurrency,
}: SellSelectedMetricsProps) {
  return (
    <div className="flex shrink-0 flex-col justify-between gap-6 border-t border-stone-800/80 pt-4 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
      <div className="space-y-4">
        <h3 className="font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
          Thống kê phiên bán
        </h3>

        <div className="space-y-4.5 rounded-[5px] border border-stone-800 bg-gradient-to-b from-stone-950/60 to-stone-950/20 p-4.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
          {/* Total Invested */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] font-medium tracking-wider text-stone-500 uppercase">
              Tổng vốn thu hồi
            </span>
            <span className="font-mono text-sm font-bold text-stone-300">
              {formatCurrency(metrics.totalInvested)}
            </span>
          </div>

          {/* Total Current Value */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] font-medium tracking-wider text-stone-500 uppercase">
              Tổng tiền nhận về
            </span>
            <span className="font-mono text-sm font-extrabold text-stone-200">
              {formatCurrency(metrics.totalCurrentValue)}
            </span>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-stone-800/60" />

          {/* Realized Profit/Loss block */}
          <div
            className={`rounded-[5px] border p-4 transition-all duration-300 ${
              metrics.profitAmount >= 0
                ? "border-emerald-500/20 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.02)] hover:border-emerald-500/30"
                : "border-red-500/20 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.02)] hover:border-red-500/30"
            }`}
          >
            <span className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
              Ước tính Lãi/Lỗ ròng
            </span>
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {metrics.profitAmount >= 0 ? (
                  <div className="flex size-5 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <TrendingUp className="size-3" />
                  </div>
                ) : (
                  <div className="flex size-5 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
                    <TrendingDown className="size-3" />
                  </div>
                )}
                <span
                  className={`font-mono text-xl leading-none font-black tracking-tight ${metrics.profitAmount >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {metrics.profitAmount >= 0 ? "+" : ""}
                  {formatCurrency(metrics.profitAmount)}
                </span>
              </div>
              <div className="flex">
                <span
                  className={`rounded-[3px] border px-2 py-0.5 font-mono text-[10px] font-black shadow-sm ${
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

      {/* Action buttons */}
      <div className="mt-auto space-y-2">
        <Button
          onClick={onConfirmBulk}
          disabled={itemsCount === 0 || bulkLoading}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border-none bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 text-xs font-black tracking-widest text-stone-950 uppercase shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300 hover:from-blue-400 hover:to-blue-400 hover:shadow-[0_0_28px_rgba(245,158,11,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {bulkLoading ? (
            <Loader2 className="size-4 animate-spin text-stone-950" />
          ) : (
            <span className="flex items-center gap-1.5 font-mono">
              Bán tất cả đã chọn
            </span>
          )}
        </Button>
        <DialogClose asChild>
          <Button
            variant="ghost"
            disabled={bulkLoading}
            className="border-slate-850 h-9 w-full cursor-pointer rounded-[4px] border bg-slate-950/40 font-mono text-xs font-bold text-stone-400 transition-all hover:border-slate-800 hover:bg-slate-900/40 hover:text-stone-200"
          >
            Đóng cửa sổ
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}
