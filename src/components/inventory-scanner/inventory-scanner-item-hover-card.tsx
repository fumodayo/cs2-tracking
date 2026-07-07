import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';

import {
  BlueGemBadge,
  DopplerBadge,
  FadeBadge,
  MarbleFadeBadge,
} from '@/components/shared/pattern-badge';
import type { PatternInfo } from '@/domain/pattern-info';

import type { InspectPatternResult } from './hooks/use-pattern-inspect';
import { HoverCardAccessorySection } from './inventory-scanner-accessories';
import type { ScanResultItem } from './types';
import { formatVND } from './utils';

type InventoryScannerItemHoverCardContentProps = {
  item: ScanResultItem;
  patternInfo?: PatternInfo;
  dopplerPhase?: string;
  overpayInfo: InspectPatternResult['overpay'];
  buffCnyToVndRate: number;
  t: TFunction;
};

function getAccountStatusBreakdown(item: ScanResultItem) {
  const breakdown = {
    tradeable: 0,
    onMarket: 0,
    tradeProtected: 0,
    hold: 0,
  };

  for (const account of item.sourceAccounts ?? []) {
    if (!account.breakdown) continue;

    breakdown.tradeable += account.breakdown.tradeable ?? 0;
    breakdown.onMarket += account.breakdown.onMarket ?? 0;
    breakdown.tradeProtected += account.breakdown.tradeProtected ?? 0;
    breakdown.hold += account.breakdown.hold ?? 0;
  }

  return breakdown;
}

