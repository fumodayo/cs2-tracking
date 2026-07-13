import { type ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Loader2 } from 'lucide-react';
import { FaSyncAlt, FaSearch } from 'react-icons/fa';
import * as HoverCard from '@radix-ui/react-hover-card';

import { DataTableColumnHeader } from '@/components/ui/actions';
import { formatRelative } from '@/utils/date';
import { CaseThumbnail } from '@/components/portfolio';
import type { ScanResultItem } from './types';
import type { InspectPatternResult } from './hooks/use-pattern-inspect';
import { AccessoryPricePreviewStrip } from './inventory-scanner-accessories';
import { InventoryScannerItemHoverCardContent } from './inventory-scanner-item-hover-card';
import { InventoryScannerItemTitle } from './inventory-scanner-item-title';
import { InventoryScannerManualQuantityCell } from './inventory-scanner-manual-quantity-cell';
import { InventoryScannerPriceCell } from './inventory-scanner-price-cell';
import { InventoryScannerStatusBadges } from './inventory-scanner-status-badges';
import { getSteamMarketListingUrl, getItemTypeColor } from './utils';

export type BuildInventoryColumnsParams = {
  t: TFunction;
  buffLoadingKeys: Set<string>;
  buffPricesCny: Record<string, number>;
  buffPriceErrors: Record<string, string>;
  fetchBuffPrice: (marketHashName: string) => void;
  updateBuffPriceCny: (marketHashName: string, rawValue: string) => void;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  updateManualItemQty?: (id: string, qty: number) => void;
  mergedRawItems?: ScanResultItem[];
  inspectingKeys: Set<string>;
  patternResults: Record<string, InspectPatternResult>;
  inspectPattern: (inspectLink: string, marketHashName: string, dopplerPhase?: string) => void;
  mode: 'case-summary' | 'transactions';
  onSelectItem?: (item: ScanResultItem) => void;
  isMobile?: boolean;
};

