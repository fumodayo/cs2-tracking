"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useQueryParamsState } from "@/hooks/use-query-params";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import * as HoverCard from "@radix-ui/react-hover-card";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Plus,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Trash2,
  Save,
  FolderPlus,
  LogIn,
  RefreshCw,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { useInventoryScanner } from "./use-inventory-scanner";
import { toast } from "@/utils/toast-store";
import { StatCard } from "./stat-card";
import { RateCard } from "./rate-card";
import { BuffRateCard } from "./buff-rate-card";
import { AddCaseSearch } from "./add-case-search";
import { CaseThumbnail } from "../dashboard/case-thumbnail";
import { CookieGuideModal } from "./cookie-guide-modal";
import {
  formatVND,
  formatPlainNumber,
  formatProgressDetail,
  getSteamMarketListingUrl,
  getItemTypeColor,
  colorWithAlpha,
} from "./utils";
import { ScanResultItem, SourceAccount } from "./types";
import {
  FilterPopover,
  CopyButton,
  ViewButton,
  ResetButton,
} from "@/components/ui/actions";
import { Tooltip } from "@/components/ui/tooltip";
import { buildInventoryColumns } from "./inventory-scanner-columns";
import { Button } from "@/components/ui/button";
import { AccountCard } from "./components/account-card";
import { ManualItemRow } from "./components/manual-item-row";
import { TablePagination } from "@/components/shared/table-pagination";

