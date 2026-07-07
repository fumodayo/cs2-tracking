'use client';

import type { TFunction } from 'i18next';
import { Badge, Sparkles } from 'lucide-react';

import type { CharmInfo, PatternInfo, StickerInfo } from '@/domain/pattern-info';
import { useAccessoryPrices } from '@/hooks/use-accessory-prices';
import { formatStickerWearPercent, getAccessoryTotalPrice } from '@/utils/accessories';
import { cn } from '@/utils/cn';
import { proxySteamUrl } from '@/utils/url';

import { formatVND } from './utils';

type AccessoryKind = 'sticker' | 'charm';
type ScannerAccessoryPreview = (StickerInfo | CharmInfo) & {
  wear?: number;
};

export function AccessoryPricePreviewStrip({
  accessories,
  kind,
  t,
  isMobile = false,
}: {
  accessories: ScannerAccessoryPreview[];
  kind: AccessoryKind;
  t?: TFunction;
  isMobile?: boolean;
}) {
  const { priceMap, totalPrice } = useAccessoryPrices(accessories);
  const isSticker = kind === 'sticker';
  const tileClass = isSticker ? 'border-stone-700/70' : 'border-amber-700/40';
  const totalTitle = isSticker
    ? 'Total sticker value (Steam Market)'
    : 'Total charm value (Steam Market)';

  return (
    <div className={cn('inline-flex items-center gap-1.5', isMobile ? 'h-5' : 'h-9')}>
      <div className={cn('inline-flex items-center gap-0.5', isMobile ? 'h-5' : 'h-9')}>
        {accessories.map((accessory, index) => {
          const wearPercent = isSticker ? formatStickerWearPercent(accessory.wear) : null;
          const intact =
            isSticker && accessory.wear !== undefined && Number.isFinite(accessory.wear)
              ? 100 - Math.round(Math.max(0, Math.min(1, accessory.wear)) * 100)
              : null;
          const accessoryPrice = accessory.marketHashName
            ? priceMap.get(accessory.marketHashName)
            : undefined;
          const titleParts = [
            accessory.name,
            accessoryPrice ? `Price: ${formatVND(accessoryPrice)}` : null,
            isSticker && wearPercent
              ? t?.('inventoryScanner.stickerCondition', '{{percent}} intact', {
                  percent: wearPercent,
                })
              : null,
            accessory.slot !== undefined ? `Slot ${accessory.slot + 1}` : null,
          ].filter(Boolean);

          return (
            <span
              key={`${kind}-${accessory.id ?? index}-${accessory.slot ?? index}`}
              className={cn(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded border bg-stone-950 shadow-sm',
                tileClass,
                isMobile ? 'size-5' : 'size-9'
              )}
              title={titleParts.join(' - ')}
            >
              {accessory.imageUrl ? (
                <img
                  src={proxySteamUrl(accessory.imageUrl)}
                  alt={accessory.name}
                  className="size-full object-contain p-0.5"
                  loading="lazy"
                />
              ) : isSticker ? (
                <Badge className="size-4 text-stone-500" />
              ) : (
                <Sparkles className="size-4 text-amber-500/60" />
              )}
              {wearPercent ? (
                <span
                  className={cn(
                    'absolute inset-x-0 bottom-0 bg-black/70 px-0.5 text-center font-black text-white shadow-[0_-1px_4px_rgba(0,0,0,0.5)]',
                    isMobile
                      ? 'origin-bottom scale-[0.8] text-[6px] leading-[8px]'
                      : 'text-[8px] leading-3'
                  )}
                >
                  {isMobile ? intact : wearPercent}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {totalPrice > 0 && !isMobile && (
        <span
          className="rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/10"
          title={totalTitle}
        >
          +{formatVND(totalPrice)}
        </span>
      )}
    </div>
  );
}

export function HoverCardAccessorySection({
  patternInfo,
  t,
}: {
  patternInfo?: PatternInfo;
  t: TFunction;
}) {
  const stickers = patternInfo?.stickers ?? [];
  const charms = patternInfo?.charms ?? [];
  const hasAccessories = stickers.length > 0 || charms.length > 0;
  const { priceMap } = useAccessoryPrices(stickers, charms);
  const totalStickerPrice = getAccessoryTotalPrice(stickers, priceMap);
  const totalCharmPrice = getAccessoryTotalPrice(charms, priceMap);

  const totalAccessoryPrice = totalStickerPrice + totalCharmPrice;

  if (!hasAccessories) return null;

  return (
    <div className="mb-3 space-y-2.5 border-b border-stone-800/80 pb-3 text-xs">
      <HoverCardAccessoryList
        accessories={stickers}
        kind="sticker"
        label={t('inventoryScanner.stickersLabel', 'Stickers')}
        priceMap={priceMap}
        totalPrice={totalStickerPrice}
        t={t}
      />

      <HoverCardAccessoryList
        accessories={charms}
        kind="charm"
        label={t('inventoryScanner.charmsLabel', 'Charms')}
        headerClassName="mt-2"
        priceMap={priceMap}
        totalPrice={totalCharmPrice}
        t={t}
      />

      {totalAccessoryPrice > 0 && (
        <div className="flex items-center justify-between border-t border-stone-800/50 pt-2 text-[10px] font-semibold text-stone-400">
          <span>{t('inventoryScanner.accessoryTotalLabel', 'Total Sticker/Charm Value:')}</span>
          <span className="font-mono text-[11px] font-extrabold text-emerald-400">
            {formatVND(totalAccessoryPrice)}
          </span>
        </div>
      )}
    </div>
  );
}

function HoverCardAccessoryList({
  accessories,
  kind,
  label,
  headerClassName,
  priceMap,
  totalPrice,
  t,
}: {
  accessories: ScannerAccessoryPreview[];
  kind: AccessoryKind;
  label: string;
  headerClassName?: string;
  priceMap: Map<string, number>;
  totalPrice: number;
  t: TFunction;
}) {
  if (accessories.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          'mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-stone-500 uppercase',
          headerClassName
        )}
      >
        <span>{label}</span>
        {totalPrice > 0 && (
          <span className="font-mono text-[10px] font-bold text-emerald-400">
            {formatVND(totalPrice)}
          </span>
        )}
      </div>
      <div className="grid gap-1.5">
        {accessories.map((accessory, index) => (
          <HoverCardAccessoryRow
            key={`hc-${kind}-${accessory.id ?? index}-${accessory.slot ?? index}`}
            accessory={accessory}
            kind={kind}
            price={accessory.marketHashName ? priceMap.get(accessory.marketHashName) : undefined}
            t={t}
          />
        ))}
      </div>
    </>
  );
}

function HoverCardAccessoryRow({
  accessory,
  kind,
  price,
  t,
}: {
  accessory: ScannerAccessoryPreview;
  kind: AccessoryKind;
  price?: number;
  t: TFunction;
}) {
  const isSticker = kind === 'sticker';
  const wearPercent = isSticker ? formatStickerWearPercent(accessory.wear) : null;

  return (
    <div className="flex items-center justify-between gap-1.5 rounded border border-stone-800/60 bg-stone-900/40 px-2 py-1.5 transition-colors hover:bg-stone-900/80">
      <div className="flex min-w-0 items-center gap-1.5">
        {accessory.imageUrl ? (
          <img
            src={proxySteamUrl(accessory.imageUrl)}
            alt={accessory.name}
            className="size-7 shrink-0 object-contain"
            loading="lazy"
          />
        ) : isSticker ? (
          <Badge className="size-4 shrink-0 text-stone-500" />
        ) : (
          <Sparkles className="size-4 shrink-0 text-stone-500" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate pr-1 text-[10px] font-medium text-stone-200">
            {accessory.name}
          </span>
          {wearPercent && (
            <span className="text-[9px] font-bold text-stone-400">
              {t('inventoryScanner.stickerCondition', '{{percent}} intact', {
                percent: wearPercent,
              })}
            </span>
          )}
        </div>
      </div>
      {price !== undefined && price > 0 && (
        <span className="shrink-0 rounded border border-emerald-500/10 bg-emerald-500/5 px-1 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
          {formatVND(price)}
        </span>
      )}
    </div>
  );
}
