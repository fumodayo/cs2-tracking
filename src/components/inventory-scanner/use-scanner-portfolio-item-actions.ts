import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { PortfolioTableRow } from '../portfolio/portfolio-table-model';
import {
  createScannerManualReplacement,
  type ManualItemReplacement,
} from './scanner-manual-replacements';
import type { CaseItemData, ScanResultItem } from './types';
import { findScannedItemByRowId } from './utils';

type AddManualItem = (
  caseItem: CaseItemData,
  price: number,
  quantity: number,
  buyPrice?: number,
  buyDate?: string,
  sourceAccounts?: Array<{ steamId64: string; name: string }>,
  storageUnitId?: string,
  buffPriceManual?: number,
  buffRateManual?: number,
  storageUnitName?: string,
  stickerPriceRate?: number,
  stickerBuyPriceRate?: number,
  id?: string,
  note?: string
) => void;

type UpdateManualItem = (id: string, payload: Partial<ScanResultItem>) => void;
type UpdateManualItemQty = (idOrName: string, qty: number) => void;
type RemoveItem = (marketHashName: string, isManual?: boolean, id?: string) => void;

type UpdateLotPayload = {
  quantity?: number;
  buyPrice?: number;
  note?: string;
  sourceAccounts?: Array<{ steamId64: string; name: string }>;
  storageUnitId?: string;
  stickerPriceRate?: number;
  stickerBuyPriceRate?: number;
  dopplerPhase?: string;
  patternInfo?: PortfolioTableRow['patternInfo'];
  inspectLink?: string;
};

