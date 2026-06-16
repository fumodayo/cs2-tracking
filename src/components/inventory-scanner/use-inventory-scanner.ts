import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSession } from "@/components/auth/use-session";
import { toast } from "@/stores";
import {
  AccountEntry,
  CaseItemData,
  ScanProgress,
  ScanResultItem,
} from "./types";
import {
  LS_ACCOUNTS,
  LS_BUFF_PRICES_CNY,
  LS_MANUAL_ITEMS,
  SCAN_REQUEST_TIMEOUT_MS,
  createAccount,
  extractSteamKey,
  LS_RATE_ALL,
  LS_RATE_LE,
  LS_BUFF_CNY_TO_VND_RATE,
  DEFAULT_BUFF_CNY_TO_VND_RATE,
} from "./utils";

import {
  initScannerState,
  scannerReducer,
} from "./scanner-reducer";

import { useScannerDataMerged } from "./hooks/use-scanner-data-merged";
import { useScannerAutoRetry } from "./hooks/use-scanner-auto-retry";
import { useScannerPortfolioImport } from "./hooks/use-scanner-portfolio-import";

export function useInventoryScanner() {
  const [state, dispatch] = useReducer(scannerReducer, null, initScannerState);

  // Separate non-reducer rates state using useLocalStorage
  const [rateAll, setRateAll] = useLocalStorage<number>(LS_RATE_ALL, 60);
  const [rateLe, setRateLe] = useLocalStorage<number>(LS_RATE_LE, 65);
  const [buffCnyToVndRate, setBuffCnyToVndRate] = useLocalStorage<number>(
    LS_BUFF_CNY_TO_VND_RATE,
    DEFAULT_BUFF_CNY_TO_VND_RATE,
  );

  const [isLoaded, setIsLoaded] = useState(false);

  const { user, googleConfigured } = useSession();

  const scanAbortControllerRef = useRef<AbortController | null>(null);

  // Load persisted state from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    let savedAccs: AccountEntry[] | null = null;
    let savedManual: ScanResultItem[] | null = null;
    let savedBuffPrices: Record<string, number> | null = null;

    try {
      const raw = localStorage.getItem(LS_ACCOUNTS);
      if (raw) savedAccs = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    try {
      const raw = localStorage.getItem(LS_MANUAL_ITEMS);
      if (raw) savedManual = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    try {
      const raw = localStorage.getItem(LS_BUFF_PRICES_CNY);
      if (raw) savedBuffPrices = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    dispatch({
      type: "INIT_LOAD",
      accounts: savedAccs ?? [createAccount("")],
      manualItems: savedManual ?? [],
      buffPricesCny: savedBuffPrices ?? {},
    });
    setIsLoaded(true);
  }, []);

  // Sync to LocalStorage on updates (only after initial load to avoid overwriting)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(state.accounts));
  }, [state.accounts, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LS_MANUAL_ITEMS, JSON.stringify(state.manualItems));
  }, [state.manualItems, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(
      LS_BUFF_PRICES_CNY,
      JSON.stringify(state.buffPricesCny),
    );
  }, [state.buffPricesCny, isLoaded]);



  // Reducer Dispatch Wrappers
  const updateAccountUrl = useCallback((id: string, url: string) => {
    dispatch({ type: "UPDATE_ACCOUNT_URL", id, url });
  }, []);

  const updateAccountCookie = useCallback((id: string, cookie: string) => {
    dispatch({ type: "UPDATE_ACCOUNT_COOKIE", id, cookie });
  }, []);

  const updateAccountSessionId = useCallback(
    (id: string, sessionId: string) => {
      dispatch({ type: "UPDATE_ACCOUNT_SESSION_ID", id, sessionId });
    },
    [],
  );

  const removeAccount = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ACCOUNT", id });
  }, []);

  const addAccount = useCallback(() => {
    dispatch({ type: "ADD_ACCOUNT" });
  }, []);

  const findUrlDuplicate = useCallback(
    (
      accountId: string,
      url: string,
      currentAccounts: AccountEntry[],
    ): AccountEntry | undefined => {
      const key = extractSteamKey(url);
      if (!key) return undefined;
      return currentAccounts.find(
        (a) => a.id !== accountId && extractSteamKey(a.url) === key,
      );
    },
    [],
  );

  /**
   * Periodically polls progress on the server for a queued background scan job.
   */
  const pollScanProgress = useCallback(
    async (
      jobId: string,
      accountId: string,
      signal?: AbortSignal,
    ): Promise<ScanProgress> => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < SCAN_REQUEST_TIMEOUT_MS) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const response = await fetch(
          `/api/inventory/scan?jobId=${encodeURIComponent(jobId)}`,
          {
            cache: "no-store",
            signal,
          },
        );

        const responseText = await response.text();
        let progress: ScanProgress;
        try {
          progress = JSON.parse(responseText) as ScanProgress;
        } catch {
          throw new Error(
            `Không thể kết nối đến máy chủ định giá (HTTP ${response.status}).`,
          );
        }

        if (!response.ok) {
          throw new Error(progress.message ?? "Không thể đọc tiến độ quét.");
        }

        dispatch({ type: "UPDATE_SCAN_PROGRESS", accountId, progress });
        if (progress.status === "done" || progress.status === "error") {
          return progress;
        }

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve();
          }, 900);

          const onAbort = () => {
            clearTimeout(timeout);
            if (signal) signal.removeEventListener("abort", onAbort);
            reject(new DOMException("Aborted", "AbortError"));
          };

          if (signal) {
            if (signal.aborted) {
              onAbort();
            } else {
              signal.addEventListener("abort", onAbort);
            }
          }
        });
      }

      throw new Error("Quét inventory quá lâu. Hãy thử lại sau.");
    },
    [],
  );

  const doScan = useCallback(
    async (
      accountId: string,
      forceRefresh: boolean,
      currentAccounts: AccountEntry[],
      signal?: AbortSignal,
      isPartOfScanAll = false,
    ) => {
      const account = currentAccounts.find((a) => a.id === accountId);
      if (!account || !account.url.trim()) return;

      const urlDupe = findUrlDuplicate(accountId, account.url, currentAccounts);
      if (urlDupe) {
        const dupeIdx = currentAccounts.indexOf(urlDupe) + 1;
        const dupeName = urlDupe.result?.profile?.name || `TK ${dupeIdx}`;
        dispatch({
          type: "SCAN_FAILURE",
          accountId,
          error: `URL trùng với "${dupeName}". Vui lòng nhập tài khoản khác.`,
        });
        return;
      }

      let activeSignal = signal;
      if (!activeSignal) {
        scanAbortControllerRef.current = new AbortController();
        activeSignal = scanAbortControllerRef.current.signal;
      }

      let toastId: string | null = null;
      if (!isPartOfScanAll) {
        toastId = toast.loading("Đang quét hòm đồ...");
      }

      dispatch({ type: "START_SCAN", accountId });

      try {
        if (activeSignal?.aborted) throw new DOMException("Aborted", "AbortError");

        const res = await fetch(
          "/api/inventory/scan",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              steamUrl: account.url.trim(),
              steamCookie: account.steamCookie?.trim() || undefined,
              steamSessionId: account.steamSessionId?.trim() || undefined,
              forceRefresh,
              progress: true,
            }),
            signal: activeSignal,
          }
        );

        const resText = await res.text();
        interface ScanStartResponse {
          message?: string;
          jobId?: string | number;
        }
        let data: ScanStartResponse;
        try {
          data = JSON.parse(resText) as ScanStartResponse;
        } catch {
          throw new Error(`Yêu cầu quét thất bại (HTTP ${res.status})`);
        }
        if (!res.ok) throw new Error(data.message || "Yêu cầu quét thất bại.");

        const scanProgress = await pollScanProgress(
          String(data.jobId),
          accountId,
          activeSignal,
        );
        if (scanProgress.status === "error" || !scanProgress.result) {
          throw new Error(
            scanProgress.error ??
              scanProgress.message ??
              "Không thể quét inventory.",
          );
        }
        const scanResult = scanProgress.result;

        dispatch({
          type: "SCAN_SUCCESS",
          accountId,
          result: scanResult,
          progress: scanProgress,
        });

        if (toastId) {
          toast.dismiss(toastId);
          toast.success("Quét hòm đồ thành công!");
        }
      } catch (err) {
        if (toastId) {
          toast.dismiss(toastId);
          if (err instanceof DOMException && err.name === "AbortError") {
            toast.info("Đã dừng quét.");
          } else {
            toast.error(err instanceof Error ? err.message : "Quét thất bại.");
          }
        }

        if (err instanceof DOMException && err.name === "AbortError") {
          dispatch({
            type: "CANCEL_SCAN",
            accountId,
          });
        } else {
          dispatch({
            type: "SCAN_FAILURE",
            accountId,
            error: err instanceof Error ? err.message : "Lỗi",
          });
        }
      }
    },
    [findUrlDuplicate, pollScanProgress],
  );

  /**
   * Triggers sequence scanner execution for all configured profiles.
   */
  const scanAll = useCallback(
    async (forceRefresh = false) => {
      const valid = state.accounts.filter((a) => a.url.trim());
      if (!valid.length) return;

      scanAbortControllerRef.current = new AbortController();
      const signal = scanAbortControllerRef.current.signal;

      const toastId = toast.loading("Đang tiến hành quét toàn bộ hòm đồ...");

      dispatch({ type: "SET_SCANNING_ALL", scanning: true });
      try {
        dispatch({ type: "RESET_REMOVED_KEYS" });
        for (let i = 0; i < valid.length; i++) {
          if (signal.aborted) break;
          await doScan(valid[i].id, forceRefresh, state.accounts, signal, true);
          if (i < valid.length - 1 && !signal.aborted) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                signal.removeEventListener("abort", onAbort);
                resolve();
              }, 500);

              const onAbort = () => {
                clearTimeout(timeout);
                signal.removeEventListener("abort", onAbort);
                reject(new DOMException("Aborted", "AbortError"));
              };

              if (signal.aborted) {
                onAbort();
              } else {
                signal.addEventListener("abort", onAbort);
              }
            });
          }
        }

        if (signal.aborted) {
          toast.dismiss(toastId);
          toast.info("Đã dừng quét toàn bộ.");
        } else {
          toast.dismiss(toastId);
          toast.success("Quét toàn bộ hòm đồ hoàn tất!");
        }
      } catch (err) {
        toast.dismiss(toastId);
        if (err instanceof DOMException && err.name === "AbortError") {
          toast.info("Đã dừng quét toàn bộ.");
        } else {
          toast.error("Quét thất bại: " + (err instanceof Error ? err.message : "Lỗi"));
        }
      } finally {
        dispatch({ type: "SET_SCANNING_ALL", scanning: false });
      }
    },
    [state.accounts, doScan],
  );

  const cancelScanAll = useCallback(() => {
    scanAbortControllerRef.current?.abort();
  }, []);

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
        id: `manual-${Date.now()}-${Math.random()}`,
      });
    },
    [],
  );

  const updateManualItemQty = useCallback((idOrName: string, qty: number) => {
    dispatch({ type: "UPDATE_MANUAL_QTY", idOrName, qty });
  }, []);

  const removeItem = useCallback(
    (marketHashName: string, isManual?: boolean, id?: string) => {
      dispatch({ type: "REMOVE_ITEM", marketHashName, isManual, id });
    },
    [],
  );

  const updateBuffPriceCny = useCallback(
    (marketHashName: string, rawValue: string) => {
      dispatch({ type: "UPDATE_BUFF_PRICE_CNY", marketHashName, rawValue });
    },
    [],
  );

  /**
   * Fetches latest BUFF163 price for a specific skin market hash name.
   */
  const fetchBuffPrice = useCallback(
    async (marketHashName: string) => {
      dispatch({ type: "START_BUFF_FETCH", marketHashName });

      try {
        const response = await fetch("/api/inventory/buff-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketHashName,
            cnyToVndRate: buffCnyToVndRate,
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
            `Yêu cầu lấy giá BUFF163 thất bại (HTTP ${response.status}).`,
          );
        }

        if (!response.ok) {
          throw new Error(data.message ?? "Không thể lấy giá BUFF163.");
        }

        const priceCny = Number(data.priceCny);
        if (!Number.isFinite(priceCny) || priceCny <= 0) {
          throw new Error("Giá BUFF163 trả về không hợp lệ.");
        }

        dispatch({ type: "BUFF_FETCH_SUCCESS", marketHashName, priceCny });
      } catch (error) {
        dispatch({
          type: "BUFF_FETCH_FAILURE",
          marketHashName,
          error:
            error instanceof Error
              ? error.message
              : "Không thể lấy giá BUFF163.",
        });
      }
    },
    [buffCnyToVndRate],
  );

  const setExpandedAccId = useCallback((id: string | null) => {
    dispatch({ type: "SET_EXPANDED_ACCOUNT", id });
  }, []);

  // For faceted filter toggling
  const toggleTypeFilter = useCallback((itemType: string) => {
    dispatch({ type: "TOGGLE_TYPE_FILTER", itemType });
  }, []);

  const clearTypeFilters = useCallback(() => {
    dispatch({ type: "CLEAR_TYPE_FILTERS" });
  }, []);

  const setGlobalFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_GLOBAL_FILTER", filter });
  }, []);

  // Integration of specialized modular sub-hooks
  const {
    mergedRaw,
    merged,
    totalSi,
    totalLe,
    filteredManualItems,
    zeroPricedItems,
    applyBuffPricing,
  } = useScannerDataMerged({
    accounts: state.accounts,
    manualItems: state.manualItems,
    removedKeys: state.removedKeys,
    selectedTypes: state.selectedTypes,
    globalFilter: state.globalFilter,
    buffPricesCny: state.buffPricesCny,
    buffCnyToVndRate,
    rateAll,
    rateLe,
  });

  const isAnyScanPending = state.accounts.some((a) => a.status === "scanning");
  const hasValidUrls = state.accounts.some((a) => a.url.trim());

  useScannerAutoRetry({
    dispatch,
    zeroPricedItems,
    retryingPrices: state.retryingPrices,
    buffPricesCny: state.buffPricesCny,
    buffCnyToVndRate,
    isAnyScanPending,
  });

  const { importInventoryToPortfolio } = useScannerPortfolioImport({
    dispatch,
    accounts: state.accounts,
    mergedRaw,
    applyBuffPricing,
  });

  return {
    state,
    isLoaded,
    rateAll,
    setRateAll,
    rateLe,
    setRateLe,
    buffCnyToVndRate,
    setBuffCnyToVndRate,
    user,
    googleConfigured,
    updateAccountUrl,
    updateAccountCookie,
    updateAccountSessionId,
    removeAccount,
    addAccount,
    doScan,
    scanAll,
    cancelScanAll,
    addManualItem,
    updateManualItemQty,
    removeItem,
    updateBuffPriceCny,
    fetchBuffPrice,
    importInventoryToPortfolio,
    setExpandedAccId,
    toggleTypeFilter,
    clearTypeFilters,
    setGlobalFilter,
    merged,
    mergedRaw,
    totalSi,
    totalLe,
    filteredManualItems,
    isAnyScanPending,
    hasValidUrls,
    zeroPricedItems,
  };
}
