"use client";

import { useSyncStore } from "@/stores";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function GlobalSyncProgress() {
  const { isSyncing, syncOverallPercent, syncOverallMessage, singleScanId } =
    useSyncStore();
  const pathname = usePathname();

  const active = isSyncing || singleScanId !== null;
  if (!active) return null;

  // Don't show the global popup on the portfolio page itself, as it has inline progress
  const isPortfolioPage =
    pathname === "/portfolio" || pathname.startsWith("/portfolio/");
  if (isPortfolioPage) return null;

  return (
    <div className="fixed left-4 bottom-4 z-50 w-80 rounded-xl border border-border bg-card/90 p-4 shadow-soft shadow-accent/10 backdrop-blur-md animate-fade-slide-in">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
            <span className="truncate text-xs font-semibold">
              {syncOverallMessage}
            </span>
          </div>
          <span className="shrink-0 text-xs font-bold text-accent">
            {Math.round(syncOverallPercent)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted/20">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, syncOverallPercent))}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
