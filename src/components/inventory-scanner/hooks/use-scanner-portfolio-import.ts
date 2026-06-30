"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { AccountEntry, ScanResultItem } from "../types";
import type { ScannerAction } from "../scanner-reducer";
import { translateImportProgressMessage } from "../utils";

interface UseScannerPortfolioImportProps {
  dispatch: React.Dispatch<ScannerAction>;
  accounts: AccountEntry[];
  mergedRaw: {
    items: ScanResultItem[];
    scannedItems: ScanResultItem[];
    totalInventoryCount: number;
    accountCount: number;
  } | null;
  applyBuffPricing: (item: ScanResultItem) => ScanResultItem;
}

export function useScannerPortfolioImport({
  dispatch,
  accounts,
  mergedRaw,
  applyBuffPricing,
}: UseScannerPortfolioImportProps) {
  const { t } = useTranslation();
  /**
   * Imports all scanned items directly to user's personal tracking portfolio.
   */
  const importInventoryToPortfolio = useCallback(async () => {
    const items = (mergedRaw?.items ?? []).map(applyBuffPricing);
    if (!items.length) return;

    const itemsWithAccounts = items.map((item: ScanResultItem) => ({
      ...item,
      sourceAccounts: item.sourceAccounts || [],
    }));

    const accountsWithCookies = accounts
      .filter((a) => a.status === "done" && a.result)
      .map((a) => ({
        steamId64: a.result!.steamId64,
        steamCookie: a.steamCookie?.trim() || "",
      }));

    dispatch({ type: "START_PORTFOLIO_IMPORT" });

    try {
      dispatch({
        type: "UPDATE_PORTFOLIO_IMPORT_STATUS",
        status: t("inventoryScanner.apiErrors.preparingInventoryData", "Preparing inventory data..."),
      });

      const response = await fetch("/api/portfolio/import-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsWithAccounts,
          accounts: accountsWithCookies,
        }),
      });

      if (!response.ok) {
        let errMessage = t("inventoryScanner.apiErrors.errSaveToPortfolio", "Cannot save inventory to portfolio.");
        try {
          const resText = await response.text();
          const errData = JSON.parse(resText);
          errMessage = errData.message || errMessage;
        } catch {
          errMessage = t("inventoryScanner.apiErrors.errSaveToPortfolioHttp", "Cannot save portfolio (HTTP {{status}})", {
            status: response.status,
          });
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error(t("inventoryScanner.apiErrors.errReadServerResponse", "Cannot read server response."));
      }

      // Read streaming progress from server
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastResult: { importedCount?: number; skippedCount?: number } | null =
        null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "progress") {
              const percent = event.percent ?? 0;
              dispatch({
                type: "UPDATE_PORTFOLIO_IMPORT_STATUS",
                status: `[${percent}%] ${translateImportProgressMessage(event.message, t)}`,
              });
            } else if (event.type === "done") {
              lastResult = event.importResult ?? null;
              dispatch({
                type: "PORTFOLIO_IMPORT_SUCCESS",
                message: translateImportProgressMessage(event.message, t),
              });
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== line) {
              throw parseError;
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === "done") {
            lastResult = event.importResult ?? null;
            dispatch({
              type: "PORTFOLIO_IMPORT_SUCCESS",
              message: translateImportProgressMessage(event.message, t),
            });
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        } catch {
          /* ignore final parse */
        }
      }

      if (!lastResult) {
        dispatch({
          type: "PORTFOLIO_IMPORT_SUCCESS",
          message: t("inventoryScanner.apiErrors.successSaveToPortfolio", "Inventory saved to personal portfolio."),
        });
      }
    } catch (error) {
      dispatch({
        type: "PORTFOLIO_IMPORT_FAILURE",
        error:
          error instanceof Error
            ? translateImportProgressMessage(error.message, t)
            : t("inventoryScanner.apiErrors.errSaveToPortfolio", "Cannot save inventory to portfolio."),
      });
    }
  }, [accounts, mergedRaw, applyBuffPricing, dispatch]);

  return { importInventoryToPortfolio };
}
