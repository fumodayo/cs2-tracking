"use client";

import { useCallback } from "react";
import { CaseItemData, ScanResultItem } from "../types";
import { ScannerAction } from "../scanner-reducer";

interface UseManualItemsProps {
  dispatch: React.Dispatch<ScannerAction>;
}

export function useManualItems({ dispatch }: UseManualItemsProps) {
  const addManualItem = useCallback(
    (
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
      // Add new optional parameters
      stickerPriceRate?: number,
      stickerBuyPriceRate?: number,
      id?: string,
      note?: string,
    ) => {
      dispatch({
        type: "ADD_MANUAL_ITEM",
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
        id: id || `manual-${Date.now()}-${Math.random()}`,
        note,
        stickerPriceRate,
        stickerBuyPriceRate,
      });
    },
    [dispatch],
  );

  const updateManualItemQty = useCallback((idOrName: string, qty: number) => {
    dispatch({ type: "UPDATE_MANUAL_QTY", idOrName, qty });
  }, [dispatch]);

  const updateManualItem = useCallback(
    (id: string, payload: Partial<ScanResultItem>) => {
      dispatch({ type: "UPDATE_MANUAL_ITEM", id, payload });
    },
    [dispatch],
  );

  const removeItem = useCallback(
    (marketHashName: string, isManual?: boolean, id?: string) => {
      dispatch({ type: "REMOVE_ITEM", marketHashName, isManual, id });
    },
    [dispatch],
  );

  return {
    addManualItem,
    updateManualItemQty,
    updateManualItem,
    removeItem,
  };
}
