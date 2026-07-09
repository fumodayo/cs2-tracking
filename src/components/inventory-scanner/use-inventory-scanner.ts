'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useSession } from '@/components/auth/use-session';
import { fetchUserBuffPrices, mergeUserBuffPrices } from '@/lib/api-client/user-buff-prices-api';
import { subscribeUserBuffPricesChanges } from '@/lib/api-client/user-buff-prices-realtime';
import {
  clearLocalBuffPrices,
  hasBuffPrices,
  readLocalBuffPrices,
  writeLocalBuffPrices,
} from '@/utils/buff-prices';
import { AccountEntry, ScanResultItem } from './types';
import {
  LS_ACCOUNTS,
  LS_MANUAL_ITEMS,
  createAccount,
  LS_RATE_ALL,
  LS_RATE_LE,
  LS_BUFF_CNY_TO_VND_RATE,
  DEFAULT_BUFF_CNY_TO_VND_RATE,
} from './utils';

import { initScannerState, scannerReducer } from './scanner-reducer';

import { useScannerDataMerged } from './hooks/use-scanner-data-merged';
import { useScannerAutoRetry } from './hooks/use-scanner-auto-retry';
import { useScannerPortfolioImport } from './hooks/use-scanner-portfolio-import';

import { useScanState } from './hooks/use-scan-state';
import { useManualItems } from './hooks/use-manual-items';
import { useBuffPricing } from './hooks/use-buff-pricing';
import {
  useQueryParamsState,
  type ParamConfig,
  type QueryParamsSetters,
  type QueryParamsState,
} from '@/hooks/use-query-params';

const scannerQueryConfig = {
  q: {
    defaultValue: '',
    parse: (val: string | null) => val || '',
    serialize: (val: string) => val || null,
    debounceMs: 300,
  } as ParamConfig<string>,
  page: {
    defaultValue: 1,
    parse: (val: string | null) => (val ? Math.max(1, parseInt(val, 10)) : 1),
    serialize: (val: number) => (val > 1 ? String(val) : null),
  } as ParamConfig<number>,
  pageSize: {
    defaultValue: 10,
    parse: (val: string | null) => (val ? Math.max(1, parseInt(val, 10)) : 10),
    serialize: (val: number) => (val !== 10 ? String(val) : null),
  } as ParamConfig<number>,
  type: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(',') : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(',') : null),
  } as ParamConfig<string[]>,
  status: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(',') : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(',') : null),
  } as ParamConfig<string[]>,
  accounts: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(',') : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(',') : null),
  } as ParamConfig<string[]>,
  source: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(',') : []),
    serialize: (val: string[]) => (val?.length > 0 ? val.join(',') : null),
  } as ParamConfig<string[]>,
  priceSource: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(',') : []),
    serialize: (val: string[]) => (val?.length > 0 ? val.join(',') : null),
  } as ParamConfig<string[]>,
};

export type ScannerQueryState = QueryParamsState<typeof scannerQueryConfig>;
export type ScannerQuerySetters = QueryParamsSetters<typeof scannerQueryConfig>;

