import { useMemo, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CaseThumbnail } from './case-thumbnail';
import type { PortfolioTableRow } from './portfolio-table-model';
import { SellSelectedAccessoryDetails } from './components/sell-selected-dialog/sell-selected-accessory-details';
import { SellSelectedItemQuantitySelector } from './components/sell-selected-dialog/sell-selected-item-quantity-selector';
import {
  calculateSellSelectedAllocatedAccounts,
  calculateSellSelectedRowPricing,
  calculateSellSelectedTotalTradableQty,
} from './sell-selected-dialog-utils';

type SellSelectedDialogItemRowProps = {
  item: PortfolioTableRow;
  isLoading: boolean;
  sellQty: number;
  maxQty: number;
  wholesaleRate: number;
  retailRate: number;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  buffCnyPrices: Record<string, string>;
  setBuffCnyPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  buffRates: Record<string, string>;
  setBuffRates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemRetailRates: Record<string, string>;
  itemWholesaleRates: Record<string, string>;
  itemStickerRates: Record<string, string>;
  getItemStickerScanTotal: (item: PortfolioTableRow) => number;
  accessoryPriceMap: Map<string, number>;
  handleQuantityChange: (id: string, value: number, maxQuantity: number) => void;
  handleWholesaleRateChange: (id: string, value: string) => void;
  handleRetailRateChange: (id: string, value: string) => void;
  handleStickerRateChange: (id: string, value: string) => void;
  setConfirmSingle: (
    val: { open: boolean; itemId: string; quantity: number; itemName: string } | null
  ) => void;
  excludeItem: (id: string) => void;
  formatCurrency: (val: number) => string;
};

