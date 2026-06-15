"use client";

import { Check, FolderPlus, Loader2, LogIn, RefreshCw } from "lucide-react";
import type { ScanResultItem } from "../types";

interface PortfolioSyncSectionProps {
  user: { email: string } | null;
  googleConfigured: boolean;
  importInventoryToPortfolio: () => void;
  portfolioImporting: boolean;
  portfolioImportStatus: string | null;
  portfolioImportMessage: string | null;
  portfolioImportError: string | null;
  hasItemsToImport: boolean;
  zeroPricedItems: ScanResultItem[];
  retryingPrices: boolean;
  retryStatus: string | null;
}

export function PortfolioSyncSection({
  user,
  googleConfigured,
  importInventoryToPortfolio,
  portfolioImporting,
  portfolioImportStatus,
  portfolioImportMessage,
  portfolioImportError,
  hasItemsToImport,
  zeroPricedItems,
  retryingPrices,
  retryStatus,
}: PortfolioSyncSectionProps) {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden flex flex-col gap-4 rounded-xl border border-blue-500/15 bg-gradient-to-r from-blue-950/15 to-stone-900/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between shadow-md transition-all duration-300 hover:border-blue-500/25">
        <div className="absolute -right-6 -top-6 -z-10 h-20 w-20 rounded-full bg-blue-500/5 blur-xl pointer-events-none" />
        <div>
          <p className="text-sm font-bold text-stone-200">
            Bạn muốn theo dõi giá đồ của mình tăng giảm theo ngày?
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {user
              ? `Đang lưu portfolio cá nhân cho ${user.email}.`
              : "Hãy đăng nhập bằng Gmail ngay để đưa kết quả inventory-scanner vào portfolio riêng."}
          </p>
        </div>
        {user ? (
          <button
            type="button"
            onClick={importInventoryToPortfolio}
            disabled={portfolioImporting || !hasItemsToImport}
            className="shrink-0 inline-flex h-9.5 items-center justify-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover px-4 text-xs font-bold text-accent-foreground disabled:opacity-40 cursor-pointer focus:outline-none transition-all duration-200 active:scale-95 shadow-[0_4px_12px_rgba(59,130,246,0.15)]"
          >
            {portfolioImporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FolderPlus className="size-3.5" />
            )}
            <span>Lưu vào portfolio</span>
          </button>
        ) : (
          <a
            href="/api/auth/google"
            aria-disabled={!googleConfigured}
            className={`inline-flex h-9.5 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold transition-all duration-200 active:scale-95 ${
              googleConfigured
                ? "bg-accent text-accent-foreground hover:bg-accent-hover cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.15)]"
                : "pointer-events-none border border-stone-850 bg-stone-900/10 text-stone-500"
            }`}
          >
            <LogIn className="size-3.5" />
            <span>{googleConfigured ? "Đăng nhập Gmail" : "Thiếu Google OAuth"}</span>
          </a>
        )}
      </div>

      {portfolioImporting && portfolioImportStatus
        ? (() => {
            const percentMatch = portfolioImportStatus.match(/^\[(\d+)%\]\s*/);
            const percent = percentMatch ? parseInt(percentMatch[1], 10) : 0;
            const message = percentMatch
              ? portfolioImportStatus.slice(percentMatch[0].length)
              : portfolioImportStatus;
            return (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5 text-blue-300">
                    <Loader2 className="size-4 shrink-0 animate-spin text-blue-400" />
                    <span className="truncate">{message}</span>
                  </div>
                  {percentMatch ? (
                    <span className="ml-3 shrink-0 text-xs font-bold text-blue-400 tabular-nums">
                      {percent}%
                    </span>
                  ) : null}
                </div>
                {percentMatch ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-900/30">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all duration-500 ease-out"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })()
        : null}

      {portfolioImportMessage ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-100">
          {portfolioImportMessage}
        </div>
      ) : null}

      {portfolioImportError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {portfolioImportError}
        </div>
      ) : null}

      {zeroPricedItems.length > 0 || retryStatus ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 px-5 py-3.5 text-sm">
          {retryingPrices ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-blue-300" />
          ) : zeroPricedItems.length === 0 ? (
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          ) : (
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-blue-300" />
          )}
          <div className="min-w-0 flex-1">
            {zeroPricedItems.length > 0 ? (
              <p className="font-semibold text-blue-100">
                {zeroPricedItems.length} item 0đ &mdash;{" "}
                <span className="font-normal text-stone-300">
                  {retryingPrices ? "đang tự động lấy giá..." : "sẽ tự động retry..."}
                </span>
              </p>
            ) : null}
            {retryStatus ? (
              <p
                className={`mt-0.5 text-xs ${
                  zeroPricedItems.length === 0 ? "font-semibold text-emerald-300" : "text-stone-400"
                }`}
              >
                {retryStatus}
              </p>
            ) : null}
            {zeroPricedItems.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {zeroPricedItems.slice(0, 10).map((item) => (
                  <span
                    key={item.caseItem.id}
                    className="inline-flex items-center rounded border border-stone-700/50 bg-stone-900/80 px-2 py-0.5 text-xs font-medium text-blue-200"
                  >
                    {item.caseItem.name}
                  </span>
                ))}
                {zeroPricedItems.length > 10 && (
                  <span className="inline-flex items-center rounded border border-stone-700/50 bg-stone-900/80 px-2 py-0.5 text-xs font-medium text-stone-400">
                    + {zeroPricedItems.length - 10} item khác...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