export function useInventoryScanner() {
  const [state, dispatch] = useReducer(scannerReducer, null, initScannerState);
  const [urlState, setters, debouncedUrlState] = useQueryParamsState(scannerQueryConfig);

  // Đồng bộ tham số URL -> state reducer (nguồn sự thật một chiều)
  useEffect(() => {
    if (urlState.q !== state.globalFilter) {
      dispatch({ type: 'SET_GLOBAL_FILTER', filter: urlState.q });
    }
  }, [urlState.q, state.globalFilter]);

  useEffect(() => {
    const targetSet = new Set(urlState.type);
    const setsEqual =
      state.selectedTypes.size === targetSet.size &&
      Array.from(state.selectedTypes).every((v) => targetSet.has(v));
    if (!setsEqual) {
      dispatch({ type: 'CLEAR_TYPE_FILTERS' });
      urlState.type.forEach((t) => {
        dispatch({ type: 'TOGGLE_TYPE_FILTER', itemType: t });
      });
    }
  }, [urlState.type, state.selectedTypes]);

  // Reset tham số URL khi import thành công
  useEffect(() => {
    if (state.portfolioImportMessage) {
      setters.q('');
      setters.type([]);
      setters.source([]);
      setters.priceSource([]);
      setters.page(1);
    }
  }, [state.portfolioImportMessage, setters]);

  // Tách state rate ngoài reducer bằng useLocalStorage
  const [rateAll, setRateAll] = useLocalStorage<number>(LS_RATE_ALL, 60);
  const [rateLe, setRateLe] = useLocalStorage<number>(LS_RATE_LE, 65);
  const [buffCnyToVndRate, setBuffCnyToVndRate] = useLocalStorage<number>(
    LS_BUFF_CNY_TO_VND_RATE,
    DEFAULT_BUFF_CNY_TO_VND_RATE
  );
  const [mode, setMode] = useLocalStorage<'case-summary' | 'transactions'>(
    'cs2t_scanner_mode',
    'case-summary'
  );

  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const { user, googleConfigured, loading: sessionLoading } = useSession();
  const userId = user?.id ?? null;

  const scanAbortControllerRef = useRef<AbortController | null>(null);

  // Nạp state đã lưu từ localStorage sau khi mount để tránh lệch hydration
  useEffect(() => {
    let savedAccs: AccountEntry[] | null = null;
    let savedManual: ScanResultItem[] | null = null;

    try {
      const raw = localStorage.getItem(LS_ACCOUNTS);
      if (raw) savedAccs = JSON.parse(raw);
    } catch {
      /* bỏ qua */
    }

    try {
      const raw = localStorage.getItem(LS_MANUAL_ITEMS);
      if (raw) savedManual = JSON.parse(raw);
    } catch {
      /* bỏ qua */
    }

    dispatch({
      type: 'INIT_LOAD',
      accounts: savedAccs ?? [createAccount('')],
      manualItems: savedManual ?? [],
      buffPricesCny: readLocalBuffPrices(),
    });
    setIsLoaded(true);
  }, []);

  // Đồng bộ vào LocalStorage khi cập nhật, chỉ sau lần nạp đầu để tránh ghi đè
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(state.accounts));
  }, [state.accounts, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LS_MANUAL_ITEMS, JSON.stringify(state.manualItems));
  }, [state.manualItems, isLoaded]);

  useEffect(() => {
    if (!isLoaded || sessionLoading || userId) return;
    writeLocalBuffPrices(state.buffPricesCny);
  }, [state.buffPricesCny, isLoaded, sessionLoading, userId]);

  useEffect(() => {
    if (!isLoaded || sessionLoading) return;

    let cancelled = false;

    async function loadPersistedBuffPrices() {
      if (!userId) {
        dispatch({ type: 'SET_BUFF_PRICES_CNY', buffPricesCny: readLocalBuffPrices() });
        return;
      }

      try {
        const localPrices = readLocalBuffPrices();
        const pricesCny = hasBuffPrices(localPrices)
          ? await mergeUserBuffPrices(localPrices)
          : await fetchUserBuffPrices();

        if (!cancelled) {
          clearLocalBuffPrices();
          dispatch({ type: 'SET_BUFF_PRICES_CNY', buffPricesCny: pricesCny });
        }
      } catch (error) {
        console.error('Failed to load user BUFF prices:', error);
      }
    }

    void loadPersistedBuffPrices();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, sessionLoading, userId]);

  // Sync logged-in BUFF prices across tabs via realtime.
  useEffect(() => {
    if (!isLoaded || sessionLoading || !userId) return;

    let cancelled = false;
    const unsubscribe = subscribeUserBuffPricesChanges(() => {
      void fetchUserBuffPrices()
        .then((pricesCny) => {
          if (cancelled) return;
          clearLocalBuffPrices();
          dispatch({ type: 'SET_BUFF_PRICES_CNY', buffPricesCny: pricesCny });
        })
        .catch((error) => {
          console.error('Failed to refresh realtime BUFF prices:', error);
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isLoaded, sessionLoading, userId]);

  // Cho thao tác bật/tắt faceted filter, được đồng bộ qua state URL
  const toggleTypeFilter = useCallback(
    (itemType: string) => {
      setters.type((prev) => {
        const next = new Set(prev);
        if (next.has(itemType)) {
          next.delete(itemType);
        } else {
          next.add(itemType);
        }
        return Array.from(next);
      });
    },
    [setters]
  );

  const clearTypeFilters = useCallback(() => {
    setters.type([]);
  }, [setters]);

  const setGlobalFilter = useCallback(
    (filter: string) => {
      setters.q(filter);
    },
    [setters]
  );

  const selectedTypesSet = useMemo(() => new Set(urlState.type), [urlState.type]);

  // Tích hợp các sub-hook module chuyên biệt
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
    selectedTypes: selectedTypesSet,
    globalFilter: debouncedUrlState.q,
    buffPricesCny: state.buffPricesCny,
    buffCnyToVndRate,
    rateAll,
    rateLe,
    mode,
  });

  const isAnyScanPending = state.accounts.some((a) => a.status === 'scanning');
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

  // Gọi ba sub-hook mới
  const {
    updateAccountUrl,
    updateAccountCookie,
    updateAccountSessionId,
    removeAccount,
    addAccount,
    doScan,
    scanAll,
    cancelScanAll,
    setExpandedAccId,
  } = useScanState({
    state,
    dispatch,
    scanAbortControllerRef,
  });

  const { addManualItem, updateManualItemQty, updateManualItem, removeItem } = useManualItems({
    dispatch,
  });

  const { updateBuffPriceCny, fetchBuffPrice, refreshPrices } = useBuffPricing({
    state,
    dispatch,
    buffCnyToVndRate,
    isRefreshingPrices,
    setIsRefreshingPrices,
    isAnyScanPending,
    filteredManualItems,
    scannedItems: merged?.scannedItems ?? [],
    isUserAuthenticated: Boolean(userId),
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
    mode,
    setMode,
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
    updateManualItem,
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
    refreshPrices,
    isRefreshingPrices,
    urlState,
    setters,
    debouncedUrlState,
  };
}
