import { Pencil, Trash2 } from 'lucide-react';
import { TbCalendar, TbCircleCheck, TbPackage, TbShield, TbTag, TbUser } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/components/currency-provider';
import { formatDateVi } from '@/utils/date';
import type { PortfolioTableRow } from '../portfolio-table-model';
import { AccessoryPreviewStrip } from './accessory-preview-strip';
import { TradeHoldBadge } from './trade-hold-badge';

type ItemLotSummaryProps = {
  lot: PortfolioTableRow;
  lotIndex: number;
  storageUnitName?: string;
  onEdit: (lot: PortfolioTableRow) => void;
  onDelete?: (lot: PortfolioTableRow) => void;
};

export function ItemLotSummary({
  lot,
  lotIndex,
  storageUnitName,
  onEdit,
  onDelete,
}: ItemLotSummaryProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const formattedDate = lot.buyDate
    ? formatDateVi(lot.buyDate)
    : t('common.unknownDate', 'Unknown date');

  const stickers = lot.patternInfo?.stickers ?? [];
  const charms = lot.patternInfo?.charms ?? [];
  const hasAccessories = stickers.length + charms.length > 0;
  const shouldShowAccessoryLine = lot.itemType === 'skin' || hasAccessories;
  const patternBadges = [
    lot.patternInfo?.floatValue !== undefined
      ? `${t('inventoryScanner.floatValue', 'Float')}: ${lot.patternInfo.floatValue.toFixed(8)}`
      : null,
    lot.patternInfo?.paintSeed !== undefined
      ? `${t('inventoryScanner.paintSeed', 'Paint Seed')}: ${lot.patternInfo.paintSeed}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const isProtected = Boolean(
    lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
    lot.sourceAccounts[0].breakdown.tradeProtected > 0
  );

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border border-stone-800/70 bg-stone-950/70 px-1 text-[10px] font-extrabold text-stone-300"
            title={t('portfolio.itemInstanceNumber', 'Item #{{number}}', {
              number: lotIndex + 1,
            })}
          >
            #{lotIndex + 1}
          </span>
          <span className="text-sm font-extrabold text-stone-100">{lot.quantity}</span>
          <span className="mr-1.5 text-[10px] font-semibold text-stone-400">
            {t('portfolio.itemsUnit', 'items')}
          </span>
          <span className="text-[10px] font-semibold text-stone-500">@</span>
          <span className="text-sm font-extrabold text-emerald-400">
            {formatCurrency(lot.buyPrice)}
          </span>
          <span className="mx-1 text-stone-700">&middot;</span>
          {isProtected ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400">
              <TbShield className="size-2.5" />
              Protected
            </span>
          ) : lot.tradeHoldUntil ? (
            <TradeHoldBadge tradeHoldUntil={lot.tradeHoldUntil} size="sm" />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
              <TbCircleCheck className="size-2.5" />
              {t('portfolio.statusTradeable', 'Tradeable')}
            </span>
          )}
        </div>
        {shouldShowAccessoryLine ? (
          <div className="mt-2">
            <AccessoryPreviewStrip
              stickers={stickers}
              charms={charms}
              maxVisible={5}
              showNames
              emptyLabel={t('portfolio.noStickerCharm', 'No sticker/charm')}
            />
          </div>
        ) : null}
        {patternBadges.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {patternBadges.map((label) => (
              <span
                key={label}
                className="inline-flex rounded border border-violet-500/15 bg-violet-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
          <span className="inline-flex items-center gap-1 rounded border border-stone-800/30 bg-stone-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-stone-400">
            <TbCalendar className="size-3 text-stone-500" /> {formattedDate}
          </span>
          {lot.sourceAccounts && lot.sourceAccounts.length > 0 && (
            <>
              {lot.sourceAccounts.map((account) => (
                <span
                  key={account.steamId64}
                  className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded border border-sky-500/10 bg-sky-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400"
                  title={account.name}
                >
                  <TbUser className="size-2.5 shrink-0 text-sky-400" />
                  <span className="truncate">{account.name}</span>
                </span>
              ))}
            </>
          )}
          {storageUnitName && (
            <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded border border-amber-500/10 bg-amber-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
              <TbPackage className="size-2.5 text-amber-400" /> {storageUnitName}
            </span>
          )}
          {lot.note && !lot.note.toLowerCase().includes('scanner') && (
            <span
              className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400"
              title={lot.note}
            >
              <TbTag className="size-2.5 text-emerald-400" /> {lot.note}
            </span>
          )}
        </div>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          onClick={() => onEdit(lot)}
          className="hover:border-stone-750 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-stone-800/80 bg-stone-950/40 p-0 text-stone-400 transition-all hover:bg-stone-900/50 hover:text-stone-200"
          title={t('portfolio.editLotTitle', 'Edit this lot')}
        >
          <Pencil className="size-3" />
        </Button>
        {onDelete && (
          <Button
            type="button"
            onClick={() => onDelete(lot)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-stone-800/80 bg-stone-950/40 p-0 text-stone-400 transition-all hover:border-rose-900/40 hover:bg-rose-950/30 hover:text-rose-400"
            title={t('portfolio.deleteLotTitle', 'Delete this lot')}
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