// Nối thao tác sửa từ portfolio-table về state scanner. Dòng quét được chuyển
// thành dòng nhập tay thay thế khi user chỉnh sửa, nên snapshot scanner không bị chạm.
export function useScannerPortfolioItemActions({
  tableData,
  sellDialogSourceItems,
  relatedPortfolioRowsForPanelLength,
  mode,
  addManualItem,
  updateManualItem,
  updateManualItemQty,
  removeItem,
  setSelectedItemForPanel,
}: {
  tableData: ScanResultItem[];
  sellDialogSourceItems: ScanResultItem[];
  relatedPortfolioRowsForPanelLength: number;
  mode: 'case-summary' | 'transactions';
  addManualItem: AddManualItem;
  updateManualItem: UpdateManualItem;
  updateManualItemQty: UpdateManualItemQty;
  removeItem: RemoveItem;
  setSelectedItemForPanel: Dispatch<SetStateAction<ScanResultItem | null>>;
}) {
  const handleSellDelete = useCallback(
    (id: string) => {
      if (id.startsWith('manual-')) {
        removeItem('', true, id);
      } else {
        removeItem('', false, id);
      }
    },
    [removeItem]
  );

  const replaceScannedItemWithManualItem = useCallback(
    (idToRemove: string, scannedItem: ScanResultItem, replacement: ManualItemReplacement) => {
      // Ẩn dòng quét gốc và thêm dòng nhập tay chứa giá trị user có thể chỉnh.
      removeItem('', false, idToRemove);
      addManualItem(
        scannedItem.caseItem,
        scannedItem.price,
        replacement.quantity,
        replacement.buyPrice,
        replacement.buyDate,
        replacement.sourceAccounts,
        replacement.storageUnitId,
        scannedItem.buffPriceManual,
        scannedItem.buffRateManual,
        scannedItem.storageUnitName,
        replacement.stickerPriceRate,
        replacement.stickerBuyPriceRate,
        replacement.id,
        replacement.note
      );
    },
    [addManualItem, removeItem]
  );

  const handleSellUpdateQuantity = useCallback(
    (id: string, newQty: number) => {
      if (id.startsWith('manual-')) {
        updateManualItemQty(id, newQty);
      } else {
        const scannedItem = findScannedItemByRowId(sellDialogSourceItems, id);
        if (scannedItem) {
          replaceScannedItemWithManualItem(
            id,
            scannedItem,
            createScannerManualReplacement(scannedItem, { quantity: newQty })
          );
        }
      }
    },
    [updateManualItemQty, replaceScannedItemWithManualItem, sellDialogSourceItems]
  );

  const handleUpdateLot = useCallback(
    async (id: string, payload: UpdateLotPayload) => {
      if (id.startsWith('manual-')) {
        updateManualItem(id, {
          quantity: payload.quantity,
          buyPrice: payload.buyPrice,
          note: payload.note,
          sourceAccounts: payload.sourceAccounts,
          storageUnitId: payload.storageUnitId,
          stickerPriceRate: payload.stickerPriceRate,
          stickerBuyPriceRate: payload.stickerBuyPriceRate,
          dopplerPhase: payload.dopplerPhase,
          patternInfo: payload.patternInfo,
          inspectLink: payload.inspectLink,
        });
      } else {
        const scannedItem = findScannedItemByRowId(tableData, id);
        if (scannedItem) {
          // Sửa lô trên dòng quét sẽ thành override nhập tay và vẫn giữ trường inspect/pattern.
          replaceScannedItemWithManualItem(
            id,
            scannedItem,
            createScannerManualReplacement(
              scannedItem,
              {
                quantity: payload.quantity ?? scannedItem.quantity,
                buyPrice: payload.buyPrice ?? scannedItem.buyPrice,
                sourceAccounts: payload.sourceAccounts ?? scannedItem.sourceAccounts,
                storageUnitId: payload.storageUnitId ?? scannedItem.storageUnitId,
                stickerPriceRate: payload.stickerPriceRate ?? scannedItem.buffRateManual,
                stickerBuyPriceRate: payload.stickerBuyPriceRate ?? scannedItem.buffRateManual,
                note: payload.note ?? scannedItem.note,
              },
              { preserveEditableFields: true, id }
            )
          );
        }
      }
    },
    [replaceScannedItemWithManualItem, updateManualItem, tableData]
  );

  const handleUpdateQuantity = useCallback(
    (id: string, newQty: number) => {
      if (id.startsWith('manual-')) {
        updateManualItemQty(id, newQty);
      } else {
        const scannedItem = findScannedItemByRowId(tableData, id);
        if (scannedItem) {
          replaceScannedItemWithManualItem(
            id,
            scannedItem,
            createScannerManualReplacement(
              scannedItem,
              { quantity: newQty },
              { preserveEditableFields: true, id }
            )
          );
        }
      }
    },
    [updateManualItemQty, replaceScannedItemWithManualItem, tableData]
  );

  const handleUpdateBuyPrice = useCallback(
    (id: string, newBuyPrice: number) => {
      if (id.startsWith('manual-')) {
        updateManualItem(id, { buyPrice: newBuyPrice });
      } else {
        const scannedItem = findScannedItemByRowId(tableData, id);
        if (scannedItem) {
          replaceScannedItemWithManualItem(
            id,
            scannedItem,
            createScannerManualReplacement(
              scannedItem,
              { buyPrice: newBuyPrice },
              { preserveEditableFields: true, id }
            )
          );
        }
      }
    },
    [updateManualItem, replaceScannedItemWithManualItem, tableData]
  );

  const handleUpdateNote = useCallback(
    (id: string, newNote: string) => {
      if (id.startsWith('manual-')) {
        updateManualItem(id, { note: newNote });
      } else {
        const scannedItem = findScannedItemByRowId(tableData, id);
        if (scannedItem) {
          replaceScannedItemWithManualItem(
            id,
            scannedItem,
            createScannerManualReplacement(
              scannedItem,
              { note: newNote },
              { preserveEditableFields: true, id }
            )
          );
        }
      }
    },
    [updateManualItem, replaceScannedItemWithManualItem, tableData]
  );

  const handleDelete = useCallback(
    (id: string) => {
      handleSellDelete(id);
      if (relatedPortfolioRowsForPanelLength <= 1 || mode === 'transactions') {
        setSelectedItemForPanel(null);
      }
    },
    [handleSellDelete, relatedPortfolioRowsForPanelLength, mode, setSelectedItemForPanel]
  );

  return {
    handleDelete,
    handleSellDelete,
    handleSellUpdateQuantity,
    handleUpdateBuyPrice,
    handleUpdateLot,
    handleUpdateNote,
    handleUpdateQuantity,
  };
}
