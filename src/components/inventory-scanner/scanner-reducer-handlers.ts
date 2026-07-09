import type { AccountEntry, ScanResultItem } from './types';
import type { ScannerAction, ScannerState } from './scanner-reducer';
import { getInventoryItemType } from './utils';

type AddManualItemAction = Extract<ScannerAction, { type: 'ADD_MANUAL_ITEM' }>;
type UpdateManualItemAction = Extract<ScannerAction, { type: 'UPDATE_MANUAL_ITEM' }>;
type UpdateManualQtyAction = Extract<ScannerAction, { type: 'UPDATE_MANUAL_QTY' }>;
type RemoveItemAction = Extract<ScannerAction, { type: 'REMOVE_ITEM' }>;
type PriceRetrySuccessAction = Extract<ScannerAction, { type: 'PRICE_RETRY_SUCCESS' }>;

export function normalizeScanItemType(item: ScanResultItem): ScanResultItem {
  const inferredType = getInventoryItemType(item.caseItem.name, item.caseItem.marketHashName);

  return item.type === inferredType ? item : { ...item, type: inferredType };
}

export function normalizeAccountItemTypes(account: AccountEntry): AccountEntry {
  if (!account.result) return account;

  return {
    ...account,
    result: {
      ...account.result,
      items: account.result.items.map(normalizeScanItemType),
    },
  };
}

export function addManualItemToScannerState(
  state: ScannerState,
  action: AddManualItemAction
): ScannerState {
  const {
    caseItem,
    price,
    quantity,
    buyPrice,
    buyDate,
    sourceAccounts,
    storageUnitId,
    storageUnitName,
    buffPriceManual,
    buffRateManual,
    id,
    note,
    stickerPriceRate,
    stickerBuyPriceRate,
    stickerScanTotalPrice,
    stickerScanPriceCapturedAt,
    patternInfo,
    dopplerPhase,
    inspectLink,
  } = action;
  const type = getInventoryItemType(caseItem.name, caseItem.marketHashName);

  // Chỉ gộp lô nhập tay khi định danh mua, storage và quyền sở hữu nguồn khớp.
  const existingIdx = state.manualItems.findIndex(
    (item) =>
      item.caseItem.marketHashName === caseItem.marketHashName &&
      item.buyPrice === buyPrice &&
      item.buyDate === buyDate &&
      item.storageUnitId === storageUnitId &&
      JSON.stringify(item.sourceAccounts) === JSON.stringify(sourceAccounts)
  );

  const nextManualItems =
    existingIdx !== -1
      ? state.manualItems.map((item, idx) =>
          idx === existingIdx
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: item.price * (item.quantity + quantity),
              }
            : item
        )
      : [
          ...state.manualItems,
          {
            id: id || `manual-${Date.now()}-${Math.random()}`,
            caseItem,
            type,
            quantity,
            price,
            total: price * quantity,
            isManual: true,
            buyPrice,
            buyDate,
            sourceAccounts,
            storageUnitId,
            storageUnitName,
            buffPriceManual,
            buffRateManual,
            note,
            stickerPriceRate,
            stickerBuyPriceRate,
            stickerScanTotalPrice,
            stickerScanPriceCapturedAt,
            patternInfo,
            dopplerPhase,
            inspectLink,
          },
        ];

  const nextRemovedKeys = new Set(state.removedKeys);
  // Thêm lại vật phẩm nhập tay cần làm dòng quét từng bị ẩn hiển thị lại.
  nextRemovedKeys.delete(caseItem.marketHashName);

  return {
    ...state,
    manualItems: nextManualItems,
    removedKeys: nextRemovedKeys,
  };
}

export function updateManualItemInScannerState(
  state: ScannerState,
  action: UpdateManualItemAction
): ScannerState {
  return {
    ...state,
    manualItems: state.manualItems.map((item) =>
      item.id === action.id
        ? {
            ...item,
            ...action.payload,
            total: item.price * (action.payload.quantity ?? item.quantity),
          }
        : item
    ),
  };
}

export function updateManualQuantityInScannerState(
  state: ScannerState,
  action: UpdateManualQtyAction
): ScannerState {
  return {
    ...state,
    manualItems:
      action.qty <= 0
        ? state.manualItems.filter((item) =>
            action.idOrName.startsWith('manual-')
              ? item.id !== action.idOrName
              : item.caseItem.marketHashName !== action.idOrName
          )
        : state.manualItems.map((item) =>
            (
              action.idOrName.startsWith('manual-')
                ? item.id === action.idOrName
                : item.caseItem.marketHashName === action.idOrName
            )
              ? { ...item, quantity: action.qty, total: item.price * action.qty }
              : item
          ),
  };
}

export function removeItemFromScannerState(
  state: ScannerState,
  action: RemoveItemAction
): ScannerState {
  if (action.isManual) {
    return {
      ...state,
      manualItems: state.manualItems.filter((item) =>
        action.id ? item.id !== action.id : item.caseItem.marketHashName !== action.marketHashName
      ),
    };
  }

  // Dòng quét là snapshot bất biến; xóa bằng cách thêm tombstone key.
  const nextRemovedKeys = new Set(state.removedKeys);
  nextRemovedKeys.add(action.id ?? action.marketHashName);
  return {
    ...state,
    removedKeys: nextRemovedKeys,
  };
}

export function applyPriceRetrySuccess(
  state: ScannerState,
  action: PriceRetrySuccessAction
): ScannerState {
  const { results, status } = action;
  const priceMap = new Map<string, { price: number; priceSource?: string }>();
  // Bỏ qua retry thất bại để giá đang dùng được không bị ghi đè thành 0.
  for (const result of results) {
    if (result.price > 0) priceMap.set(result.marketHashName, result);
  }

  const updatedAccounts = state.accounts.map((account) => {
    if (!account.result) return account;
    const updatedItems = account.result.items.map((scanItem) => {
      const found = priceMap.get(scanItem.caseItem.marketHashName);
      if (!found) return scanItem;
      return {
        ...scanItem,
        price: found.price,
        total: found.price * scanItem.quantity,
        priceSource: found.priceSource as ScanResultItem['priceSource'],
      };
    });
    return {
      ...account,
      result: {
        ...account.result,
        items: updatedItems,
        totalPrice: updatedItems.reduce((sum: number, item: ScanResultItem) => sum + item.total, 0),
      },
    };
  });

  const updatedManualItems = state.manualItems.map((manualItem) => {
    const found = priceMap.get(manualItem.caseItem.marketHashName);
    if (!found) return manualItem;
    return {
      ...manualItem,
      price: found.price,
      total: found.price * manualItem.quantity,
      priceSource: found.priceSource as ScanResultItem['priceSource'],
    };
  });

  return {
    ...state,
    accounts: updatedAccounts,
    manualItems: updatedManualItems,
    retryingPrices: false,
    retryStatus: status,
  };
}
