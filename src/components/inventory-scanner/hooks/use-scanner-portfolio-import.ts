"use client";

import { useCallback } from "react";
import type { AccountEntry, ScanResultItem } from "../types";

interface UseScannerPortfolioImportProps {
  dispatch: React.Dispatch<any>;
  accounts: AccountEntry[];
  mergedRaw: any;
  applyBuffPricing: (item: ScanResultItem) => ScanResultItem;
}

export function useScannerPortfolioImport({
  dispatch,
  accounts,
  mergedRaw,
  applyBuffPricing,
}: UseScannerPortfolioImportProps) {
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
        status: "Đang chuẩn bị dữ liệu hòm đồ...",
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
        let errMessage = "Không thể lưu inventory vào portfolio.";
        try {
          const resText = await response.text();
          const errData = JSON.parse(resText);
          errMessage = errData.message || errMessage;
        } catch {
          errMessage = `Không thể lưu portfolio (HTTP ${response.status})`;
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error("Không thể đọc phản hồi từ máy chủ.");
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
                status: `[${percent}%] ${event.message}`,
              });
            } else if (event.type === "done") {
              lastResult = event.importResult ?? null;
              dispatch({
                type: "PORTFOLIO_IMPORT_SUCCESS",
                message: event.message,
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
              message: event.message,
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
          message: "Đã lưu inventory vào portfolio cá nhân.",
        });
      }
    } catch (error) {
      dispatch({
        type: "PORTFOLIO_IMPORT_FAILURE",
        error:
          error instanceof Error
            ? error.message
            : "Không thể lưu inventory vào portfolio.",
      });
    }
  }, [accounts, mergedRaw, applyBuffPricing, dispatch]);

  return { importInventoryToPortfolio };
}
