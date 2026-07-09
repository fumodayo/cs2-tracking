import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PortfolioTableRow } from '../../portfolio-table-model';
import { SellSelectedConfirmList } from './sell-selected-confirm-list';

export type SellSelectedConfirmSingleState = {
  open: boolean;
  itemId: string;
  quantity: number;
  itemName: string;
};

type SellSelectedConfirmDialogsProps = {
  confirmSingle: SellSelectedConfirmSingleState | null;
  onCloseSingle: () => void;
  onConfirmSingle: (itemId: string, quantity: number) => void;
  confirmBulk: boolean;
  onCloseBulk: () => void;
  onConfirmBulk: () => void;
  itemsCount: number;
  activeItems: PortfolioTableRow[];
  isBulkSellListExpanded: boolean;
  onToggleBulkSellListExpanded: () => void;
  getSellQuantity: (id: string, maxQuantity: number) => number;
};

export function SellSelectedConfirmDialogs({
  confirmSingle,
  onCloseSingle,
  onConfirmSingle,
  confirmBulk,
  onCloseBulk,
  onConfirmBulk,
  itemsCount,
  activeItems,
  isBulkSellListExpanded,
  onToggleBulkSellListExpanded,
  getSellQuantity,
}: SellSelectedConfirmDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {confirmSingle && (
        <ConfirmDialog
          open={confirmSingle.open}
          onClose={onCloseSingle}
          title={t('portfolio.confirmSellTransaction', 'Confirm Sell Transaction')}
          description={t(
            'portfolio.confirmSellSingleDesc',
            'Are you sure you want to sell {{quantity}} unit(s) of "{{name}}"? This will update the quantity or permanently remove the item from your portfolio.',
            { quantity: confirmSingle.quantity, name: confirmSingle.itemName }
          )}
          confirmText={t('portfolio.confirmSellButton', 'Confirm Sell')}
          cancelText={t('common.cancel', 'Cancel')}
          variant="primary"
          onConfirm={() => onConfirmSingle(confirmSingle.itemId, confirmSingle.quantity)}
        />
      )}

      {confirmBulk && (
        <ConfirmDialog
          open={confirmBulk}
          onClose={onCloseBulk}
          title={t('portfolio.confirmSellAllTitle', 'Confirm Sale of All Selected Items')}
          description={t(
            'portfolio.confirmSellAllDesc',
            'Are you sure you want to sell all configured units for these {{count}} item(s)? The corresponding quantities will be deducted or permanently removed from your portfolio.',
            { count: itemsCount }
          )}
          confirmText={t('portfolio.confirmSellAllButton', 'Yes, Sell All')}
          cancelText={t('common.cancel', 'Cancel')}
          variant="danger"
          onConfirm={onConfirmBulk}
        >
          {activeItems.length > 0 && (
            <SellSelectedConfirmList
              activeItems={activeItems}
              isExpanded={isBulkSellListExpanded}
              onToggleExpanded={onToggleBulkSellListExpanded}
              getSellQuantity={getSellQuantity}
            />
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
