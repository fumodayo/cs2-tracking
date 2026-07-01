'use client';

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  ExternalLink,
  Gem,
  Percent,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { PatternInfo } from '@/domain/pattern-info';
import { formatVND } from '@/utils/format';
import { proxySteamUrl } from '@/utils/url';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateVi } from '@/utils/date';

type AccessoryPrice = {
  marketHashName: string;
  price: number;
};

type StickerCharmSectionProps = {
  patternInfo?: PatternInfo;
  skinPrice?: number | null;
  buyPrice?: number | null;
  savedStickerRate?: number;
  savedStickerBuyRate?: number;
  stickerBuyRate: string;
  stickerRate: string;
  stickerScanTotalPrice?: number;
  stickerScanPriceCapturedAt?: string;
  onStickerBuyRateChange: (value: string) => void;
  onStickerRateChange: (value: string) => void;
  onStickerFormulaTotalChange?: (value: number) => void;
  onStickerTotalPriceChange?: (value: number) => void;
  onCaptureScanSnapshot?: (value: number) => void;
  shouldApplyStickerTotal?: boolean;
  readOnly?: boolean;
};

export function StickerCharmSection({
  patternInfo,
  skinPrice,
  buyPrice,
  savedStickerRate = 0,
  savedStickerBuyRate = 0,
  stickerBuyRate,
  stickerRate,
  stickerScanTotalPrice,
  stickerScanPriceCapturedAt,
  onStickerBuyRateChange,
  onStickerRateChange,
  onStickerFormulaTotalChange,
  onStickerTotalPriceChange,
  onCaptureScanSnapshot,
  shouldApplyStickerTotal = false,
  readOnly = false,
}: StickerCharmSectionProps) {
  const { t } = useTranslation();
  const stickers = patternInfo?.stickers ?? [];
  const charms = patternInfo?.charms ?? [];
  const hasAccessories = stickers.length > 0 || charms.length > 0;
  const marketHashNames = useMemo(
    () =>
      Array.from(
        new Set(
          [...stickers, ...charms]
            .map((item) => item.marketHashName)
            .filter((name): name is string => Boolean(name))
        )
      ),
    [stickers, charms]
  );

  const pricesQuery = useQuery({
    queryKey: ['sticker-charm-prices', marketHashNames],
    queryFn: async () => {
      const res = await fetch('/api/inventory/sticker-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketHashNames }),
      });
      if (!res.ok) throw new Error('failedToFetchStickerPrices');
      const data = (await res.json()) as { results?: AccessoryPrice[] };
      return new Map((data.results ?? []).map((item) => [item.marketHashName, item.price]));
    },
    enabled: marketHashNames.length > 0,
    staleTime: 15 * 60 * 1000,
  });

  const priceMap = pricesQuery.data ?? new Map<string, number>();
  const currentAccessoryTotal = useMemo(
    () =>
      [...stickers, ...charms].reduce((sum, accessory) => {
        if (!accessory.marketHashName) return sum;
        return sum + (priceMap.get(accessory.marketHashName) ?? 0);
      }, 0),
    [charms, priceMap, stickers]
  );

  const safeStickerRate = parseRate(stickerRate);
  const safeStickerBuyRate = parseRate(stickerBuyRate);
  const scanAccessoryTotal = Math.max(0, stickerScanTotalPrice ?? 0);
  const hasScanSnapshot = scanAccessoryTotal > 0;
  const savedCurrentAddValue = Math.round(
    (currentAccessoryTotal * Math.max(0, savedStickerRate)) / 100
  );
  const currentAddedValue = Math.round((currentAccessoryTotal * safeStickerRate) / 100);
  const currentBaseSkinPrice = Math.max(0, (skinPrice ?? 0) - savedCurrentAddValue);
  const currentTotalPrice = currentBaseSkinPrice + currentAddedValue;
  const savedBuyAddValue = Math.round(
    (scanAccessoryTotal * Math.max(0, savedStickerBuyRate)) / 100
  );
  const buyAddedValue = Math.round((scanAccessoryTotal * safeStickerBuyRate) / 100);
  const buyBaseSkinPrice = Math.max(0, (buyPrice ?? 0) - savedBuyAddValue);
  const buyFormulaTotalPrice = buyBaseSkinPrice + buyAddedValue;
  const accessoryChange = hasScanSnapshot ? currentAccessoryTotal - scanAccessoryTotal : 0;
  const accessoryChangePercent =
    hasScanSnapshot && scanAccessoryTotal > 0 ? (accessoryChange / scanAccessoryTotal) * 100 : null;

  useEffect(() => {
    if (!hasScanSnapshot) return;
    onStickerFormulaTotalChange?.(buyFormulaTotalPrice);
  }, [buyFormulaTotalPrice, hasScanSnapshot, onStickerFormulaTotalChange]);

  useEffect(() => {
    if (!shouldApplyStickerTotal || !hasScanSnapshot) return;
    onStickerTotalPriceChange?.(buyFormulaTotalPrice);
  }, [buyFormulaTotalPrice, hasScanSnapshot, onStickerTotalPriceChange, shouldApplyStickerTotal]);

  if (!hasAccessories && !patternInfo?.isSouvenir) {
    return null;
  }

  return (
    <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold tracking-wide text-stone-500">
          {t('portfolio.stickerCharmTitle')}
        </div>
        {patternInfo?.isSouvenir ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
            <ShieldCheck className="size-3" />
            Souvenir
          </span>
        ) : null}
      </div>

      {hasAccessories ? (
        readOnly ? (
          <div className="rounded-lg border border-stone-800/70 bg-stone-950/40 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-300">
              <span>{t('portfolio.stickerCharmMarket', 'Giá thị trường Sticker/Charm')}</span>
              <span className="font-mono text-sm font-extrabold text-emerald-400">
                {formatVND(currentAccessoryTotal)}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-stone-800/70 bg-stone-950/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="rounded-md border border-emerald-500/15 bg-emerald-500/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[9px] font-bold tracking-wide text-emerald-400">
                  {t('portfolio.currentPriceTitle')}
                </div>
                {hasScanSnapshot ? (
                  <ChangeBadge amount={accessoryChange} percent={accessoryChangePercent} />
                ) : null}
              </div>
              <ValueLine label={t('portfolio.stickerCharmMarket')} value={currentAccessoryTotal} />
              <RateField
                label={t('portfolio.percentSellingValuation')}
                value={stickerRate}
                onChange={onStickerRateChange}
              />
              <ValueLine
                label={t('portfolio.addToCurrentPrice')}
                value={currentAddedValue}
                tone="emerald"
              />
              <ValueLine
                label={t('portfolio.estimatedValue')}
                value={currentTotalPrice}
                tone="emerald"
              />
            </div>

            {hasScanSnapshot ? (
              <div className="rounded-md border border-amber-500/15 bg-amber-500/5 p-2.5">
                <div className="text-[9px] font-bold tracking-wide text-amber-400">
                  {t('portfolio.purchaseValuationTitle', 'Định giá lúc mua')}
                </div>
                <ValueLine
                  label={t('portfolio.stickerCharmScanPrice', 'Giá Sticker lúc Scan')}
                  value={scanAccessoryTotal}
                  tone="amber"
                />
                <RateField
                  label={t('portfolio.percentIntoCapital')}
                  value={stickerBuyRate}
                  onChange={onStickerBuyRateChange}
                />
                <ValueLine label={t('portfolio.addToCapital')} value={buyAddedValue} tone="amber" />
                <ValueLine
                  label={t('portfolio.suggestedCost')}
                  value={buyFormulaTotalPrice}
                  tone="amber"
                />
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {stickers.length > 0 ? (
        <div className="grid gap-2">
          {stickers.map((sticker, index) => (
            <AccessoryRow
              key={`sticker-${sticker.id ?? index}-${sticker.slot ?? index}`}
              imageUrl={sticker.imageUrl}
              icon={<Badge className="size-3.5" />}
              name={sticker.name}
              meta={[
                sticker.slot !== undefined ? `Slot ${sticker.slot + 1}` : null,
                sticker.wear !== undefined
                  ? t('portfolio.scratched', {
                      percent: (
                        100 - Math.round(Math.max(0, Math.min(1, sticker.wear)) * 100)
                      ).toFixed(0),
                    })
                  : null,
              ]}
              price={sticker.marketHashName ? priceMap.get(sticker.marketHashName) : undefined}
              marketHashName={sticker.marketHashName}
            />
          ))}
        </div>
      ) : null}

      {charms.length > 0 ? (
        <div className="grid gap-2">
          {charms.map((charm, index) => (
            <AccessoryRow
              key={`charm-${charm.id ?? index}-${charm.slot ?? index}`}
              imageUrl={charm.imageUrl}
              icon={<Gem className="size-3.5" />}
              name={charm.name}
              meta={[
                charm.slot !== undefined ? `Slot ${charm.slot + 1}` : null,
                charm.pattern !== undefined ? `Pattern ${charm.pattern}` : null,
              ]}
              price={charm.marketHashName ? priceMap.get(charm.marketHashName) : undefined}
              marketHashName={charm.marketHashName}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function parseRate(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function RateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-2 grid grid-cols-[1fr_4.75rem] items-center gap-2">
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500">
        <Percent className="size-3" />
        {label}
      </span>
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 border-stone-800 bg-stone-950 px-2 text-right text-[11px] font-bold text-stone-100 focus:border-emerald-500/60 focus:ring-emerald-500/15"
      />
    </label>
  );
}

function ValueLine({
  label,
  value,
  tone = 'stone',
}: {
  label: string;
  value: number | null;
  tone?: 'stone' | 'amber' | 'emerald';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : 'text-stone-300';

  return (
    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold text-stone-500">
      <span>{label}</span>
      <span className={`font-mono text-[11px] font-extrabold ${toneClass}`}>
        {value !== null ? formatVND(value) : '--'}
      </span>
    </div>
  );
}

function ChangeBadge({ amount, percent }: { amount: number; percent: number | null }) {
  const isUp = amount >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${
        isUp
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/20 bg-red-500/10 text-red-300'
      }`}
    >
      <Icon className="size-3" />
      {isUp ? '+' : ''}
      {percent !== null ? `${percent.toFixed(0)}%` : formatVND(amount)}
    </span>
  );
}

function AccessoryRow({
  imageUrl,
  icon,
  name,
  meta,
  price,
  marketHashName,
}: {
  imageUrl?: string;
  icon: ReactNode;
  name: string;
  meta: Array<string | null>;
  price?: number;
  marketHashName?: string;
}) {
  const cleanMeta = meta.filter((value): value is string => Boolean(value));
  const marketUrl = marketHashName
    ? `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`
    : undefined;
  const content = (
    <>
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-800 bg-stone-950 text-stone-400 transition-all duration-200 group-hover:border-emerald-500/30 group-hover:bg-stone-900">
        {imageUrl ? (
          <img
            src={proxySteamUrl(imageUrl)}
            alt=""
            className="size-full object-contain transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          icon
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="group-hover:text-foreground truncate text-[11px] font-bold text-stone-200 transition-colors duration-200">
          {name}
        </div>
        {cleanMeta.length > 0 ? (
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-semibold text-stone-500">
            {cleanMeta.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        ) : null}
      </div>
      {price !== undefined && price > 0 ? (
        <div className="shrink-0 text-right text-[10px] font-bold text-emerald-400">
          {formatVND(price)}
        </div>
      ) : null}
      {marketUrl ? (
        <ExternalLink className="size-3 shrink-0 text-stone-600 opacity-0 transition-all duration-200 group-hover:text-emerald-400 group-hover:opacity-100" />
      ) : null}
    </>
  );

  return marketUrl ? (
    <a
      href={marketUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative flex items-center gap-3 overflow-hidden rounded-lg border border-stone-800/60 bg-stone-950/30 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:bg-stone-900/60 hover:shadow-[0_10px_24px_rgba(16,185,129,0.08)]"
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-emerald-400/0 transition-colors duration-200 group-hover:bg-emerald-400/70" />
      {content}
    </a>
  ) : (
    <div className="group flex items-center gap-3 rounded-lg border border-stone-800/60 bg-stone-950/30 px-3 py-2.5 transition-all duration-200 hover:border-stone-700 hover:bg-stone-900/40">
      {content}
    </div>
  );
}
