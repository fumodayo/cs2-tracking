import type { TFunction } from 'i18next';

import type { PatternInfo } from '@/domain/pattern-info';
import { estimateOverpay } from '@/services/pattern/overpay-calculator';
import { formatVND } from '@/utils/format';

type PatternInfoDetailsProps = {
  patternInfo: PatternInfo;
  marketHashName: string;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  t: TFunction;
};

export function PatternInfoDetails({
  patternInfo,
  marketHashName,
  buffPricesCny,
  buffCnyToVndRate,
  t,
}: PatternInfoDetailsProps) {
  const buffPriceCny = buffPricesCny?.[marketHashName];
  const overpay =
    buffPriceCny && buffCnyToVndRate ? estimateOverpay(patternInfo, buffPriceCny) : null;

  return (
    <div className="grid gap-2">
      {patternInfo.paintSeed !== undefined && (
        <div className="flex justify-between text-stone-300">
          <span>{t('inventoryScanner.paintSeed', 'Paint Seed')}</span>
          <span className="font-semibold text-stone-100">{patternInfo.paintSeed}</span>
        </div>
      )}
      {patternInfo.floatValue !== undefined && (
        <div className="flex justify-between text-stone-300">
          <span>{t('inventoryScanner.floatValue', 'Float Value')}</span>
          <span className="font-semibold text-stone-100">{patternInfo.floatValue.toFixed(8)}</span>
        </div>
      )}
      {overpay && buffCnyToVndRate ? (
        <div className="text-emerald-450 mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
            {t('inventoryScanner.overpayEstimate', 'Uoc tinh Overpay')} ({overpay.multiplierSource})
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-semibold">
            <span>BUFF + Overpay:</span>
            <span className="font-mono">
              {formatVND(Math.round(overpay.estimatedTypical * buffCnyToVndRate))}{' '}
              <span className="font-sans text-[10px] font-normal text-stone-400">
                ({new Intl.NumberFormat('vi-VN').format(overpay.estimatedTypical)} x{' '}
                {new Intl.NumberFormat('vi-VN').format(buffCnyToVndRate)})
              </span>
            </span>
          </div>
          <div className="mt-1 text-[9px] text-stone-400">
            {t(
              'inventoryScanner.overpayDisclaimer',
              'Gia tri chi mang tinh chat tham khao dua tren pattern.'
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
