import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { ScanResultItem } from './types';

type InventoryScannerManualQuantityCellProps = {
  item: ScanResultItem;
  isMobile: boolean;
  updateManualItemQty: (id: string, qty: number) => void;
};

export function InventoryScannerManualQuantityCell({
  item,
  isMobile,
  updateManualItemQty,
}: InventoryScannerManualQuantityCellProps) {
  const itemId = item.id || item.caseItem.marketHashName;

  return (
    <div className={cn('flex items-center justify-end', isMobile ? 'gap-0.5' : 'gap-2.5')}>
      <Button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          updateManualItemQty(itemId, item.quantity - 1);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded bg-stone-800 font-bold text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200',
          isMobile ? 'h-4 w-4 text-[9px]' : 'size-6'
        )}
      >
        -
      </Button>
      <span
        className={cn('text-center font-bold text-blue-400', isMobile ? 'w-3 text-[9px]' : 'w-8')}
      >
        {item.quantity}
      </span>
      <Button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          updateManualItemQty(itemId, item.quantity + 1);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded bg-stone-800 font-bold text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200',
          isMobile ? 'h-4 w-4 text-[9px]' : 'size-6'
        )}
      >
        +
      </Button>
    </div>
  );
}