export const SellSelectedDialogItemRow = memo(
  function SellSelectedDialogItemRow({
    item,
    isLoading,
    sellQty,
    maxQty,
    wholesaleRate,
    retailRate,
    buffPricesCny,
    buffCnyToVndRate,
    buffCnyPrices,
    setBuffCnyPrices,
    buffRates,
    setBuffRates,
    itemRetailRates,
    itemWholesaleRates,
    itemStickerRates,
    getItemStickerScanTotal,
    accessoryPriceMap,
    handleQuantityChange,
    handleWholesaleRateChange,
    handleRetailRateChange,
    handleStickerRateChange,
    setConfirmSingle,
    excludeItem,
    formatCurrency,
  }: SellSelectedDialogItemRowProps) {
    const { t } = useTranslation();
    const [now] = useState(() => Date.now());

    const totalTradableQty = useMemo(
      () => calculateSellSelectedTotalTradableQty({ item, maxQty, now }),
      [item, maxQty, now]
    );

    const allocatedAccounts = useMemo(
      () => calculateSellSelectedAllocatedAccounts({ item, maxQty, now }),
      [item, maxQty, now]
    );

    const {
      hasBuff,
      unitCurrent,
      isFullSell,
      activeRateStr,
      itemStickerRateVal,
      stickerScanTotalPrice,
      unitSell,
      rowCurrentValue,
      rowProfit,
      rowProfitPositive,
    } = useMemo(
      () =>
        calculateSellSelectedRowPricing({
          item,
          sellQty,
          maxQty,
          wholesaleRate,
          retailRate,
          buffPricesCny,
          buffCnyToVndRate,
          buffCnyPrices,
          buffRates,
          itemRetailRates,
          itemWholesaleRates,
          itemStickerRates,
          getItemStickerScanTotal,
        }),
      [
        item,
        sellQty,
        maxQty,
        wholesaleRate,
        retailRate,
        buffPricesCny,
        buffCnyToVndRate,
        buffCnyPrices,
        buffRates,
        itemRetailRates,
        itemWholesaleRates,
        itemStickerRates,
        getItemStickerScanTotal,
      ]
    );

    const stickers = item.patternInfo?.stickers ?? [];
    const charms = item.patternInfo?.charms ?? [];

    return (
      <div
        className={`relative flex gap-4 overflow-hidden rounded-[2px] border py-3.5 pr-4 pl-4 transition-all duration-300 ${
          isLoading
            ? 'pointer-events-none border-rose-500/10 bg-stone-950/20 opacity-40'
            : hasBuff
              ? 'border-stone-850 bg-stone-900/10 hover:border-amber-500/40 hover:bg-stone-900/15 hover:shadow-[0_0_15px_rgba(245,158,11,0.03)]'
              : isFullSell
                ? 'border-stone-850 bg-stone-900/10 hover:border-rose-500/40 hover:bg-stone-900/15 hover:shadow-[0_0_15px_rgba(244,63,94,0.03)]'
                : 'border-stone-850 bg-stone-900/10 hover:border-blue-500/40 hover:bg-stone-900/15 hover:shadow-[0_0_15px_rgba(59,130,246,0.03)]'
        }`}
      >
        {/* Custom decorative technical indicator line */}
        <div
          className={`absolute top-0 bottom-0 left-0 w-[3px] transition-all ${
            isLoading
              ? 'bg-stone-800'
              : hasBuff
                ? 'bg-gradient-to-b from-amber-500 to-amber-600/30'
                : isFullSell
                  ? 'bg-gradient-to-b from-rose-500 to-rose-600/30'
                  : 'bg-gradient-to-b from-blue-500 to-blue-600/30'
          }`}
        />

        {/* Left Column: Big Thumbnail */}
        <div className="group border-stone-850 relative mt-0.5 flex h-[72px] w-[72px] shrink-0 items-center justify-center self-start rounded-[2px] border bg-stone-950 p-1.5 shadow-inner">
          <CaseThumbnail imageUrl={item.case.imageUrl} name={item.case.name} size="lg" />
        </div>

        {/* Right Column: Content Container */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Row 1: Item Header (Name, Sell Button, Profit Badge and Exclude Button) */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Name, Sell button, and LÃ£i/Lá»— rÃ²ng badge */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <p
                className="truncate text-xs leading-tight font-extrabold tracking-wide text-stone-200 transition-colors hover:text-blue-400 sm:text-sm"
                title={item.case.name}
              >
                {item.case.name}
              </p>

              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => {
                  setConfirmSingle({
                    open: true,
                    itemId: item.id,
                    quantity: sellQty,
                    itemName: item.case.name,
                  });
                }}
                className={`bg-card/50 h-7 shrink-0 rounded-[2px] border px-2.5 font-mono text-[10px] font-bold tracking-wider uppercase transition-all duration-200 ${
                  hasBuff
                    ? 'border-amber-500/20 text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
                    : isFullSell
                      ? 'border-rose-500/20 text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300'
                      : 'border-blue-500/20 text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="size-3 animate-spin text-current" />
                ) : (
                  <span>{t('portfolio.sellShort', 'Sell')}</span>
                )}
              </Button>

              {/* Item Profit/Loss Badge */}
              <div
                className={`flex h-6 shrink-0 items-center justify-center rounded-[2px] border px-2.5 font-mono text-[10px] font-black shadow-sm transition-all duration-300 select-none ${
                  rowProfitPositive
                    ? 'bg-emerald-955/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.06)]'
                    : 'bg-rose-955/20 border-rose-500/30 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.06)]'
                }`}
              >
                {rowProfitPositive ? '+' : ''}
                {formatCurrency(rowProfit)}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => excludeItem(item.id)}
                title={t('portfolio.deselectItem', 'Deselect Item')}
                className="border-stone-850 bg-card/50 hover:bg-rose-955/20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border text-stone-500 transition-all hover:border-rose-500/30 hover:text-rose-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <SellSelectedItemQuantitySelector
            itemId={item.id}
            itemType={item.itemType}
            sellQty={sellQty}
            maxQty={maxQty}
            totalTradableQty={totalTradableQty}
            isLoading={isLoading}
            hasBuff={hasBuff}
            isFullSell={isFullSell}
            handleQuantityChange={handleQuantityChange}
          />

          {/* Account Ownership breakdown */}
          {allocatedAccounts.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-stone-900 pt-2.5">
              <span className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                {t('portfolio.owningAccountsShort', 'Account')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {allocatedAccounts.map((acc) => {
                  const tradable = acc.tradable;
                  const onMarket = acc.onMarket;
                  const hold = acc.hold;

                  // Chỉ render badge trạng thái tài khoản khi có vật phẩm để hiển thị
                  if (tradable === 0 && onMarket === 0 && hold === 0) return null;

                  return (
                    <div
                      key={acc.steamId64}
                      className="bg-card/30 flex items-center gap-1.5 rounded-[2px] border border-stone-800 px-2.5 py-1 text-[9px] shadow-sm select-none"
                    >
                      <span className="font-sans font-bold text-stone-300">{acc.name}</span>
                      <span className="text-stone-800">|</span>
                      <span className="font-mono text-stone-500">
                        {t('portfolio.readyToTrade', 'Ready')}:{' '}
                        <strong className="font-extrabold text-emerald-400">{tradable}</strong>
                      </span>
                      {onMarket > 0 && (
                        <>
                          <span className="text-stone-800">â€¢</span>
                          <span className="font-mono text-stone-500">
                            {t('portfolio.onMarket', 'On Market')}:{' '}
                            <strong className="font-extrabold text-blue-400">{onMarket}</strong>
                          </span>
                        </>
                      )}
                      {hold > 0 && (
                        <>
                          <span className="text-stone-850">â€¢</span>
                          <span className="font-mono text-stone-500">
                            {t('portfolio.hold', 'Hold')}:{' '}
                            <strong className="font-extrabold text-rose-400">{hold}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <SellSelectedAccessoryDetails
            stickers={stickers}
            charms={charms}
            accessoryPriceMap={accessoryPriceMap}
            formatCurrency={formatCurrency}
          />

          {/* Row 3: The Equation Flow */}
          <div className="flex flex-wrap items-end justify-start gap-1.5 pt-1">
            {hasBuff ? (
              <>
                {/* Input CNY Price */}
                <div className="flex w-[7.5rem] flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                    {t('portfolio.buffCnyPrice', 'BUFF Price (CNY)')}
                  </label>
                  <div className="bg-card/50 flex h-8 items-center rounded-[2px] border border-stone-800 px-2.5 shadow-inner transition-all focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20">
                    <input
                      type="number"
                      step="0.01"
                      value={buffCnyPrices[item.id] !== undefined ? buffCnyPrices[item.id] : ''}
                      onChange={(e) =>
                        setBuffCnyPrices((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-bold text-stone-100 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="ml-1.5 font-mono text-[9px] font-black text-amber-500 select-none">
                      Â¥
                    </span>
                  </div>
                </div>

                <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                  Ã—
                </span>

                {/* Input Rate CNY */}
                <div className="flex w-[7.5rem] flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                    {t('portfolio.cnyRate', 'Tá»· giÃ¡ CNY')}
                  </label>
                  <div className="bg-card/50 flex h-8 items-center rounded-[2px] border border-stone-800 px-2.5 shadow-inner transition-all focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20">
                    <input
                      type="number"
                      value={buffRates[item.id] !== undefined ? buffRates[item.id] : ''}
                      onChange={(e) =>
                        setBuffRates((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="text-stone-150 w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-bold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="ml-1.5 font-mono text-[9px] font-bold text-stone-500 select-none">
                      Ä‘
                    </span>
                  </div>
                </div>

                {/* Sticker Rate Input Box (for BUFF items) */}
                {stickerScanTotalPrice > 0 && (
                  <>
                    <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                      +
                    </span>
                    <div className="flex w-[8.5rem] flex-col gap-1">
                      <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                        Sticker ({formatCurrency(stickerScanTotalPrice)})
                      </label>
                      <div className="bg-card/50 flex h-8 items-center rounded-[2px] border border-stone-800 px-2.5 shadow-inner transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20">
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={itemStickerRateVal}
                          onChange={(e) => handleStickerRateChange(item.id, e.target.value)}
                          disabled={isLoading}
                          className="text-stone-150 w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-black outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="ml-1 text-[9px] font-bold text-stone-500 select-none">
                          %
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                  =
                </span>

                {/* Calculated Unit Price VND */}
                <div className="flex w-[7.5rem] flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                    {t('portfolio.sellPriceVnd', 'GiÃ¡ bÃ¡n')}
                  </label>
                  <div className="flex h-8 items-center justify-end px-1 font-mono text-xs font-bold text-amber-400 select-none">
                    {formatCurrency(unitSell)}
                  </div>
                </div>

                {sellQty > 1 && (
                  <>
                    <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                      â†’
                    </span>

                    {/* Total calculated price for BUFF row */}
                    <div className="flex w-[8.5rem] flex-col gap-1">
                      <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                        {t('portfolio.totalQtyMoney', 'Tá»•ng tiá»n ({{count}})', {
                          count: sellQty,
                        })}
                      </label>
                      <div className="flex h-8 items-center justify-end rounded-[2px] border border-amber-500/10 bg-amber-500/5 px-2.5 font-black text-amber-400 shadow-[0_2px_8px_rgba(245,158,11,0.05)] select-none">
                        <span className="font-mono text-xs">{formatCurrency(rowCurrentValue)}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Price 1 Unit */}
                <div className="flex w-[7.5rem] flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                    {t('portfolio.currentPrice', 'GiÃ¡ hiá»‡n táº¡i')}
                  </label>
                  <div className="flex h-8 items-center justify-end px-1 font-mono text-xs font-semibold text-stone-300 select-none">
                    {formatCurrency(unitCurrent)}
                  </div>
                </div>

                <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                  Ã—
                </span>

                {/* Active Rate Input Box */}
                <div className="flex w-[7.5rem] flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                    {isFullSell
                      ? t('portfolio.bulkRatePct', 'Tá»· lá»‡ bÃ¡n sá»‰ %')
                      : t('portfolio.retailRatePct', 'Tá»· lá»‡ bÃ¡n láº» %')}
                  </label>
                  <div
                    className={`bg-card/50 flex h-8 items-center rounded-[2px] border px-2.5 shadow-inner transition-all ${
                      isFullSell
                        ? 'border-stone-800 focus-within:border-rose-500/50 focus-within:ring-1 focus-within:ring-rose-500/20'
                        : 'border-stone-800 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20'
                    }`}
                  >
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={activeRateStr}
                      onChange={(e) => {
                        if (isFullSell) {
                          handleWholesaleRateChange(item.id, e.target.value);
                        } else {
                          handleRetailRateChange(item.id, e.target.value);
                        }
                      }}
                      disabled={isLoading}
                      className="text-stone-150 w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-black outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* Sticker Rate Input Box (for non-BUFF items) */}
                {stickerScanTotalPrice > 0 && (
                  <>
                    <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                      +
                    </span>
                    <div className="flex w-[8.5rem] flex-col gap-1">
                      <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                        Sticker ({formatCurrency(stickerScanTotalPrice)})
                      </label>
                      <div className="bg-card/50 flex h-8 items-center rounded-[2px] border border-stone-800 px-2.5 shadow-inner transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20">
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={itemStickerRateVal}
                          onChange={(e) => handleStickerRateChange(item.id, e.target.value)}
                          disabled={isLoading}
                          className="text-stone-150 w-full [appearance:textfield] bg-transparent text-right font-mono text-xs font-black outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="ml-1 text-[9px] font-bold text-stone-500 select-none">
                          %
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                  =
                </span>

                {/* Calculated Sell Price VND */}
                <div className="flex w-[7.5rem] flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                    {t('portfolio.sellPriceVnd', 'GiÃ¡ bÃ¡n')}
                  </label>
                  <div
                    className={`flex h-8 items-center justify-end px-1 font-mono text-xs font-bold select-none ${
                      isFullSell ? 'text-rose-400' : 'text-blue-400'
                    }`}
                  >
                    {formatCurrency(unitSell)}
                  </div>
                </div>

                {sellQty > 1 && (
                  <>
                    <span className="flex h-8 items-center justify-center px-1 font-mono text-[10px] font-bold text-stone-600 select-none">
                      â†’
                    </span>

                    {/* Total calculated price for the row */}
                    <div className="flex w-[8.5rem] flex-col gap-1">
                      <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
                        {t('portfolio.totalQtyMoney', 'Tá»•ng tiá»n ({{count}})', {
                          count: sellQty,
                        })}
                      </label>
                      <div
                        className={`flex h-8 items-center justify-end rounded-[2px] border px-2.5 select-none ${
                          isFullSell
                            ? 'border-rose-500/10 bg-rose-500/5 font-black text-rose-400 shadow-[0_2px_8px_rgba(244,63,94,0.05)]'
                            : 'border-blue-500/10 bg-blue-500/5 font-black text-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.05)]'
                        }`}
                      >
                        <span className="font-mono text-xs">{formatCurrency(rowCurrentValue)}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.item === next.item &&
      prev.isLoading === next.isLoading &&
      prev.sellQty === next.sellQty &&
      prev.maxQty === next.maxQty &&
      prev.wholesaleRate === next.wholesaleRate &&
      prev.retailRate === next.retailRate &&
      prev.buffCnyToVndRate === next.buffCnyToVndRate &&
      prev.buffPricesCny?.[prev.item.case.marketHashName] ===
        next.buffPricesCny?.[next.item.case.marketHashName] &&
      prev.buffCnyPrices[prev.item.id] === next.buffCnyPrices[next.item.id] &&
      prev.buffRates[prev.item.id] === next.buffRates[next.item.id] &&
      prev.itemRetailRates[prev.item.id] === next.itemRetailRates[next.item.id] &&
      prev.itemWholesaleRates[prev.item.id] === next.itemWholesaleRates[next.item.id] &&
      prev.itemStickerRates[prev.item.id] === next.itemStickerRates[next.item.id] &&
      prev.getItemStickerScanTotal(prev.item) === next.getItemStickerScanTotal(next.item) &&
      prev.accessoryPriceMap === next.accessoryPriceMap
    );
  }
);

SellSelectedDialogItemRow.displayName = 'SellSelectedDialogItemRow';
