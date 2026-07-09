import { useTranslation } from 'react-i18next';
import type { CharmInfo, StickerInfo } from '@/domain/pattern-info';
import { formatStickerWearPercent } from '@/utils/accessories';
import { proxySteamUrl } from '@/utils/url';

type SellSelectedAccessoryDetailsProps = {
  stickers: StickerInfo[];
  charms: CharmInfo[];
  accessoryPriceMap: Map<string, number>;
  formatCurrency: (value: number) => string;
};

export function SellSelectedAccessoryDetails({
  stickers,
  charms,
  accessoryPriceMap,
  formatCurrency,
}: SellSelectedAccessoryDetailsProps) {
  const { t } = useTranslation();
  const accessories = [...stickers, ...charms];

  if (accessories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 border-t border-stone-900 pt-2.5">
      <span className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
        {t('portfolio.stickersAndCharms', 'Sticker & Charm details')}
      </span>
      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {accessories.map((accessory, index) => {
          const wearPercent = 'wear' in accessory ? formatStickerWearPercent(accessory.wear) : null;
          const price = accessory.marketHashName
            ? accessoryPriceMap.get(accessory.marketHashName)
            : undefined;
          return (
            <div
              key={`detail-acc-${accessory.id ?? index}-${accessory.slot ?? index}`}
              className="border-stone-850 flex items-center justify-between gap-3 rounded-[2px] border bg-stone-950/40 p-2 text-[10px] shadow-inner"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded border border-stone-800 bg-stone-950 p-0.5">
                  {accessory.imageUrl ? (
                    <img
                      src={proxySteamUrl(accessory.imageUrl)}
                      alt={accessory.name}
                      className="size-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-4 rounded bg-stone-800" />
                  )}
                  {wearPercent ? (
                    <span className="absolute inset-x-0 bottom-0 bg-black/75 px-0.5 py-0.5 text-center text-[7px] leading-none font-bold text-white">
                      {wearPercent}
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span
                    className="truncate font-sans font-bold text-stone-200"
                    title={accessory.name}
                  >
                    {accessory.name}
                  </span>
                  <span className="font-mono text-[9px] text-stone-500">
                    {wearPercent
                      ? t('portfolio.remainingWearPercent', 'Remaining {{wear}}', {
                          wear: wearPercent,
                        })
                      : t('portfolio.remainingFullWear', 'Remaining 100%')}
                    {accessory.slot !== undefined ? ` - Slot ${accessory.slot + 1}` : ''}
                  </span>
                </div>
              </div>
              {price !== undefined && (
                <span className="shrink-0 rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 font-mono font-bold text-emerald-400">
                  {formatCurrency(price)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
