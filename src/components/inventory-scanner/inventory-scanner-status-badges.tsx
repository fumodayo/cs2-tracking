import type { TFunction } from 'i18next';

import {
  BlueGemBadge,
  DopplerBadge,
  FadeBadge,
  MarbleFadeBadge,
} from '@/components/shared/pattern-badge';
import type { PatternInfo } from '@/domain/pattern-info';

import type { ScanResultItem } from './types';

type ScannerItemStatusBreakdown = {
  tradeable: number;
  onMarket: number;
  tradeProtected: number;
  hold: number;
};

function getScannerItemStatusBreakdown(item: ScanResultItem): ScannerItemStatusBreakdown {
  const consolidated = {
    tradeable: 0,
    onMarket: 0,
    tradeProtected: 0,
    hold: 0,
  };

  let hasBreakdown = false;
  for (const account of item.sourceAccounts ?? []) {
    if (!account.breakdown) continue;

    hasBreakdown = true;
    consolidated.tradeable += account.breakdown.tradeable ?? 0;
    consolidated.onMarket += account.breakdown.onMarket ?? 0;
    consolidated.tradeProtected += account.breakdown.tradeProtected ?? 0;
    consolidated.hold += account.breakdown.hold ?? 0;
  }

  if (!hasBreakdown) {
    if (item.holdDays && item.holdDays > 0) {
      consolidated.hold = item.quantity;
    } else {
      consolidated.tradeable = item.quantity;
    }
  }

  return consolidated;
}

type InventoryScannerStatusBadgesProps = {
  item: ScanResultItem;
  patternInfo?: PatternInfo;
  dopplerPhase?: string;
  t: TFunction;
};

export function InventoryScannerStatusBadges({
  item,
  patternInfo,
  dopplerPhase,
  t,
}: InventoryScannerStatusBadgesProps) {
  const fadePercentage = patternInfo?.fadePercentage;
  const blueGemTier = patternInfo?.blueGemTier;
  const marbleFadeTier = patternInfo?.marbleFadeTier;
  const breakdown = item.quantity > 1 ? getScannerItemStatusBreakdown(item) : null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {dopplerPhase && <DopplerBadge phase={dopplerPhase} />}
      {fadePercentage !== undefined && <FadeBadge percentage={fadePercentage} />}
      {blueGemTier && blueGemTier !== 'Normal' && <BlueGemBadge tier={blueGemTier} />}
      {marbleFadeTier && marbleFadeTier !== 'Normal' && <MarbleFadeBadge tier={marbleFadeTier} />}
      {item.onMarket ? (
        <span className="inline-flex items-center rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          Market
        </span>
      ) : null}
      {item.tradeProtected ? (
        <span className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
          Trade Protected
        </span>
      ) : null}
      {item.holdDays && item.holdDays > 0 ? (
        <span className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
          {t('inventoryScanner.holdDaysCount', { count: item.holdDays })}
        </span>
      ) : null}
      {item.storageUnitQuantity && item.storageUnitQuantity > 0 ? (
        <span className="inline-flex items-center rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          🔒 {item.storageUnitQuantity} {t('portfolio.inStorageUnit', 'trong Storage Unit')}
        </span>
      ) : null}
      {breakdown ? (
        <>
          {breakdown.tradeable > 0 && breakdown.tradeable !== item.quantity ? (
            <span
              aria-label={t('portfolio.tradeableStatusWithQty', '{{count}} tradeable items', {
                count: breakdown.tradeable,
              })}
              className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400"
            >
              🟢 {breakdown.tradeable}
            </span>
          ) : null}
          {breakdown.onMarket > 0 ? (
            <span
              aria-label={t('portfolio.onMarketStatusWithQty', '{{count}} items on market', {
                count: breakdown.onMarket,
              })}
              className="inline-flex items-center rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
            >
              🟡 {breakdown.onMarket} Market
            </span>
          ) : null}
          {breakdown.tradeProtected > 0 ? (
            <span
              aria-label={t(
                'portfolio.tradeProtectedStatusWithQty',
                '{{count}} trade-protected items',
                { count: breakdown.tradeProtected }
              )}
              className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400"
            >
              🔵 {breakdown.tradeProtected} Protected
            </span>
          ) : null}
          {breakdown.hold > 0 && breakdown.hold !== item.quantity ? (
            <span
              aria-label={t('portfolio.holdStatusWithQty', '{{count}} items on hold', {
                count: breakdown.hold,
              })}
              className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400"
            >
              🔴 {breakdown.hold} Hold
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
