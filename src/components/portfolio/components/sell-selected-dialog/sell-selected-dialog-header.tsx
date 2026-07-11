import { ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type SellSelectedDialogHeaderProps = {
  itemsCount: number;
};

export function SellSelectedDialogHeader({ itemsCount }: SellSelectedDialogHeaderProps) {
  const { t } = useTranslation();

  return (
    <DialogHeader className="mb-4 border-b border-stone-800 pb-4">
      <div className="flex items-center gap-3">
        <div className="bg-blue-955/20 flex size-10 items-center justify-center rounded-lg border border-blue-500/25 text-blue-400 shadow-inner">
          <ShoppingBag className="size-5" />
        </div>
        <div>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-wider text-stone-100">
            {t('portfolio.confirmSell', 'Confirm Sale')}{' '}
            <span className="font-mono font-black text-blue-400">{itemsCount}</span>{' '}
            {t('portfolio.itemTypesCount', 'item type(s)')}
          </DialogTitle>
          <DialogDescription className="mt-0.5 font-mono text-xs text-stone-500">
            {t('portfolio.doubleCheckOrder', 'Please review your sell list before proceeding')}
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );
}