const scannerQueryConfig = {
  q: {
    defaultValue: "",
    parse: (val: string | null) => val || "",
    serialize: (val: string) => val || null,
    debounceMs: 300,
  },
  page: {
    defaultValue: 1,
    parse: (val: string | null) => (val ? Math.max(1, parseInt(val, 10)) : 1),
    serialize: (val: number) => (val > 1 ? String(val) : null),
  },
  pageSize: {
    defaultValue: 10,
    parse: (val: string | null) => (val ? Math.max(1, parseInt(val, 10)) : 10),
    serialize: (val: number) => (val !== 10 ? String(val) : null),
  },
  type: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(",") : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(",") : null),
  },
  status: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(",") : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(",") : null),
  },
  accounts: {
    defaultValue: [] as string[],
    parse: (val: string | null) => (val ? val.split(",") : []),
    serialize: (val: string[]) => (val.length > 0 ? val.join(",") : null),
  },
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
    [urlState.page, urlState.pageSize, setters.page, setters.pageSize],
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
        <div className="mb-8 rounded-xl border border-stone-800 bg-stone-900/50 p-6">
          {!isLoaded ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-stone-500" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wider text-stone-300 uppercase flex items-center gap-2">
                  <Users className="size-4 text-blue-400" />
                  Danh sách tài khoản ({state.accounts.length})
                </h2>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => scanAll(true)}
                  disabled={
                    state.scanningAll || isAnyScanPending || !hasValidUrls
                  }
                  className="h-8 px-4 text-xs font-semibold"
                >
                  {state.scanningAll ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Đang quét...
                    </>
                  ) : (
                    <>
                      <Search className="size-3.5" /> Quét tất cả
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {state.accounts.map((acc, idx) => (
                  <AccountCard
                    key={acc.id}
                    acc={acc}
                    index={idx}
                    isExpandedAccId={state.expandedAccId === acc.id}
                    onToggleExpandAccId={() =>
                      setExpandedAccId(state.expandedAccId === acc.id ? null : acc.id)
                    }
                    isAnyScanPending={isAnyScanPending}
                    onScan={() => doScan(acc.id, true, state.accounts)}
                    onRemove={removeAccount}
                    onUpdateUrl={updateAccountUrl}
                    onUpdateCookie={updateAccountCookie}
                    onUpdateSessionId={updateAccountSessionId}
                    onOpenGuide={() => setShowCookieGuide(true)}
                    accountsLength={state.accounts.length}
                  />
                ))}

                {/* Add Account Dashed Card inside grid */}
                <button
                  type="button"
                  onClick={addAccount}
                  className="border-stone-800 hover:border-blue-500/30 hover:bg-stone-900/10 group flex h-full min-h-[90px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-stone-950/20 p-4 transition-all duration-200"
                >
                  <Plus className="size-5 text-stone-500 transition-transform group-hover:scale-110 group-hover:text-blue-450" />
                  <span className="text-xs font-semibold text-stone-400 group-hover:text-stone-300">
                    Thêm tài khoản
                  </span>
                </button>
              </div>

              {state.accounts
                .filter((a) => a.error)
                .map((a) => (
                  <div
                    key={`err-${a.id}`}
                    className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm text-red-200"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <p>
                      <span className="font-medium">
                        TK {state.accounts.findIndex((x) => x.id === a.id) + 1}:
                      </span>{" "}
                      {a.error}
                    </p>
                  </div>
                ))}
            </>
          )}
        </div>

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

            <div className="relative overflow-hidden flex flex-col gap-4 rounded-xl border border-blue-500/15 bg-gradient-to-r from-blue-950/15 to-stone-900/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between shadow-md transition-all duration-300 hover:border-blue-500/25">
              <div className="absolute -right-6 -top-6 -z-10 h-20 w-20 rounded-full bg-blue-500/5 blur-xl pointer-events-none" />
              <div>
                <p className="text-sm font-bold text-stone-200">
                  Bạn muốn theo dõi giá đồ của mình tăng giảm theo ngày?
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {user
                    ? `Đang lưu portfolio cá nhân cho ${user.email}.`
                    : "Hãy đăng nhập bằng Gmail ngay để đưa kết quả inventory-scanner vào portfolio riêng."}
                </p>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={importInventoryToPortfolio}
                  disabled={
                    state.portfolioImporting || !mergedRaw?.items.length
                  }
                  className="shrink-0 inline-flex h-9.5 items-center justify-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover px-4 text-xs font-bold text-accent-foreground disabled:opacity-40 cursor-pointer focus:outline-none transition-all duration-200 active:scale-95 shadow-[0_4px_12px_rgba(59,130,246,0.15)]"
                >
                  {state.portfolioImporting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FolderPlus className="size-3.5" />
                  )}
                  <span>Lưu vào portfolio</span>
                </button>
              ) : (
                <a
                  href="/api/auth/google"
                  aria-disabled={!googleConfigured}
                  className={`inline-flex h-9.5 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold transition-all duration-200 active:scale-95 ${googleConfigured
                    ? "bg-accent text-accent-foreground hover:bg-accent-hover cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.15)]"
                    : "pointer-events-none border border-stone-850 bg-stone-900/10 text-stone-500"
                    }`}
                >
                  <LogIn className="size-3.5" />
                  <span>{googleConfigured ? "Đăng nhập Gmail" : "Thiếu Google OAuth"}</span>
                </a>
              )}
            </div>

            {state.portfolioImporting && state.portfolioImportStatus
              ? (() => {
                const percentMatch =
                  state.portfolioImportStatus.match(/^\[(\d+)%\]\s*/);
                const percent = percentMatch
                  ? parseInt(percentMatch[1], 10)
                  : 0;
                const message = percentMatch
                  ? state.portfolioImportStatus.slice(percentMatch[0].length)
                  : state.portfolioImportStatus;
                return (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5 text-blue-300">
                        <Loader2 className="size-4 shrink-0 animate-spin text-blue-400" />
                        <span className="truncate">{message}</span>
                      </div>
                      {percentMatch ? (
                        <span className="ml-3 shrink-0 text-xs font-bold text-blue-400 tabular-nums">
                          {percent}%
                        </span>
                      ) : null}
                    </div>
                    {percentMatch ? (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-900/30">
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all duration-500 ease-out"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })()
              : null}

            {state.portfolioImportMessage ? (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-100">
                {state.portfolioImportMessage}
              </div>
            ) : null}

            {state.portfolioImportError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {state.portfolioImportError}
              </div>
            ) : null}

            {zeroPricedItems.length > 0 || state.retryStatus ? (
              <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 px-5 py-3.5 text-sm">
                {state.retryingPrices ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-blue-300" />
                ) : zeroPricedItems.length === 0 ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                ) : (
                  <RefreshCw className="mt-0.5 size-4 shrink-0 text-blue-300" />
                )}
                <div className="min-w-0 flex-1">
                  {zeroPricedItems.length > 0 ? (
                    <p className="font-semibold text-blue-100">
                      {zeroPricedItems.length} item 0đ &mdash;{" "}
                      <span className="font-normal text-stone-300">
                        {state.retryingPrices
                          ? "đang tự động lấy giá..."
                          : "sẽ tự động retry..."}
                      </span>
                    </p>
                  ) : null}
                  {state.retryStatus ? (
                    <p
                      className={`mt-0.5 text-xs ${zeroPricedItems.length === 0
                        ? "font-semibold text-emerald-300"
                        : "text-stone-400"
                        }`}
                    >
                      {state.retryStatus}
                    </p>
                  ) : null}
                  {zeroPricedItems.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {zeroPricedItems.slice(0, 10).map((item) => (
                        <span
                          key={item.caseItem.id}
                          className="inline-flex items-center rounded border border-stone-700/50 bg-stone-900/80 px-2 py-0.5 text-xs font-medium text-blue-200"
                        >
                          {item.caseItem.name}
                        </span>
                      ))}
                      {zeroPricedItems.length > 10 && (
                        <span className="inline-flex items-center rounded border border-stone-700/50 bg-stone-900/80 px-2 py-0.5 text-xs font-medium text-stone-400">
                          + {zeroPricedItems.length - 10} item khác...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

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

            <div className="grid gap-4 lg:grid-cols-3">
              <BuffRateCard
                value={buffCnyToVndRate}
                onChange={setBuffCnyToVndRate}
                tooltip={
                  <span>
                    Tỷ giá dùng để đổi nhân dân tệ (CNY) sang đồng (VND) khi tính giá skin trên Buff163.
                  </span>
                }
              />
              <RateCard
                id="rateAll"
                label="Rate sỉ (all)"
                value={rateAll}
                onChange={setRateAll}
                total={merged.totalPrice}
                color="blue"
                desc="Giá bán khi bán sỉ toàn bộ"
                customCalculatedTotal={totalSi}
                tooltip={
                  <span>
                    Tổng giá trị quy đổi theo rate sỉ. Áp dụng tỷ lệ chiết khấu cho hòm, capsule, sticker và skin thường. Skin đã có giá Buff được tính 100% giá trị.
                  </span>
                }
              />
              <RateCard
                id="rateLe"
                label="Rate lẻ"
                value={rateLe}
                onChange={setRateLe}
                total={merged.totalPrice}
                color="violet"
                desc="Giá bán khi bán lẻ từng hòm"
                customCalculatedTotal={totalLe}
                tooltip={
                  <span>
                    Tổng giá trị quy đổi theo rate lẻ. Áp dụng tỷ lệ chiết khấu cho hòm, capsule, sticker. Skin đã có giá Buff được tính 100% giá trị.
                  </span>
                }
              />
            </div>

             <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Tổng số lượng item định giá"
                value={String(merged.totalQuantity)}
                unit="item"
                variant="blue"
                tooltip={
                  <span>
                    Tổng số lượng các vật phẩm được đưa vào bảng tính định giá (hòm, capsule, sticker, skin).
                  </span>
                }
              />
              <StatCard
                label="Giá trị thị trường (100%)"
                value={formatVND(merged.totalPrice)}
                valueClass="text-emerald-400"
                variant="emerald"
                tooltip={
                  <span>
                    Tổng giá trị các vật phẩm tính theo giá trị thị trường 100% (không áp dụng chiết khấu/rate).
                  </span>
                }
              />
              <StatCard
                label="Tổng item trong hòm đồ"
                value={String(merged.totalInventoryCount)}
                unit="item"
                variant="neutral"
                tooltip={
                  <span>
                    Tổng số lượng tất cả các vật phẩm hiện có trong hòm đồ Steam đã quét (bao gồm cả các loại item không định giá như huy hiệu, graffiti...).
                  </span>
                }
              />
            </div>

            {merged.items.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
                <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex shrink-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex h-9 min-w-64 items-center gap-2 rounded-md border border-input-border bg-input px-3 text-xs transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
                        <Search className="size-3.5 text-muted-foreground" />
                        <input
                          value={state.globalFilter}
                          onChange={(e) => setGlobalFilter(e.target.value)}
                          placeholder="Tìm case, capsule, sticker, skin..."
                          className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <ResetButton
                      isVisible={
                        state.selectedTypes.size > 0 ||
                        selectedStatuses.length > 0 ||
                        selectedAccounts.length > 0
                      }
                      onReset={() => {
                        clearTypeFilters();
                        setSelectedStatuses([]);
                        setSelectedAccounts([]);
                      }}
                    />

                    <FilterPopover
                      label="Loại vật phẩm"
                      options={[
                        { label: "Case", value: "Case" },
                        { label: "Sticker Capsule", value: "Capsule" },
                        { label: "Sticker", value: "Sticker" },
                        { label: "Skin", value: "Skin" },
                      ]}
                      selectedValues={Array.from(state.selectedTypes)}
                      onChange={(nextValues) => {
                        clearTypeFilters();
                        nextValues.forEach((val) => toggleTypeFilter(val));
                        table.setPageIndex(0);
                      }}
                    />

                    <FilterPopover
                      label="Trạng thái"
                      options={[
                        { label: "🟢 Tradeable", value: "tradeable" },
                        { label: "🟡 On Market", value: "market" },
                        { label: "🔵 Trade Protected", value: "protected" },
                        { label: "🔴 Hold", value: "hold" },
                      ]}
                      selectedValues={selectedStatuses}
                      onChange={(nextValues) => {
                        setSelectedStatuses(nextValues);
                        table.setPageIndex(0);
                      }}
                    />

                    <FilterPopover
                      label="Tài khoản"
                      options={accountOptions.map((account) => ({
                        label: account.name,
                        value: account.steamId64,
                      }))}
                      selectedValues={selectedAccounts}
                      onChange={(nextValues) => {
                        setSelectedAccounts(nextValues);
                        table.setPageIndex(0);
                      }}
                      disabled={accountOptions.length === 0}
                    />

                    <ViewButton table={table} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-stone-300">
                    <thead className="bg-stone-900/80 text-xs text-stone-400 uppercase">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className={`px-5 py-3 font-medium ${header.column.id !== "case" ? "text-right" : ""
                                }`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                       {visibleManualItems.length > 0 &&
                        visibleManualItems.map((item) => {
                          const marketHashName = item.caseItem.marketHashName;
                          return (
                            <ManualItemRow
                              key={`manual-${item.id || marketHashName}`}
                              item={item}
                              table={table}
                              updateManualItemQty={updateManualItemQty}
                              removeItem={removeItem}
                              fetchBuffPrice={fetchBuffPrice}
                              updateBuffPriceCny={updateBuffPriceCny}
                              buffPriceCny={item.buffPriceCny ?? state.buffPricesCny[marketHashName]}
                              buffPriceError={state.buffPriceErrors[marketHashName]}
                              isBuffLoading={state.buffLoadingKeys.has(marketHashName)}
                              buffCnyToVndRate={buffCnyToVndRate}
                              rateAll={rateAll}
                              rateLe={rateLe}
                              steamPrice={state.manualItems.find((x) => x.id === item.id)?.price ?? item.price}
                            />
                          );
                        })}

                      {table.getRowModel().rows.length > 0
                        ? table.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className="transition-colors hover:bg-stone-800/50"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="px-5 py-4">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                        : visibleManualItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={columns.length}
                              className="px-5 py-8 text-center text-stone-500"
                            >
                              Không tìm thấy kết quả nào phù hợp
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>

                <TablePagination table={table} />
              </div>
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
