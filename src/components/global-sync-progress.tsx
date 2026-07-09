'use client';

import { useSyncStore } from '@/stores';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function GlobalSyncProgress() {
  const { isSyncing, syncOverallPercent, syncOverallMessage, singleScanId } = useSyncStore();
  const pathname = usePathname();

  const active = isSyncing || singleScanId !== null;
  if (!active) return null;

  // Không hiện popup toàn cục ngay trên trang portfolio vì trang này đã có tiến độ inline.
  const isPortfolioPage = pathname === '/portfolio' || pathname.startsWith('/portfolio/');
  if (isPortfolioPage) return null;

  return (
    <div className="border-border bg-card/90 shadow-soft shadow-accent/10 animate-fade-slide-in fixed bottom-4 left-4 z-50 w-80 rounded-xl border p-4 backdrop-blur-md">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-foreground flex min-w-0 flex-1 items-center gap-2 text-sm">
            <Loader2 className="text-accent size-4 shrink-0 animate-spin" />
            <span className="truncate text-xs font-semibold">{syncOverallMessage}</span>
          </div>
          <span className="text-accent shrink-0 text-xs font-bold">
            {Math.round(syncOverallPercent)}%
          </span>
        </div>
        <div className="bg-surface-muted/20 h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, syncOverallPercent))}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
