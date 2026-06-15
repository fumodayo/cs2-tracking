"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useQueryParamsState, type ParamConfig } from "@/hooks/use-query-params";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { ShoppingBag, Users } from "lucide-react";
import { useInventoryScanner } from "./use-inventory-scanner";

import { AddCaseSearch } from "./add-case-search";
import { CookieGuideModal } from "./cookie-guide-modal";
import { ScanResultItem } from "./types";
import { buildInventoryColumns } from "./inventory-scanner-columns";

import { AccountsSection } from "./components/accounts-section";
import { PortfolioSyncSection } from "./components/portfolio-sync-section";
import { PricingStatsGrid } from "./components/pricing-stats-grid";
import { ResultsTable } from "./components/results-table";

const scannerQueryConfig = {
  q: {
    defaultValue: "",
    parse: (val: string | null) => val || "",
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
    parse: (val: string | null) => (val ? val.split(",") : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(",") : null),
  } as ParamConfig<string[]>,
  status: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(",") : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(",") : null),
  } as ParamConfig<string[]>,
  accounts: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(",") : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(",") : null),
  } as ParamConfig<string[]>,
};

export function InventoryScanner() {
  const {
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
  } = useInventoryScanner();

  const [urlState, setters] = useQueryParamsState(scannerQueryConfig);

  const selectedAccounts = urlState.accounts;
  const setSelectedAccounts = setters.accounts;

  const selectedStatuses = urlState.status;
  const setSelectedStatuses = setters.status;

  const pagination = useMemo(
    () => ({
      pageIndex: urlState.page - 1,
      pageSize: urlState.pageSize,
    }),
    [urlState.page, urlState.pageSize],
  );

  const setPagination = useCallback(
    (
      value:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          }),
    ) => {
      if (typeof value === "function") {
        const next = value({
          pageIndex: urlState.page - 1,
          pageSize: urlState.pageSize,
        });
        setters.page(next.pageIndex + 1);
        setters.pageSize(next.pageSize);
      } else {
        setters.page(value.pageIndex + 1);
        setters.pageSize(value.pageSize);
      }
    },
    [urlState.page, urlState.pageSize, setters],
  );

  // Bidirectional sync between URL parameters and useInventoryScanner reducer state
  useEffect(() => {
    if (state.globalFilter !== urlState.q) {
      setters.q(state.globalFilter);
    }
  }, [state.globalFilter, urlState.q, setters]);

  const selectedTypesArr = useMemo(
    () => Array.from(state.selectedTypes).sort(),
    [state.selectedTypes],
  );
  useEffect(() => {
    const targetTypeArr = urlState.type.slice().sort();
    if (JSON.stringify(selectedTypesArr) !== JSON.stringify(targetTypeArr)) {
      setters.type(selectedTypesArr);
    }
  }, [selectedTypesArr, urlState.type, setters]);

  useEffect(() => {
    if (urlState.q !== state.globalFilter) {
      setGlobalFilter(urlState.q);
    }
  }, [urlState.q, state.globalFilter, setGlobalFilter]);

  useEffect(() => {
    const targetSet = new Set(urlState.type);
    const setsEqual =
      state.selectedTypes.size === targetSet.size &&
      Array.from(state.selectedTypes).every((v) => targetSet.has(v));
    if (!setsEqual) {
      clearTypeFilters();
      urlState.type.forEach((t) => toggleTypeFilter(t));
    }
  }, [urlState.type, state.selectedTypes, toggleTypeFilter, clearTypeFilters]);

  // Reset pagination to first page when search filters change
  useEffect(() => {
    if (urlState.page !== 1) {
      setters.page(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState.q, urlState.type, urlState.status, urlState.accounts, setters]);
  const [showCookieGuide, setShowCookieGuide] = useState<boolean>(false);

  const accountOptions = useMemo(
    () =>
      state.accounts
        .filter((account) => account.status === "done" && account.result)
        .map((account) => ({
          steamId64: account.result!.steamId64,
          name: account.result!.profile?.name || account.result!.steamId64,
        }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [state.accounts],
  );

  const filteredScannedItems = useMemo(
    () =>
      (merged?.scannedItems ?? []).filter((item) => {
        // Account filter
        if (selectedAccounts.length > 0) {
          const matchesAccount =
            item.sourceAccounts?.some((account) =>
              selectedAccounts.includes(account.steamId64),
            ) ?? false;
          if (!matchesAccount) return false;
        }
        // Hold status filter
        if (selectedStatuses.length > 0) {
          const statuses = new Set<string>();
          if (item.sourceAccounts) {
            for (const acc of item.sourceAccounts) {
              if (acc.breakdown) {
                if (acc.breakdown.tradeable > 0) statuses.add("tradeable");
                if (acc.breakdown.onMarket > 0) statuses.add("market");
                if (acc.breakdown.tradeProtected > 0) statuses.add("protected");
                if (acc.breakdown.hold > 0) statuses.add("hold");
              }
            }
          }
          // If no breakdown data, treat as tradeable
          if (statuses.size === 0) statuses.add("tradeable");
          const matchesStatus = selectedStatuses.some((s) => statuses.has(s));
          if (!matchesStatus) return false;
        }
        return true;
      }),
    [selectedAccounts, selectedStatuses, merged?.scannedItems],
  );

  const visibleManualItems =
    selectedAccounts.length === 0 ? filteredManualItems : [];

  /**
   * Defines TanStack Table columns, linking custom cells with action callbacks
   * and complex multi-source Buff & Steam pricing models.
   */
  const columns = useMemo<ColumnDef<ScanResultItem>[]>(
    () =>
      buildInventoryColumns({
        buffLoadingKeys: state.buffLoadingKeys,
        buffPricesCny: state.buffPricesCny,
        buffPriceErrors: state.buffPriceErrors,
        fetchBuffPrice,
        updateBuffPriceCny,
        buffCnyToVndRate,
        rateAll,
        rateLe,
        removeItem,
        mergedRawItems: mergedRaw?.items,
      }),
    [
      buffCnyToVndRate,
      state.buffLoadingKeys,
      state.buffPriceErrors,
      state.buffPricesCny,
      fetchBuffPrice,
      updateBuffPriceCny,
      rateAll,
      rateLe,
      removeItem,
      mergedRaw,
    ],
  );

  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    rateAll: false,
    rateLe: false,
  });
  const [isColumnVisibilityLoaded, setIsColumnVisibilityLoaded] =
    useState(false);

  // Load column visibility from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cs2t_scanner_columnVisibility");
      if (saved) {
        setColumnVisibility(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load scanner column visibility", e);
    }
    setIsColumnVisibilityLoaded(true);
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (isColumnVisibilityLoaded) {
      localStorage.setItem(
        "cs2t_scanner_columnVisibility",
        JSON.stringify(columnVisibility),
      );
    }
  }, [columnVisibility, isColumnVisibilityLoaded]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredScannedItems,
    columns,
    state: {
      globalFilter: state.globalFilter,
      columnVisibility,
      pagination,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    initialState: {
      sorting: [{ id: "total", desc: true }],
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;
      return [
        row.original.caseItem.name,
        row.original.caseItem.marketHashName,
        row.original.type,
        ...(row.original.sourceAccounts ?? []).map((account) => account.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <main className="min-h-screen">
      <section className="relative min-h-[16rem] overflow-hidden border-b border-stone-800">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/assets/dashboard-banner.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f0f] via-[#0e0f0f]/84 to-[#0e0f0f]/20" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-16 pb-8 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-blue-300 uppercase">
              Công cụ CS2
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-stone-50 sm:text-5xl">
              Quét hòm đồ Steam
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
              Nhập một hoặc nhiều link profile Steam để quét case, capsule,
              sticker và tính tổng giá trị gộp từ nhiều tài khoản.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AccountsSection
          isLoaded={isLoaded}
          accounts={state.accounts}
          scanningAll={state.scanningAll}
          isAnyScanPending={isAnyScanPending}
          hasValidUrls={hasValidUrls}
          expandedAccId={state.expandedAccId}
          setExpandedAccId={setExpandedAccId}
          cancelScanAll={cancelScanAll}
          scanAll={scanAll}
          doScan={doScan}
          removeAccount={removeAccount}
          updateAccountUrl={updateAccountUrl}
          updateAccountCookie={updateAccountCookie}
          updateAccountSessionId={updateAccountSessionId}
          addAccount={addAccount}
          setShowCookieGuide={setShowCookieGuide}
        />

        {merged && (
          <div className="space-y-6">
            {merged.accountCount > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-950/20 px-5 py-3.5 text-sm text-sky-200">
                <Users className="size-4 text-sky-400" />
                <span>
                  Kết quả gộp từ{" "}
                  <span className="font-semibold text-sky-100">
                    {merged.accountCount} tài khoản
                  </span>
                  {state.manualItems.length > 0 && (
                    <>
                      {" "}
                      +{" "}
                      <span className="font-semibold text-sky-100">
                        {state.manualItems.length} item thủ công
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}

            <PortfolioSyncSection
              user={user}
              googleConfigured={googleConfigured}
              importInventoryToPortfolio={importInventoryToPortfolio}
              portfolioImporting={state.portfolioImporting}
              portfolioImportStatus={state.portfolioImportStatus}
              portfolioImportMessage={state.portfolioImportMessage}
              portfolioImportError={state.portfolioImportError}
              hasItemsToImport={!!mergedRaw?.items.length}
              zeroPricedItems={zeroPricedItems}
              retryingPrices={state.retryingPrices}
              retryStatus={state.retryStatus}
            />

            {merged.items.length > 0 && !state.scanningAll && !isAnyScanPending && (
              <div className="mb-4 flex justify-end">
                <AddCaseSearch
                  onAdd={addManualItem}
                  scannedAccounts={state.accounts
                    .filter((a) => a.status === "done" && a.result?.profile)
                    .map((a) => ({
                      steamId64: a.result!.steamId64,
                      name: a.result!.profile.name,
                    }))}
                  defaultBuffRate={buffCnyToVndRate}
                />
              </div>
            )}

            <PricingStatsGrid
              buffCnyToVndRate={buffCnyToVndRate}
              setBuffCnyToVndRate={setBuffCnyToVndRate}
              rateAll={rateAll}
              setRateAll={setRateAll}
              rateLe={rateLe}
              setRateLe={setRateLe}
              totalPrice={merged.totalPrice}
              totalQuantity={merged.totalQuantity}
              totalInventoryCount={merged.totalInventoryCount}
              totalSi={totalSi}
              totalLe={totalLe}
            />

            {merged.items.length > 0 ? (
              <ResultsTable
                table={table}
                globalFilter={state.globalFilter}
                setGlobalFilter={setGlobalFilter}
                selectedTypes={state.selectedTypes}
                clearTypeFilters={clearTypeFilters}
                toggleTypeFilter={toggleTypeFilter}
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                selectedAccounts={selectedAccounts}
                setSelectedAccounts={setSelectedAccounts}
                accountOptions={accountOptions}
                visibleManualItems={visibleManualItems}
                updateManualItemQty={updateManualItemQty}
                removeItem={removeItem}
                fetchBuffPrice={fetchBuffPrice}
                updateBuffPriceCny={updateBuffPriceCny}
                buffPricesCny={state.buffPricesCny}
                buffPriceErrors={state.buffPriceErrors}
                buffLoadingKeys={state.buffLoadingKeys}
                buffCnyToVndRate={buffCnyToVndRate}
                rateAll={rateAll}
                rateLe={rateLe}
                manualItems={state.manualItems}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-800 bg-stone-900/30 py-16 text-center">
                <ShoppingBag className="mb-4 size-10 text-stone-600" />
                <p className="text-lg font-medium text-stone-300">
                  Không tìm thấy item nào
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {!merged && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <AddCaseSearch onAdd={addManualItem} />
          </div>
        </section>
      )}

      <CookieGuideModal
        open={showCookieGuide}
        onClose={() => setShowCookieGuide(false)}
      />
    </main>
  );
}
