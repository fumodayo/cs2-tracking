import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { FaCoins, FaSteam } from 'react-icons/fa';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/utils/cn';
import type { InspectPatternResult } from './hooks/use-pattern-inspect';
import type { ScanResultItem } from './types';
import { formatPlainNumber, getSteamMarketListingUrl } from './utils';

type InventoryScannerPriceCellProps = {
  item: ScanResultItem;
  t: TFunction;
  buffPricesCny: Record<string, number>;
  buffPriceErrors: Record<string, string>;
  buffCnyToVndRate: number;
  mergedRawItems?: ScanResultItem[];
  patternResults: Record<string, InspectPatternResult>;
  isMobile: boolean;
  renderVND: (value: number | null | undefined) => ReactNode;
};

export function InventoryScannerPriceCell({
  item,
  t,
  buffPricesCny,
  buffPriceErrors,
  buffCnyToVndRate,
  mergedRawItems,
  patternResults,
  isMobile,
  renderVND,
}: InventoryScannerPriceCellProps) {
  const buyPriceSection =
    item.isManual && item.buyPrice && item.buyPrice > 0 ? (
      <span className="font-sans text-[10px] font-medium text-blue-400/90">
        {t('inventoryScanner.buyPriceLabel')}
        {renderVND(item.buyPrice)}
      </span>
    ) : null;

  if (item.type !== 'Skin') {
    const steamMarketUrl =
      item.steamMarketUrl ?? getSteamMarketListingUrl(item.caseItem.marketHashName);
    return (
      <div className="flex min-h-[3rem] flex-col items-end justify-center text-right font-mono">
        <a
          href={steamMarketUrl}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-1.5 transition-colors hover:text-blue-300"
        >
          <span className="text-[13px] font-medium text-stone-300 group-hover:text-stone-200">
            {renderVND(item.price)}
          </span>
          {!isMobile && (
            <FaSteam className="size-3.5 text-stone-500 transition-colors group-hover:text-sky-400" />
          )}
        </a>
        {buyPriceSection}
      </div>
    );
  }

  const marketHashName = item.caseItem.marketHashName;
  const overpayInfo = patternResults[marketHashName]?.overpay;
  const buffPriceCny = item.buffPriceCny ?? buffPricesCny[marketHashName];
  const rawItem = mergedRawItems?.find((raw) => raw.caseItem.marketHashName === marketHashName);
  const steamPrice = rawItem?.price ?? item.price ?? 0;
  const hasBuffPrice = Number.isFinite(buffPriceCny) && buffPriceCny > 0;
  const buffError = buffPriceErrors[marketHashName];
  const steamMarketUrl = item.steamMarketUrl ?? getSteamMarketListingUrl(marketHashName);
  const buffMarketUrl = `https://buff.market/market/all?search=${marketHashName}`;
  const displayedBuffCny = overpayInfo ? overpayInfo.estimatedTypical : buffPriceCny;

  return (
    <div className="flex min-h-[3rem] w-full flex-col items-end justify-center gap-1 py-1">
      <Tooltip content={t('inventoryScanner.steamPriceTooltip')}>
        <a
          href={steamMarketUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative flex cursor-help items-center gap-1.5 transition-colors hover:text-blue-300"
        >
          <span className="group-hover:text-stone-250 font-mono text-[13px] font-medium text-stone-300">
            {renderVND(steamPrice)}
          </span>
          {!isMobile && (
            <FaSteam className="size-3.5 text-stone-500 transition-colors group-hover:text-sky-400" />
          )}
        </a>
      </Tooltip>

      {hasBuffPrice && (
        <Tooltip
          content={
            <>
              {overpayInfo
                ? `${t('inventoryScanner.buffPriceTooltip', {
                    price: formatPlainNumber(buffPriceCny),
                    rate: formatPlainNumber(buffCnyToVndRate),
                  })} + Overpay (${overpayInfo.multiplierSource})`
                : t('inventoryScanner.buffPriceTooltip', {
                    price: formatPlainNumber(buffPriceCny),
                    rate: formatPlainNumber(buffCnyToVndRate),
                  })}
            </>
          }
        >
          <a
            href={buffMarketUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'group relative flex cursor-help transition-colors hover:text-blue-300',
              isMobile ? 'flex-col items-end gap-0.5' : 'items-center gap-1.5'
            )}
          >
            <span
              className={cn(
                'text-right font-mono font-medium',
                overpayInfo ? 'text-emerald-400' : 'text-blue-400',
                isMobile
                  ? 'flex flex-col items-end text-[11px]'
                  : 'text-[13px] group-hover:underline'
              )}
            >
              <span>{renderVND(Math.round(displayedBuffCny * buffCnyToVndRate))}</span>
              {isMobile ? (
                <span className="flex flex-col items-end font-sans text-[9px] leading-tight font-normal text-stone-500">
                  <span>&yen;{formatPlainNumber(displayedBuffCny)}</span>
                  <span>x {formatPlainNumber(buffCnyToVndRate)}</span>
                </span>
              ) : (
                <span className="ml-1 font-sans text-[10px] font-normal text-stone-500">
                  {`(\u00a5${formatPlainNumber(displayedBuffCny)} x ${formatPlainNumber(buffCnyToVndRate)})`}
                </span>
              )}
            </span>
            {!isMobile && (
              <FaCoins
                className={cn(
                  'transition-transform group-hover:scale-110',
                  overpayInfo ? 'text-emerald-400' : 'text-blue-400',
                  'size-3.5'
                )}
              />
            )}
          </a>
        </Tooltip>
      )}
      {buyPriceSection}
      {buffError ? (
        <span className="text-red-350 mt-1 max-w-44 text-right font-sans text-[11px]">
          {buffError}
        </span>
      ) : null}
    </div>
  );
}
