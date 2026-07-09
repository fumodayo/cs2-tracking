import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PortfolioRowItemType } from '../../portfolio-table-model';

type SellSelectedItemQuantitySelectorProps = {
  itemId: string;
  itemType: PortfolioRowItemType;
  sellQty: number;
  maxQty: number;
  totalTradableQty: number;
  isLoading: boolean;
  hasBuff: boolean;
  isFullSell: boolean;
  handleQuantityChange: (id: string, value: number, maxQuantity: number) => void;
};

export function SellSelectedItemQuantitySelector({
  itemId,
  itemType,
  sellQty,
  maxQty,
  totalTradableQty,
  isLoading,
  hasBuff,
  isFullSell,
  handleQuantityChange,
}: SellSelectedItemQuantitySelectorProps) {
  const { t } = useTranslation();

  if (itemType === 'skin') {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[9px] font-bold tracking-widest text-stone-500">
        {t('portfolio.sellQtyLabel', 'Sell Qty')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-card/50 flex h-8 w-24 items-center overflow-hidden rounded-[2px] border border-stone-800 shadow-inner transition-all duration-200 focus-within:border-stone-600 focus-within:ring-1 focus-within:ring-stone-600/30">
          <button
            type="button"
            onClick={() => handleQuantityChange(itemId, sellQty - 1, maxQty)}
            disabled={sellQty <= 1 || isLoading}
            className="flex h-full w-8 items-center justify-center text-stone-400 transition-colors hover:bg-stone-900/50 hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Minus className="size-3" />
          </button>
          <input
            type="number"
            value={sellQty}
            onChange={(event) =>
              handleQuantityChange(itemId, parseInt(event.target.value) || 1, maxQty)
            }
            disabled={isLoading}
            className="w-full flex-1 [appearance:textfield] bg-transparent text-center font-mono text-xs font-bold text-stone-100 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => handleQuantityChange(itemId, sellQty + 1, maxQty)}
            disabled={sellQty >= maxQty || isLoading}
            className="flex h-full w-8 items-center justify-center text-stone-400 transition-colors hover:bg-stone-900/50 hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Plus className="size-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            const targetQty = Math.max(1, Math.min(totalTradableQty, maxQty));
            handleQuantityChange(itemId, targetQty, maxQty);
          }}
          disabled={isLoading || totalTradableQty === 0}
          className={`disabled:border-stone-850 disabled:text-stone-650 bg-card/50 flex h-8 items-center justify-center rounded-[2px] border px-3 font-mono text-[10px] font-bold tracking-wider transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-stone-950/20 ${
            hasBuff
              ? 'border-amber-500/20 text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
              : isFullSell
                ? 'border-rose-500/20 text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300'
                : 'border-blue-500/20 text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300'
          }`}
          title={t(
            'portfolio.setAllTradableTooltip',
            'Set quantity to all immediately tradeable items ({{count}})',
            { count: totalTradableQty }
          )}
        >
          {t('common.all', 'All')} ({totalTradableQty})
        </button>
      </div>
    </div>
  );
}