export function InventoryScannerItemHoverCardContent({
  item,
  patternInfo,
  dopplerPhase,
  overpayInfo,
  buffCnyToVndRate,
  t,
}: InventoryScannerItemHoverCardContentProps) {
  const consolidated = getAccountStatusBreakdown(item);
  const fadePercentage = patternInfo?.fadePercentage;
  const blueGemTier = patternInfo?.blueGemTier;
  const marbleFadeTier = patternInfo?.marbleFadeTier;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.25, 0.25, 0, 1] }}
      className="w-80 rounded-xl border border-stone-800 bg-stone-950 p-4 text-stone-100 shadow-[0_12px_36px_rgba(0,0,0,0.15)] backdrop-blur-md dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)]"
    >
      <div className="mb-3 flex items-center justify-between border-b border-stone-800/80 pb-2.5">
        <div className="text-accent max-w-[14rem] truncate text-xs font-bold">
          {item.caseItem.name}
        </div>
        <span className="text-[10px] font-medium text-stone-500">
          {t('inventoryScanner.totalItems', { count: item.quantity })}
        </span>
      </div>

      <div className="mb-3 space-y-2 border-b border-stone-800/80 pb-3 text-xs">
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          {t('inventoryScanner.statusBreakdown')}
        </div>
        {consolidated.tradeable > 0 && (
          <div className="flex items-center justify-between text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>{t('inventoryScanner.tradeableNow')}</span>
            </span>
            <span className="font-bold text-emerald-400">{consolidated.tradeable}</span>
          </div>
        )}
        {consolidated.onMarket > 0 && (
          <div className="flex items-center justify-between text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-400" />
              <span>{t('inventoryScanner.onMarketNow')}</span>
            </span>
            <span className="font-bold text-amber-400">{consolidated.onMarket}</span>
          </div>
        )}
        {consolidated.tradeProtected > 0 && (
          <div className="flex items-center justify-between text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-cyan-400" />
              <span>Trade Protected</span>
            </span>
            <span className="font-bold text-cyan-400">{consolidated.tradeProtected}</span>
          </div>
        )}
        {consolidated.hold > 0 && (
          <div className="flex items-center justify-between text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
              <span>{t('inventoryScanner.holdTrade')}</span>
            </span>
            <span className="font-bold text-red-400">{consolidated.hold}</span>
          </div>
        )}
      </div>

      {patternInfo && (
        <div className="mb-3 space-y-2 border-b border-stone-800/80 pb-3 text-xs">
          <div className="mb-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
            {t('inventoryScanner.patternInfo')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dopplerPhase && <DopplerBadge phase={dopplerPhase} />}
            {fadePercentage !== undefined && <FadeBadge percentage={fadePercentage} />}
            {blueGemTier && blueGemTier !== 'Normal' && <BlueGemBadge tier={blueGemTier} />}
            {marbleFadeTier && marbleFadeTier !== 'Normal' && (
              <MarbleFadeBadge tier={marbleFadeTier} />
            )}
          </div>
          {patternInfo.paintSeed !== undefined && (
            <div className="flex justify-between text-stone-300">
              <span>{t('inventoryScanner.paintSeed')}</span>
              <span className="font-semibold text-stone-100">{patternInfo.paintSeed}</span>
            </div>
          )}
          {patternInfo.floatValue !== undefined && (
            <div className="flex justify-between text-stone-300">
              <span>{t('inventoryScanner.floatValue')}</span>
              <span className="font-semibold text-stone-100">
                {patternInfo.floatValue.toFixed(8)}
              </span>
            </div>
          )}
          {overpayInfo && (
            <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
              <div className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
                {t('inventoryScanner.overpayEstimate')} ({overpayInfo.multiplierSource})
              </div>
              <div className="mt-1 flex justify-between text-[11px] font-semibold">
                <span>BUFF + Overpay:</span>
                <span className="font-mono">
                  {formatVND(Math.round(overpayInfo.estimatedTypical * buffCnyToVndRate))}{' '}
                  <span className="font-sans text-[10px] font-normal text-stone-400">
                    ({new Intl.NumberFormat('vi-VN').format(overpayInfo.estimatedTypical)} x{' '}
                    {new Intl.NumberFormat('vi-VN').format(buffCnyToVndRate)})
                  </span>
                </span>
              </div>
              <div className="mt-1 text-[9px] text-stone-400">
                {t('inventoryScanner.overpayDisclaimer')}
              </div>
            </div>
          )}
        </div>
      )}

      {patternInfo && (patternInfo.stickers?.length || patternInfo.charms?.length) ? (
        <HoverCardAccessorySection patternInfo={patternInfo} t={t} />
      ) : null}

      <div className="max-h-48 space-y-2.5 overflow-y-auto pr-1 text-xs">
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          {t('inventoryScanner.detailsByAccount')}
        </div>
        {(item.sourceAccounts ?? []).map((account) => {
          const accHold = account.breakdown?.hold ?? 0;
          const accMarket = account.breakdown?.onMarket ?? 0;
          const accProtected = account.breakdown?.tradeProtected ?? 0;
          const accTradeable = account.breakdown?.tradeable ?? 0;

          return (
            <div
              key={account.steamId64}
              className="border-stone-850 rounded border bg-stone-900/40 p-2"
            >
              <div className="text-accent mb-1.5 flex justify-between text-[11px] font-semibold">
                <span className="max-w-[12rem] truncate">{account.name}</span>
                <span>x{account.quantity}</span>
              </div>
              <div className="space-y-1 text-[10px] text-stone-200">
                {accTradeable > 0 && (
                  <div className="flex justify-between">
                    <span>{t('inventoryScanner.tradeableLabel')}</span>
                    <span className="font-semibold text-emerald-400">{accTradeable}</span>
                  </div>
                )}
                {accMarket > 0 && (
                  <div className="flex justify-between">
                    <span>{t('inventoryScanner.onMarketLabel')}</span>
                    <span className="font-semibold text-amber-400">{accMarket}</span>
                  </div>
                )}
                {accProtected > 0 && (
                  <div className="flex justify-between">
                    <span>{t('inventoryScanner.tradeProtectedLabel')}</span>
                    <span className="font-semibold text-cyan-400">{accProtected}</span>
                  </div>
                )}
                {accHold > 0 && (
                  <div className="flex justify-between">
                    <span>{t('inventoryScanner.holdTradeLabel')}</span>
                    <span className="font-semibold text-red-400">{accHold}</span>
                  </div>
                )}
                {account.breakdown?.holdDetails && account.breakdown.holdDetails.length > 0 && (
                  <div className="border-stone-850 mt-1.5 space-y-0.5 border-t pt-1 text-[9px] text-stone-400">
                    {account.breakdown.holdDetails.map((detail, detailIndex) => (
                      <div key={detailIndex} className="flex justify-between">
                        <span>• Qty: {detail.quantity}</span>
                        <span>
                          {t('inventoryScanner.holdDaysValue', {
                            count: detail.holdDays,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
