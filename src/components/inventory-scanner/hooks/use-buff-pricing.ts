"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/stores";
import { ScanResultItem } from "../types";
import { getLocalApiKey } from "../utils";
import { ScannerState, ScannerAction } from "../scanner-reducer";

interface UseBuffPricingProps {
  state: ScannerState;
  dispatch: React.Dispatch<ScannerAction>;
  buffCnyToVndRate: number;
  isRefreshingPrices: boolean;
  setIsRefreshingPrices: (refresh: boolean) => void;
  isAnyScanPending: boolean;
  filteredManualItems: ScanResultItem[];
  scannedItems: ScanResultItem[];
}

export function useBuffPricing({
  state,
  dispatch,
  buffCnyToVndRate,
  setIsRefreshingPrices,
  isAnyScanPending,
  filteredManualItems,
  scannedItems,
}: UseBuffPricingProps) {
  const { t } = useTranslation();
  const updateBuffPriceCny = useCallback(
    (marketHashName: string, rawValue: string) => {
      dispatch({ type: "UPDATE_BUFF_PRICE_CNY", marketHashName, rawValue });
    },
    [dispatch],
  );

  /**
   * Fetches latest BUFF163 price for a specific skin market hash name.
   */
  const fetchBuffPrice = useCallback(
    async (marketHashName: string, forceRefresh = false) => {
      dispatch({ type: "START_BUFF_FETCH", marketHashName });

      try {
        const localKey = getLocalApiKey();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (localKey) {
          headers["x-cs2cap-api-key"] = localKey;
        }

        const response = await fetch("/api/inventory/buff-price", {
          method: "POST",
          headers,
          body: JSON.stringify({
            marketHashName,
            cnyToVndRate: buffCnyToVndRate,
            forceRefresh,
          }),
        });
        const resText = await response.text();
        interface BuffPriceResponse {
          message?: string;
          priceCny?: number | string;
        }
        let data: BuffPriceResponse;
        try {
          data = JSON.parse(resText) as BuffPriceResponse;
        } catch {
          throw new Error(
            t("inventoryScanner.apiErrors.buffHttp", "BUFF163 price fetch request failed (HTTP {{status}}).", {
              status: response.status,
            })
          );
        }

        if (!response.ok) {
          throw new Error(data.message ? (t(`inventoryScanner.apiErrors.${data.message}`) || data.message) : t("inventoryScanner.apiErrors.buffGeneric", "Cannot fetch BUFF163 price."));
        }

        const priceCny = Number(data.priceCny);
        if (!Number.isFinite(priceCny) || priceCny <= 0) {
          throw new Error(t("inventoryScanner.apiErrors.buffInvalidPrice", "Invalid BUFF163 price returned."));
        }

        dispatch({ type: "BUFF_FETCH_SUCCESS", marketHashName, priceCny });
      } catch (error) {
        dispatch({
          type: "BUFF_FETCH_FAILURE",
          marketHashName,
          error:
            error instanceof Error
              ? error.message
              : t("inventoryScanner.apiErrors.buffGeneric", "Cannot fetch BUFF163 price."),
        });
      }
    },
    [buffCnyToVndRate, dispatch, t],
  );

  const refreshPrices = useCallback(async () => {
    if (state.scanningAll || isAnyScanPending || state.retryingPrices) return;

    const allItems = [...filteredManualItems, ...scannedItems];
    const uniqueNames = Array.from(
      new Set(allItems.map((item) => item.caseItem.marketHashName))
    );
    if (uniqueNames.length === 0) {
      toast.info(t("inventoryScanner.apiErrors.noItemsToRefresh", "No items to refresh price."));
      return;
    }

    setIsRefreshingPrices(true);
    dispatch({ type: "START_PRICE_RETRY" });

    try {
      const response = await fetch("/api/inventory/retry-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketHashNames: uniqueNames,
        }),
      });

      if (!response.ok) {
        throw new Error(t("inventoryScanner.apiErrors.steamConnection", "Cannot connect to Steam Market price update API."));
      }

      const resText = await response.text();
      let steamData: {
        results?: Array<{
          marketHashName: string;
          price: number;
          priceSource?: string;
        }>;
      } = {};
      try {
        steamData = JSON.parse(resText);
      } catch {
        throw new Error(t("inventoryScanner.apiErrors.steamRead", "Error reading Steam price data."));
      }

      if (steamData && Array.isArray(steamData.results)) {
        dispatch({
          type: "PRICE_RETRY_SUCCESS",
          results: steamData.results,
          status: t("inventoryScanner.apiErrors.successSteamRefresh", "Steam prices refreshed successfully!"),
        });
      } else {
        dispatch({
          type: "PRICE_RETRY_FAILURE",
          status: t("inventoryScanner.apiErrors.errSteamRefresh", "Error refreshing Steam prices."),
        });
      }

      const skinItems = allItems.filter((item) => item.type === "Skin");
      if (skinItems.length > 0) {
        await Promise.all(
          skinItems.map((item) =>
            fetchBuffPrice(item.caseItem.marketHashName, true).catch((err) => {
              console.error(`Lỗi fetch giá BUFF cho ${item.caseItem.marketHashName}:`, err);
            })
          )
        );
      }

      toast.success(t("inventoryScanner.apiErrors.successAllRefresh", "All Steam and BUFF163 prices refreshed successfully!"), {
        path: "/inventory-scanner",
      });
    } catch (err) {
      dispatch({
        type: "PRICE_RETRY_FAILURE",
        status: t("inventoryScanner.apiErrors.errRefresh", "Error refreshing prices."),
      });
      toast.error(err instanceof Error ? err.message : t("inventoryScanner.apiErrors.errRefresh", "Error refreshing prices."), {
        path: "/inventory-scanner",
      });
    } finally {
      setIsRefreshingPrices(false);
    }
  }, [
    state.scanningAll,
    isAnyScanPending,
    state.retryingPrices,
    filteredManualItems,
    scannedItems,
    fetchBuffPrice,
    dispatch,
    setIsRefreshingPrices,
  ]);

  return {
    updateBuffPriceCny,
    fetchBuffPrice,
    refreshPrices,
  };
}
