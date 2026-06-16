"use client";

import { useEffect, useRef } from "react";
import type { ScanResultItem } from "../types";
import type { ScannerAction } from "../scanner-reducer";

interface UseScannerAutoRetryProps {
  dispatch: React.Dispatch<ScannerAction>;
  zeroPricedItems: ScanResultItem[];
  retryingPrices: boolean;
  buffPricesCny: Record<string, number>;
  buffCnyToVndRate: number;
  isAnyScanPending: boolean;
}

export function useScannerAutoRetry({
  dispatch,
  zeroPricedItems,
  retryingPrices,
  buffPricesCny,
  buffCnyToVndRate,
  isAnyScanPending,
}: UseScannerAutoRetryProps) {
  const autoRetryRoundRef = useRef(0);
  const hasScanCompletedRef = useRef(false);
  const prevScanPendingRef = useRef(false);

  // Transition monitoring to auto-trigger background price retrieval loops
  useEffect(() => {
    if (prevScanPendingRef.current && !isAnyScanPending) {
      hasScanCompletedRef.current = true;
      autoRetryRoundRef.current = 0;
      dispatch({ type: "PRICE_RETRY_STATUS", status: "" });
    }
    prevScanPendingRef.current = isAnyScanPending;
  }, [isAnyScanPending, dispatch]);

  // Automatic retry loops for items returned with 0 VND values
  const MAX_AUTO_RETRY_ROUNDS = 15;
  const AUTO_RETRY_COOLDOWN_MS = 5_000;

  useEffect(() => {
    if (!hasScanCompletedRef.current) return;
    if (retryingPrices) return;
    if (zeroPricedItems.length === 0) {
      if (autoRetryRoundRef.current > 0) {
        dispatch({
          type: "PRICE_RETRY_STATUS",
          status: "Đã cập nhật giá cho tất cả item!",
        });
      }
      return;
    }
    if (autoRetryRoundRef.current >= MAX_AUTO_RETRY_ROUNDS) {
      dispatch({
        type: "PRICE_RETRY_STATUS",
        status: `Đã thử ${MAX_AUTO_RETRY_ROUNDS} lần, còn ${zeroPricedItems.length} item vẫn 0đ. Steam có thể không có giá cho các item này.`,
      });
      return;
    }

    const round = autoRetryRoundRef.current + 1;
    const delay = round === 1 ? 500 : AUTO_RETRY_COOLDOWN_MS;

    const timer = setTimeout(async () => {
      const itemsToRetry = zeroPricedItems.filter((item: ScanResultItem) => {
        if (
          item.type === "Skin" &&
          buffPricesCny[item.caseItem.marketHashName] > 0
        )
          return false;
        return true;
      });
      if (!itemsToRetry.length) return;

      autoRetryRoundRef.current = round;
      dispatch({ type: "START_PRICE_RETRY" });
      dispatch({
        type: "PRICE_RETRY_STATUS",
        status: `Lần ${round}/${MAX_AUTO_RETRY_ROUNDS}: đang lấy giá ${itemsToRetry.length} item...`,
      });

      try {
        const res = await fetch("/api/inventory/retry-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketHashNames: itemsToRetry.map(
              (i: ScanResultItem) => i.caseItem.marketHashName,
            ),
          }),
        });
        const resText = await res.text();
        interface PriceRetryResponse {
          results?: Array<{
            marketHashName: string;
            price: number;
            priceSource?: string;
          }>;
        }
        let data: PriceRetryResponse | null = null;
        try {
          data = JSON.parse(resText) as PriceRetryResponse;
        } catch {
          // ignore
        }

        if (res.ok && data && Array.isArray(data.results)) {
          const matchedCount = data.results.filter(
            (r: { price: number }) => r.price > 0,
          ).length;
          const remaining = itemsToRetry.length - matchedCount;
          const statusText = `Lần ${round}: cập nhật ${matchedCount}/${
            itemsToRetry.length
          } item.${remaining > 0 ? ` Còn ${remaining} item, đang chờ retry tiếp...` : ""}`;

          dispatch({
            type: "PRICE_RETRY_SUCCESS",
            results: data.results,
            status: statusText,
          });
        } else {
          dispatch({
            type: "PRICE_RETRY_FAILURE",
            status: `Lần ${round}: lỗi phản hồi từ API, sẽ thử lại...`,
          });
        }
      } catch {
        dispatch({
          type: "PRICE_RETRY_FAILURE",
          status: `Lần ${round}: lỗi kết nối, sẽ thử lại...`,
        });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    zeroPricedItems,
    retryingPrices,
    buffPricesCny,
    buffCnyToVndRate,
    dispatch,
  ]);
}
