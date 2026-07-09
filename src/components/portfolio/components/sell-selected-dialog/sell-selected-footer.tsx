'use client';

import { Loader2, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SellSelectedFooterProps {
  bulkLoading: boolean;
  itemsCount: number;
  metrics: {
    totalInvested: number;
    totalCurrentValue: number;
    profitAmount: number;
    profitPercent: number;
  };
  formatCurrency: (value: number) => string;
  onConfirmBulk: () => void;
}

export function SellSelectedFooter({
  bulkLoading,
  itemsCount,
  metrics,
  formatCurrency,
  onConfirmBulk,
}: SellSelectedFooterProps) {
  const { t } = useTranslation();

  if (itemsCount === 0) return null;

  return (
    <div className="bg-card/95 absolute right-3 bottom-3 left-3 z-10 flex items-center justify-between gap-4 rounded-[2px] border border-stone-800 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-6">
        {/* Chỉ số tổng giá trị hiện tại */}
        <div className="flex flex-col">
          <span className="font-mono text-[9px] font-bold tracking-wider text-stone-500">
            {t('portfolio.netReceived', 'Net Received')}
          </span>
          <span className="mt-0.5 font-mono text-base font-extrabold text-stone-100">
            {formatCurrency(metrics.totalCurrentValue)}
          </span>
        </div>

        {/* Đường phân cách dọc */}
        <div className="border-stone-850 h-8 border-l" />

        {/* Chỉ số lãi/lỗ ròng */}
        <div className="flex flex-col">
          <span className="font-mono text-[9px] font-bold tracking-wider text-stone-500">
            {t('portfolio.estimatedProfitLoss', 'Estimated Profit/Loss')}
          </span>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={`font-mono text-base font-black tracking-tight ${
                metrics.profitAmount >= 0 ? 'text-emerald-400' : 'text-rose-500'
              }`}
            >
              {metrics.profitAmount >= 0 ? '+' : ''}
              {formatCurrency(metrics.profitAmount)
                .replace(/\s*[đ₫]/g, '')
                .trim()}
            </span>
            <span
              className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] font-black ${
                metrics.profitAmount >= 0
                  ? 'bg-emerald-955/20 text-emerald-450 border-emerald-500/20'
                  : 'bg-rose-955/20 text-rose-450 border-rose-500/20'
              }`}
            >
              {metrics.profitPercent >= 0 ? '+' : ''}
              {metrics.profitPercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Button Sell All */}
      <button
        onClick={onConfirmBulk}
        disabled={bulkLoading}
        className="pointer-events-auto flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[2px] border border-blue-500/30 bg-gradient-to-r from-blue-700 to-blue-600 px-6 text-white shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all duration-300 hover:from-blue-600 hover:to-blue-500 hover:shadow-[0_4px_25px_rgba(37,99,235,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {bulkLoading ? (
          <Loader2 className="size-4 animate-spin text-white" />
        ) : (
          <>
            <ShoppingBag className="size-3.5 fill-white/20 text-white" />
            <span className="font-sans text-[11px] font-extrabold tracking-wider text-white">
              {t('portfolio.confirmSell', 'Confirm Sell')}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
