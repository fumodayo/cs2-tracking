import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useSession } from "@/components/auth/use-session";
import {
  AccountEntry,
  CaseItemData,
  ScanProgress,
  ScanResponse,
  ScanResultItem,
} from "./types";
import {
  LS_ACCOUNTS,
  LS_BUFF_PRICES_CNY,
  LS_MANUAL_ITEMS,
  SCAN_REQUEST_TIMEOUT_MS,
  createAccount,
  extractSteamKey,
  fetchWithTimeout,
  getInventoryItemType,
  getSourceAccountsForItem,
  readRate,
  LS_RATE_ALL,
  LS_RATE_LE,
  LS_BUFF_CNY_TO_VND_RATE,
  DEFAULT_BUFF_CNY_TO_VND_RATE,
} from "./utils";

import {
  ScannerState,
  ScannerAction,
  initScannerState,
  scannerReducer,
} from "./scanner-reducer";

export function useInventoryScanner() {
  const [state, dispatch] = useReducer(scannerReducer, null, initScannerState);

  // Separate non-reducer rates state to avoid massive reducer configuration
  const [rateAll, setRateAll] = useState(() => readRate(LS_RATE_ALL, 60));
  const [rateLe, setRateLe] = useState(() => readRate(LS_RATE_LE, 65));
  const [buffCnyToVndRate, setBuffCnyToVndRate] = useState(() =>
    readRate(LS_BUFF_CNY_TO_VND_RATE, DEFAULT_BUFF_CNY_TO_VND_RATE),
  );

  const [isLoaded, setIsLoaded] = useState(false);

  const { user, googleConfigured } = useSession();

  const autoRetryRoundRef = useRef(0);
  const hasScanCompletedRef = useRef(false);

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

  useEffect(() => {
    localStorage.setItem(LS_RATE_ALL, String(rateAll));
  }, [rateAll]);

  useEffect(() => {
    localStorage.setItem(LS_RATE_LE, String(rateLe));
  }, [rateLe]);

  useEffect(() => {
    localStorage.setItem(LS_BUFF_CNY_TO_VND_RATE, String(buffCnyToVndRate));
  }, [buffCnyToVndRate]);

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
    async (jobId: string, accountId: string): Promise<ScanProgress> => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < SCAN_REQUEST_TIMEOUT_MS) {
        const response = await fetch(
          `/api/inventory/scan?jobId=${encodeURIComponent(jobId)}`,
          {
            cache: "no-store",
          },
        );

        const responseText = await response.text();
        let progress: ScanProgress;
        try {
          progress = JSON.parse(responseText) as ScanProgress;
        } catch (e) {
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

        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      throw new Error("Quét inventory quá lâu. Hãy thử lại sau.");
    },
    [],
  );

  /**
   * Executes a full scanning sequence for a specific profile url.
   */
  const doScan = useCallback(
    async (
      accountId: string,
      forceRefresh: boolean,
      currentAccounts: AccountEntry[],
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

      dispatch({ type: "START_SCAN", accountId });

      try {
        const res = await fetchWithTimeout(
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
          },
          SCAN_REQUEST_TIMEOUT_MS,
        );
        const resText = await res.text();
        let data: any;
        try {
          data = JSON.parse(resText);
        } catch (e) {
          throw new Error(`Yêu cầu quét thất bại (HTTP ${res.status})`);
        }
        if (!res.ok) throw new Error(data.message || "Yêu cầu quét thất bại.");

        const scanProgress = await pollScanProgress(
          String(data.jobId),
          accountId,
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
      } catch (err) {
        dispatch({
          type: "SCAN_FAILURE",
          accountId,
          error: err instanceof Error ? err.message : "Lỗi",
        });
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

      dispatch({ type: "SET_SCANNING_ALL", scanning: true });
      try {
        dispatch({ type: "RESET_REMOVED_KEYS" });
        for (let i = 0; i < valid.length; i++) {
          await doScan(valid[i].id, forceRefresh, state.accounts);
          if (i < valid.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } finally {
        dispatch({ type: "SET_SCANNING_ALL", scanning: false });
      }
    },
    [state.accounts, doScan],
  );

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
        let data: any;
        try {
          data = JSON.parse(resText);
        } catch (e) {
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

  const setSelectedTypes = useCallback((_v: Set<string>) => {
    // Dispatch is cleaner than multiple state updates. Since selectedTypes is a Set,
    // we manage it through specialized actions or replace it entirely.
    // For simplicity, let's keep Set selection inside state or reducer directly.
    // We can just add/delete directly inside our UI or clear it.
    // Let's create an action that resets or toggles the set.
    // To support set replacing directly:
    // Let's toggle or clear. Or we can add an action:
    // type: "SET_TYPE_FILTERS", selectedTypes: Set<string>
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

  /**
   * Applies third-party BUFF163 exchange calculations to a scanned item.
   */
  const applyBuffPricing = useCallback(
    (item: ScanResultItem): ScanResultItem => {
      if (item.type !== "Skin") {
        return item;
      }

      const buffPriceCny = state.buffPricesCny[item.caseItem.marketHashName];
      if (!Number.isFinite(buffPriceCny) || buffPriceCny <= 0) {
        return { ...item, buffPriceCny: undefined };
      }

      const price = Math.round(buffPriceCny * buffCnyToVndRate);
      return {
        ...item,
        price,
        total: price * item.quantity,
        buffPriceCny,
        priceSource: "buff163",
      };
    },
    [buffCnyToVndRate, state.buffPricesCny],
  );

  // Aggregated data derivation using useMemo
  const mergedRaw = useMemo(() => {
    const done = state.accounts
      .filter((a) => a.status === "done" && a.result)
      .map((a) => a.result!);
    const hasScanned = done.length > 0;
    const hasManual = state.manualItems.length > 0;
    if (!hasScanned && !hasManual) return null;

    const map = new Map<string, ScanResultItem>();
    for (const r of done) {
      for (const item of r.items) {
        if (state.removedKeys.has(item.caseItem.marketHashName)) continue;
        const k = item.caseItem.marketHashName;

        const isMarket = !!item.onMarket;
        const isProtected = !!item.tradeProtected;
        const isHold = !isProtected && !!item.holdDays && item.holdDays > 0;
        const isTradeable = !isMarket && !isProtected && !isHold;

        const sourceAccount = {
          steamId64: r.steamId64,
          name: r.profile?.name || r.steamId64,
          quantity: item.quantity,
          breakdown: {
            tradeable: isTradeable ? item.quantity : 0,
            onMarket: isMarket ? item.quantity : 0,
            tradeProtected: isProtected ? item.quantity : 0,
            hold: isHold ? item.quantity : 0,
            holdDetails:
              isHold || isProtected
                ? [{ quantity: item.quantity, holdDays: item.holdDays || 0 }]
                : [],
          },
        };

        const ex = map.get(k);
        if (ex) {
          ex.quantity += item.quantity;
          ex.total += item.total;
          ex.holdDays =
            Math.max(ex.holdDays ?? 0, item.holdDays ?? 0) || undefined;

          if (item.onMarket) ex.onMarket = true;
          if (item.tradeProtected) ex.tradeProtected = true;

          const sourceAccounts = [...(ex.sourceAccounts ?? [])];
          const existingAccount = sourceAccounts.find(
            (account) => account.steamId64 === sourceAccount.steamId64,
          );
          if (existingAccount) {
            existingAccount.quantity =
              (existingAccount.quantity ?? 0) + item.quantity;
            if (!existingAccount.breakdown) {
              existingAccount.breakdown = {
                tradeable: 0,
                onMarket: 0,
                tradeProtected: 0,
                hold: 0,
                holdDetails: [],
              };
            }
            existingAccount.breakdown.tradeable +=
              sourceAccount.breakdown.tradeable;
            existingAccount.breakdown.onMarket +=
              sourceAccount.breakdown.onMarket;
            existingAccount.breakdown.tradeProtected +=
              sourceAccount.breakdown.tradeProtected;
            existingAccount.breakdown.hold += sourceAccount.breakdown.hold;
            if (sourceAccount.breakdown.holdDetails.length > 0) {
              existingAccount.breakdown.holdDetails = [
                ...(existingAccount.breakdown.holdDetails || []),
                ...sourceAccount.breakdown.holdDetails,
              ];
            }
          } else {
            sourceAccounts.push(sourceAccount);
          }
          ex.sourceAccounts = sourceAccounts;
        } else {
          map.set(k, {
            ...item,
            sourceAccounts: [sourceAccount],
            onMarket: isMarket ? true : undefined,
            tradeProtected: isProtected ? true : undefined,
          });
        }
      }
    }

    const scannedItems = Array.from(map.values());
    const items = [...state.manualItems, ...scannedItems];
    return {
      items,
      scannedItems,
      totalInventoryCount: done.reduce(
        (s: number, r: ScanResponse) => s + r.totalInventoryCount,
        0,
      ),
      accountCount: done.length,
    };
  }, [state.accounts, state.manualItems, state.removedKeys]);

  const merged = useMemo(() => {
    if (!mergedRaw) return null;
    const pricedItems = mergedRaw.items.map(applyBuffPricing);
    const pricedScannedItems = mergedRaw.scannedItems.map(applyBuffPricing);
    const items = pricedItems.filter(
      (i) => state.selectedTypes.size === 0 || state.selectedTypes.has(i.type),
    );
    const scannedItems = pricedScannedItems.filter(
      (i) => state.selectedTypes.size === 0 || state.selectedTypes.has(i.type),
    );
    return {
      ...mergedRaw,
      items,
      scannedItems,
      totalPrice: items.reduce(
        (s: number, i: ScanResultItem) => s + i.total,
        0,
      ),
      totalQuantity: items.reduce(
        (s: number, i: ScanResultItem) => s + i.quantity,
        0,
      ),
    };
  }, [applyBuffPricing, mergedRaw, state.selectedTypes]);

  const totalSi = useMemo(() => {
    if (!merged?.items) return 0;
    return merged.items.reduce((sum: number, item: ScanResultItem) => {
      return (
        sum +
        (item.priceSource === "buff163"
          ? item.total
          : (item.total * rateAll) / 100)
      );
    }, 0);
  }, [merged, rateAll]);

  const totalLe = useMemo(() => {
    if (!merged?.items) return 0;
    return merged.items.reduce((sum: number, item: ScanResultItem) => {
      return (
        sum +
        (item.priceSource === "buff163"
          ? item.total
          : (item.total * rateLe) / 100)
      );
    }, 0);
  }, [merged, rateLe]);

  const filteredManualItems = useMemo(() => {
    const query = state.globalFilter.trim().toLowerCase();
    const items = state.manualItems
      .filter(
        (i) =>
          state.selectedTypes.size === 0 || state.selectedTypes.has(i.type),
      )
      .map(applyBuffPricing);
    if (!query) return items;
    return items.filter((i) => i.caseItem.name.toLowerCase().includes(query));
  }, [
    state.manualItems,
    state.globalFilter,
    state.selectedTypes,
    applyBuffPricing,
    buffCnyToVndRate,
    state.buffPricesCny,
  ]);

  const isAnyScanPending = state.accounts.some((a) => a.status === "scanning");
  const hasValidUrls = state.accounts.some((a) => a.url.trim());
  const zeroPricedItems = useMemo(
    () => merged?.items.filter((item: ScanResultItem) => item.price <= 0) ?? [],
    [merged],
  );

  // Transition monitoring to auto-trigger background price retrieval loops
  const prevScanPendingRef = useRef(false);
  useEffect(() => {
    if (prevScanPendingRef.current && !isAnyScanPending) {
      hasScanCompletedRef.current = true;
      autoRetryRoundRef.current = 0;
      dispatch({ type: "PRICE_RETRY_STATUS", status: "" });
    }
    prevScanPendingRef.current = isAnyScanPending;
  }, [isAnyScanPending]);

  // Automatic retry loops for items returned with 0 VND values
  const MAX_AUTO_RETRY_ROUNDS = 15;
  const AUTO_RETRY_COOLDOWN_MS = 5_000;

  useEffect(() => {
    if (!hasScanCompletedRef.current) return;
    if (state.retryingPrices) return;
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
          state.buffPricesCny[item.caseItem.marketHashName] > 0
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
        let data: any;
        try {
          data = JSON.parse(resText);
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
    state.retryingPrices,
    state.buffPricesCny,
    buffCnyToVndRate,
  ]);

  /**
   * Imports all scanned items directly to user's personal tracking portfolio.
   */
  const importInventoryToPortfolio = useCallback(async () => {
    const items = (mergedRaw?.items ?? []).map(applyBuffPricing);
    if (!items.length) return;

    const doneAccounts = state.accounts
      .filter((a) => a.status === "done" && a.result)
      .map((a) => a.result!);

    const itemsWithAccounts = items.map((item: ScanResultItem) => ({
      ...item,
      sourceAccounts: item.sourceAccounts || [],
    }));

    const accountsWithCookies = state.accounts
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
  }, [state.accounts, mergedRaw, applyBuffPricing]);

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