export function buildInventoryColumns({
  t,
  buffLoadingKeys,
  buffPricesCny,
  buffPriceErrors,
  fetchBuffPrice,
  updateBuffPriceCny,
  buffCnyToVndRate,
  rateAll,
  rateLe,
  updateManualItemQty,
  mergedRawItems,
  inspectingKeys,
  patternResults,
  inspectPattern,
  mode,
  isMobile = false,
}: BuildInventoryColumnsParams): ColumnDef<ScanResultItem>[] {
  const renderVND = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '--';
    }
    const formattedNumber = new Intl.NumberFormat('vi-VN').format(Math.round(value));
    return (
      <>
        {formattedNumber}
        <span className="ml-0.5 font-sans text-[10px] font-normal text-stone-500 select-none">
          đ
        </span>
      </>
    );
  };

  return [
    {
      id: 'case',
      enableHiding: false,
      header: t('inventoryScanner.item'),
      accessorFn: (row) => row.caseItem.name,
      cell: ({ row }) => {
        const isSkin = row.original.type === 'Skin';
        const marketHashName = row.original.caseItem.marketHashName;
        const isWeaponOrKnifeOrGlove =
          isSkin &&
          (/Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred/i.test(marketHashName) ||
            marketHashName.startsWith('★'));
        const isLoadingBuff = buffLoadingKeys.has(marketHashName);
        const patternInfo = row.original.patternInfo ?? patternResults[marketHashName]?.patternInfo;
        const dopplerPhase = row.original.dopplerPhase ?? patternInfo?.dopplerPhase;
        const overpayInfo = patternResults[marketHashName]?.overpay;
        const buffPriceCny = row.original.buffPriceCny ?? buffPricesCny[marketHashName];
        const hasBuffPrice = Number.isFinite(buffPriceCny) && buffPriceCny > 0;
        const rawItem = mergedRawItems?.find((i) => i.caseItem.marketHashName === marketHashName);
        const steamPrice = rawItem?.price ?? row.original.price ?? 0;
        const steamMarketUrl =
          row.original.steamMarketUrl ?? getSteamMarketListingUrl(marketHashName);
        const buffMarketUrl = `https://buff.market/market/all?search=${marketHashName}`;
        const content = (
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                row.toggleSelected(!row.getIsSelected());
              }}
              className="group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-stone-800 bg-stone-900 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg focus:outline-none active:scale-95 max-md:size-14"
              title={t('inventoryScanner.clickToSelect', 'Click to select')}
            >
              <CaseThumbnail
                imageUrl={row.original.caseItem.imageUrl ?? undefined}
                name={row.original.caseItem.name}
                size="lg"
                className="max-md:size-14"
              />
              {row.getIsSelected() && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 backdrop-blur-[1px]">
                  <div className="flex size-6 items-center justify-center rounded-full bg-blue-500 shadow-md">
                    <svg
                      className="size-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
              <span
                className="absolute inset-x-0 bottom-0 h-1"
                style={{
                  backgroundColor:
                    row.original.type === 'Capsule' || row.original.type === 'Case'
                      ? '#b0c3d9'
                      : (row.original.rarity?.color ?? getItemTypeColor(row.original.type)),
                }}
              />
            </button>
            <div className="min-w-0">
              <InventoryScannerItemTitle
                item={row.original}
                marketHashName={marketHashName}
                steamMarketUrl={steamMarketUrl}
                buffMarketUrl={buffMarketUrl}
                t={t}
              />
              <InventoryScannerStatusBadges
                item={row.original}
                patternInfo={patternInfo}
                dopplerPhase={dopplerPhase}
                t={t}
              />
              {row.original.sourceAccounts && row.original.sourceAccounts.length > 0 ? (
                <div
                  className="mt-1 flex max-w-[28rem] flex-wrap gap-1 max-md:hidden"
                  title={row.original.sourceAccounts.map((account) => account.name).join(', ')}
                >
                  {row.original.sourceAccounts.slice(0, 3).map((account) => (
                    <span
                      key={account.steamId64}
                      className="inline-flex max-w-40 items-center truncate rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                    >
                      <span className="truncate">{account.name}</span>
                    </span>
                  ))}
                  {row.original.sourceAccounts.length > 3 ? (
                    <span className="border-border bg-surface-muted text-muted-foreground inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium">
                      +{row.original.sourceAccounts.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {/* Sticker & Charm preview strip */}
              {mode === 'transactions' &&
                (() => {
                  const stickers = patternInfo?.stickers ?? [];
                  const charms = patternInfo?.charms ?? [];
                  if (stickers.length === 0 && charms.length === 0) return null;
                  return (
                    <div className="mt-1.5 flex items-center gap-2">
                      {stickers.length > 0 && (
                        <AccessoryPricePreviewStrip
                          accessories={stickers}
                          kind="sticker"
                          t={t}
                          isMobile={isMobile}
                        />
                      )}
                      {charms.length > 0 && (
                        <AccessoryPricePreviewStrip
                          accessories={charms}
                          kind="charm"
                          isMobile={isMobile}
                        />
                      )}
                    </div>
                  );
                })()}
              {row.original.isManual && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500 max-md:hidden">
                  {row.original.buyPrice && (
                    <span className="font-medium text-blue-400/90">
                      {t('inventoryScanner.buyPriceLabel')}
                      {renderVND(row.original.buyPrice)}
                    </span>
                  )}
                  {row.original.buyDate && (
                    <span>
                      {t('inventoryScanner.dateLabel')}
                      {row.original.buyDate.split('-').reverse().join('/')}
                    </span>
                  )}
                  {row.original.sourceAccounts && row.original.sourceAccounts.length > 0 && (
                    <span
                      className="max-w-[12rem] truncate"
                      title={row.original.sourceAccounts[0].name}
                    >
                      {t('inventoryScanner.accountLabelShort')}
                      {row.original.sourceAccounts[0].name}
                    </span>
                  )}
                  {row.original.storageUnitId && (
                    <span className="rounded border border-blue-500/25 bg-blue-500/10 px-1.5 text-[10px] font-medium tracking-wide text-stone-400 uppercase">
                      {row.original.storageUnitName || 'Storage Unit'}
                    </span>
                  )}
                </div>
              )}
              {isSkin && !hasBuffPrice && steamPrice > 5000 && (
                <button
                  type="button"
                  onClick={() => fetchBuffPrice(marketHashName)}
                  disabled={isLoadingBuff}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 transition-colors select-none hover:text-blue-300 hover:underline disabled:cursor-wait max-md:hidden"
                >
                  {isLoadingBuff ? (
                    <Loader2 className="size-3 animate-spin text-blue-400" />
                  ) : (
                    <FaSyncAlt className="size-2.5 text-blue-400" />
                  )}
                  <span>Dùng giá BUFF</span>
                </button>
              )}
              {isSkin && hasBuffPrice && (
                <button
                  type="button"
                  onClick={() => updateBuffPriceCny(marketHashName, '')}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 transition-colors select-none hover:text-stone-400 hover:underline max-md:hidden"
                >
                  <FaSyncAlt className="size-2.5" />
                  <span>Dùng giá Steam</span>
                </button>
              )}
              {isWeaponOrKnifeOrGlove && row.original.inspectLink && !patternInfo && (
                <button
                  type="button"
                  onClick={() =>
                    inspectPattern(row.original.inspectLink!, marketHashName, dopplerPhase)
                  }
                  disabled={inspectingKeys.has(marketHashName)}
                  className="mt-1.5 ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 transition-colors select-none hover:text-emerald-400 hover:underline disabled:cursor-wait max-md:hidden"
                >
                  {inspectingKeys.has(marketHashName) ? (
                    <Loader2 className="size-3 animate-spin text-emerald-400" />
                  ) : (
                    <FaSearch className="size-2.5 text-emerald-400" />
                  )}
                  <span>Inspect</span>
                </button>
              )}
            </div>
          </div>
        );

        if (isMobile || !row.original.sourceAccounts?.length) {
          return content;
        }

        return (
          <HoverCard.Root openDelay={100} closeDelay={150}>
            <HoverCard.Trigger asChild>
              <div className="w-fit cursor-help outline-none">{content}</div>
            </HoverCard.Trigger>
            <HoverCard.Portal>
              <HoverCard.Content
                side="right"
                align="start"
                sideOffset={12}
                className="z-[100] outline-none"
                asChild
              >
                <InventoryScannerItemHoverCardContent
                  item={row.original}
                  patternInfo={patternInfo}
                  dopplerPhase={dopplerPhase}
                  overpayInfo={overpayInfo}
                  buffCnyToVndRate={buffCnyToVndRate}
                  t={t}
                />
              </HoverCard.Content>
            </HoverCard.Portal>
          </HoverCard.Root>
        );
      },
    },
    {
      id: 'quantity',
      enableHiding: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={isMobile ? '' : t('inventoryScanner.quantity')}
          align="right"
          isMobile={isMobile}
        />
      ),
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => {
        if (row.original.isManual && updateManualItemQty && mode === 'transactions') {
          return (
            <InventoryScannerManualQuantityCell
              item={row.original}
              isMobile={isMobile}
              updateManualItemQty={updateManualItemQty}
            />
          );
        }

        return (
          <div className="text-right font-mono font-bold text-stone-100">
            {new Intl.NumberFormat('vi-VN').format(row.original.quantity)}
          </div>
        );
      },
    },
    {
      id: 'price',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('inventoryScanner.unitPriceBuffCny')}
          align="right"
          isMobile={isMobile}
        />
      ),
      accessorFn: (row) => row.price,
      cell: ({ row }) => (
        <InventoryScannerPriceCell
          item={row.original}
          t={t}
          buffPricesCny={buffPricesCny}
          buffPriceErrors={buffPriceErrors}
          buffCnyToVndRate={buffCnyToVndRate}
          mergedRawItems={mergedRawItems}
          patternResults={patternResults}
          isMobile={isMobile}
          renderVND={renderVND}
        />
      ),
    },
    {
      id: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('inventoryScanner.total100')}
          align="right"
          isMobile={isMobile}
        />
      ),
      accessorFn: (row) => row.total,
      cell: ({ row }) => {
        const item = row.original;
        const marketHashName = item.caseItem.marketHashName;
        const overpayInfo = patternResults[marketHashName]?.overpay;

        let basePrice = item.price;
        if (item.type === 'Skin') {
          const buffPriceCny = item.buffPriceCny ?? buffPricesCny[marketHashName];
          if (Number.isFinite(buffPriceCny) && buffPriceCny > 0) {
            basePrice = Math.round(buffPriceCny * buffCnyToVndRate);
          }
        }

        let finalPrice = basePrice;
        if (overpayInfo) {
          finalPrice = Math.round(overpayInfo.estimatedTypical * buffCnyToVndRate);
        }

        const total = finalPrice * item.quantity;

        return (
          <div className="flex flex-col items-end text-right">
            <span className="font-mono font-bold text-emerald-400">{renderVND(total)}</span>
            {overpayInfo && (
              <span className="font-sans text-[9px] font-semibold tracking-wider text-emerald-400 uppercase">
                Overpay
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'scannedAt',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('inventoryScanner.updatedAt')}
          align="right"
          isMobile={isMobile}
        />
      ),
      accessorFn: (row) => (row.scannedAt ? new Date(row.scannedAt).getTime() : 0),
      cell: ({ row }) => {
        const val = row.original.scannedAt;
        return (
          <div className="text-right text-[13px] font-medium text-stone-500">
            {formatRelative(val)}
          </div>
        );
      },
    },
    {
      id: 'rateAll',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('inventoryScanner.wholesale', { rate: rateAll })}
          align="right"
          isMobile={isMobile}
        />
      ),
      accessorFn: (row) =>
        row.priceSource === 'buff163' ? row.total : (row.total * rateAll) / 100,
      cell: ({ row }) => (
        <div className="text-right font-mono font-medium text-blue-300">
          {renderVND(
            row.original.priceSource === 'buff163'
              ? row.original.total
              : (row.original.total * rateAll) / 100
          )}
        </div>
      ),
    },
    {
      id: 'rateLe',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('inventoryScanner.retail', { rate: rateLe })}
          align="right"
          isMobile={isMobile}
        />
      ),
      accessorFn: (row) => (row.priceSource === 'buff163' ? row.total : (row.total * rateLe) / 100),
      cell: ({ row }) => (
        <div className="text-right font-mono font-medium text-amber-400">
          {renderVND(
            row.original.priceSource === 'buff163'
              ? row.original.total
              : (row.original.total * rateLe) / 100
          )}
        </div>
      ),
    },
  ];
}
