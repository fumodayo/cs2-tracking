"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";


import {
  TbPackage,
  TbPills,
  TbTag,
  TbSword,
  TbHandGrab,
  TbUser,
  TbMusic,
  TbPin,
  TbCircleDot,
  TbPalette,
} from "react-icons/tb";
import { Search, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { PortfolioReportDto } from "@/types/report";
import { useCurrency } from "@/components/currency-provider";

import {
  buildPortfolioTableRows,
  type PortfolioSourceFilter,
  type PortfolioTableMode,
  type PortfolioTableRow,
  getItemStatusBreakdown,
  getRowSubtype,
} from "./portfolio-table-model";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SellSelectedDialog } from "./sell-selected-dialog";
import { FilterPopover, ViewButton, ResetButton } from "@/components/ui/actions";
import { buildAccountOptions } from "./portfolio-table-utils";
import { ItemCell } from "./components/portfolio-item-cell";
import { buildColumns, BuffRateInput } from "./portfolio-columns";
import { PortfolioBulkActions } from "./components/portfolio-bulk-actions";
import { TablePagination } from "@/components/shared/table-pagination";


type PortfolioTableProps = {
  report: PortfolioReportDto;
  deletingId: string | null;
  onDelete: (id: string) => void;
  updatingId?: string | null;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
  onUpdateNote?: (id: string, note: string) => Promise<void> | void;
  onUpdateLot?: (
    id: string,
    payload: {
      quantity?: number;
      buyPrice?: number;
      note?: string;
      sourceAccounts?: Array<{ steamId64: string; name: string }>;
      storageUnitId?: string;
      tradeHoldUntil?: string | null;
    }
  ) => Promise<void> | void;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  onAddCaseLot?: (payload: { caseId: string; quantity: number; buyPrice: number; buyDate: string; note?: string }) => Promise<void> | void;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  onUpdateBuffRate?: (rate: number) => void;
  onFilteredRowsChange?: (rows: PortfolioTableRow[]) => void;
  onDeleteMany?: (ids: string[]) => Promise<void> | void;
  isDeletingMany?: boolean;
};

const SOURCE_FILTER_OPTIONS: Array<{ label: string; value: PortfolioSourceFilter }> = [
  { label: "Thủ công", value: "manual" },
  { label: "Có sẵn", value: "existing" },
];

export function PortfolioTable({
  report,
  deletingId,
  onDelete,
  updatingId = null,
  onUpdateBuyPrice,
  onUpdateQuantity,
  onUpdateNote,
  onUpdateLot,
  buffPricesCny = {},
  buffCnyToVndRate = 3600,
  onUpdateBuffPrice,
  onRefreshPrices,
  isRefreshingPrices = false,
  onUpdateBuffRate,
  onFilteredRowsChange,
  onDeleteMany,
  isDeletingMany = false,
}: PortfolioTableProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read page from searchParams, default to 1 (which is index 0)
  const pageParam = searchParams.get("page");
  const initialPageIndex = pageParam ? Math.max(0, parseInt(pageParam, 10) - 1) : 0;

  const [pagination, setPagination] = useState({
    pageIndex: initialPageIndex,
    pageSize: 5,
  });

  const [mode, setMode] = useState<PortfolioTableMode>("case-summary");
  const [sourceFilters, setSourceFilters] = useState<PortfolioSourceFilter[]>([]);
  const [itemTypeFilters, setItemTypeFilters] = useState<string[]>([]);
  const [accountFilters, setAccountFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [priceSourceFilters, setPriceSourceFilters] = useState<string[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "buyPrice", desc: true }]);
  const [buffLoadingKeys, setBuffLoadingKeys] = useState<Set<string>>(new Set());
  const wholesaleRate = "60";
  const retailRate = "65";
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("cs2t_portfolio_rowSelection");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save row selection to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("cs2t_portfolio_rowSelection", JSON.stringify(rowSelection));
  }, [rowSelection]);

  const [deleteSelectedConfirmOpen, setDeleteSelectedConfirmOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);

  useEffect(() => {
    const pageVal = searchParams.get("page");
    const pIndex = pageVal ? Math.max(0, parseInt(pageVal, 10) - 1) : 0;
    if (pIndex !== pagination.pageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: pIndex }));
    }
  }, [searchParams, pagination.pageIndex]);

  const fetchBuffPrice = useCallback(
    async (marketHashName: string) => {
      if (buffLoadingKeys.has(marketHashName) || !onUpdateBuffPrice) return;
      setBuffLoadingKeys((prev) => {
        const next = new Set(prev);
        next.add(marketHashName);
        return next;
      });

      try {
        const response = await fetch("/api/inventory/buff-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketHashName, cnyToVndRate: buffCnyToVndRate }),
        });

        if (!response.ok) {
          throw new Error("Lấy giá BUFF163 thất bại.");
        }

        const data = await response.json();
        if (data && typeof data.priceCny === "number") {
          onUpdateBuffPrice(marketHashName, data.priceCny);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setBuffLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(marketHashName);
          return next;
        });
      }
    },
    [buffCnyToVndRate, buffLoadingKeys, onUpdateBuffPrice],
  );

  const rows = useMemo(
    () => buildPortfolioTableRows(report, mode, buffPricesCny, buffCnyToVndRate),
    [mode, report, buffPricesCny, buffCnyToVndRate],
  );
  const accountOptions = useMemo(() => buildAccountOptions(rows), [rows]);

  const subtypeOptions = useMemo(() => {
    const subtypes = new Set<string>();
    for (const row of rows) {
      if (row.itemType === "skin") {
        subtypes.add(getRowSubtype(row));
      }
    }
    return Array.from(subtypes)
      .sort((a, b) => {
        const special = ["Knives", "Gloves", "Agent", "Music Kit", "Patch", "Pin", "Graffiti"];
        const aIndex = special.indexOf(a);
        const bIndex = special.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return 1;
        if (bIndex !== -1) return -1;
        return a.localeCompare(b);
      })
      .map((subtype) => {
        let Icon = TbSword;
        if (subtype === "Knives") Icon = TbSword;
        else if (subtype === "Gloves") Icon = TbHandGrab;
        else if (subtype === "Agent") Icon = TbUser;
        else if (subtype === "Music Kit") Icon = TbMusic;
        else if (subtype === "Pin") Icon = TbPin;
        else if (subtype === "Patch") Icon = TbCircleDot;
        else if (subtype === "Graffiti") Icon = TbPalette;
        
        return {
          label: subtype,
          value: `subtype:${subtype}`,
          icon: Icon,
        };
      });
  }, [rows]);

  const itemTypeOptions = useMemo(() => {
    const base = [
      { label: "Hòm (Case)", value: "case", icon: TbPackage },
      { label: "Capsule", value: "capsule", icon: TbPills },
      { label: "Sticker", value: "sticker", icon: TbTag },
      { label: "Skin (Tất cả)", value: "skin", icon: TbSword },
    ];
    if (subtypeOptions.length > 0) {
      return [
        ...base,
        { label: "── Chi tiết Skin ──", value: "separator" },
        ...subtypeOptions,
      ];
    }
    return base;
  }, [subtypeOptions]);

  const data = useMemo(
    () =>
      rows.filter((row) => {
        if (sourceFilters.length > 0 && !sourceFilters.includes(row.sourceType)) return false;
        if (itemTypeFilters.length > 0) {
          const matches = itemTypeFilters.some((filterVal) => {
            if (filterVal.startsWith("subtype:")) {
              const subtype = filterVal.substring(8);
              return getRowSubtype(row) === subtype;
            }
            return row.itemType === filterVal;
          });
          if (!matches) return false;
        }
        if (
          accountFilters.length > 0 &&
          !row.sourceAccounts.some((account) => accountFilters.includes(account.steamId64))
        ) {
          return false;
        }
        if (statusFilters.length > 0) {
          const breakdown = getItemStatusBreakdown(row);
          const statuses = new Set<string>();
          if (breakdown.tradeable > 0) statuses.add("tradeable");
          if (breakdown.onMarket > 0) statuses.add("market");
          if (breakdown.tradeProtected > 0) statuses.add("protected");
          if (breakdown.hold > 0) statuses.add("hold");

          if (statuses.size === 0) statuses.add("tradeable");

          const matchesStatus = statusFilters.some((s) => statuses.has(s));
          if (!matchesStatus) return false;
        }
        if (priceSourceFilters.length > 0) {
          const hasBuffPrice = buffPricesCny[row.case.marketHashName] !== undefined && buffPricesCny[row.case.marketHashName] > 0;
          const matchesBuff = priceSourceFilters.includes("buff") && hasBuffPrice;
          const matchesSteam = priceSourceFilters.includes("steam") && !hasBuffPrice;
          if (!matchesBuff && !matchesSteam) return false;
        }
        return true;
      }),
    [accountFilters, itemTypeFilters, rows, sourceFilters, statusFilters, priceSourceFilters, buffPricesCny],
  );
  const columns = useMemo(
    () =>
      buildColumns({
        mode,
        deletingId,
        onDelete,
        updatingId,
        onUpdateBuyPrice,
        onUpdateQuantity,
        onUpdateNote,
        onUpdateLot,
        buffPricesCny,
        buffCnyToVndRate,
        onUpdateBuffPrice,
        fetchBuffPrice,
        buffLoadingKeys,
        allRows: rows,
        originalRows: report.rows,
        wholesaleRatePercent: Number(wholesaleRate) || 0,
        retailRatePercent: Number(retailRate) || 0,
        onUpdateBuffRate,
        formatCurrency,
        ItemCellComponent: ItemCell,
      }),
    [
      mode,
      deletingId,
      onDelete,
      updatingId,
      onUpdateBuyPrice,
      onUpdateQuantity,
      onUpdateNote,
      onUpdateLot,
      onUpdateBuffRate,
      buffPricesCny,
      buffCnyToVndRate,
      onUpdateBuffPrice,
      fetchBuffPrice,
      buffLoadingKeys,
      rows,
      report.rows,
      wholesaleRate,
      retailRate,
      formatCurrency,
    ],
  );

  // Fallback to previous page if current page becomes empty after deletion
  useEffect(() => {
    const totalPages = Math.ceil(data.length / pagination.pageSize);
    if (data.length > 0 && pagination.pageIndex >= totalPages) {
      const newPageIndex = Math.max(0, totalPages - 1);
      setPagination((prev) => ({ ...prev, pageIndex: newPageIndex }));
    }
  }, [data.length, pagination.pageSize, pagination.pageIndex]);

  // Reset to first page when search filters change
  useEffect(() => {
    setPagination((prev) => {
      if (prev.pageIndex === 0) return prev;
      return { ...prev, pageIndex: 0 };
    });
  }, [globalFilter, sourceFilters, itemTypeFilters, accountFilters, statusFilters, priceSourceFilters]);

  // Sync pagination.pageIndex change to the URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentPageVal = params.get("page");
    const currentUrlPage = currentPageVal ? Math.max(0, parseInt(currentPageVal, 10) - 1) : 0;
    
    if (pagination.pageIndex !== currentUrlPage) {
      if (pagination.pageIndex > 0) {
        params.set("page", String(pagination.pageIndex + 1));
      } else {
        params.delete("page");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pagination.pageIndex, pathname, router]);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    wholesaleValue: false,
    retailValue: false,
    profitAmount: false,
    updatedAt: false,
    buyDate: false,
    investedValue: false,
  });
  const [isColumnVisibilityLoaded, setIsColumnVisibilityLoaded] = useState(false);

  // Load column visibility from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cs2t_portfolio_columnVisibility");
      if (saved) {
        setColumnVisibility(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load portfolio column visibility", e);
    }
    setIsColumnVisibilityLoaded(true);
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (isColumnVisibilityLoaded) {
      localStorage.setItem("cs2t_portfolio_columnVisibility", JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, isColumnVisibilityLoaded]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, rowSelection, pagination, columnVisibility },
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    autoResetPageIndex: false,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;

      const item = row.original;
      return [
        item.case.name,
        item.case.marketHashName,
        item.note,
        item.itemType,
        ...item.sourceAccounts.map((account) => account.name),
        String(item.quantity),
        String(item.buyPrice),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });


  const selectedIds = useMemo(() => {
    return table.getSelectedRowModel().flatRows.map((r) => r.original.id);
  }, [table]);

  const selectedRows = useMemo(() => {
    return rows.filter((r) => selectedIds.includes(r.id));
  }, [rows, selectedIds]);

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setDeleteSelectedConfirmOpen(true);
  };


  const filteredRows = table.getFilteredRowModel().rows;
  const originalFilteredRows = useMemo(
    () => filteredRows.map((row) => row.original),
    [filteredRows]
  );
  
  useEffect(() => {
    if (onFilteredRowsChange) {
      onFilteredRowsChange(originalFilteredRows);
    }
  }, [originalFilteredRows, onFilteredRowsChange]);

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 shadow-md">
      <div className="flex flex-col gap-3 rounded-t-xl border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* View Mode Switcher */}
          <div className="relative inline-flex h-9 items-center rounded-lg border border-border bg-surface-muted/40 p-1 shadow-sm select-none mr-1">
            <button
              type="button"
              onClick={() => setMode("case-summary")}
              className={`relative inline-flex items-center justify-center rounded-md px-3.5 py-1 text-[11px] font-bold transition-all duration-200 cursor-pointer h-7 ${
                mode === "case-summary"
                  ? "text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "case-summary" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-md bg-accent shadow-sm shadow-blue-500/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t("dashboard.caseSummaryMode", "Gom hòm")}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("transactions")}
              className={`relative inline-flex items-center justify-center rounded-md px-3.5 py-1 text-[11px] font-bold transition-all duration-200 cursor-pointer h-7 ${
                mode === "transactions"
                  ? "text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "transactions" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-md bg-accent shadow-sm shadow-blue-500/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t("dashboard.viewMode", "Chi tiết")}</span>
            </button>
          </div>
          {onRefreshPrices && (
            <button
              type="button"
              onClick={onRefreshPrices}
              disabled={isRefreshingPrices}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-surface-hover disabled:cursor-wait disabled:opacity-50 transition-all cursor-pointer shadow-sm hover:border-stone-700"
            >
              <RefreshCcw className={`size-3.5 text-blue-400 ${isRefreshingPrices ? "animate-spin" : ""}`} />
              <span>Refresh giá</span>
            </button>
          )}
          {onUpdateBuffRate && (
            <BuffRateInput value={buffCnyToVndRate} onChange={onUpdateBuffRate} />
          )}
          <label className="flex h-9 min-w-64 items-center gap-2 rounded-md border border-input-border bg-input px-3 text-xs focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              aria-label="Tìm kiếm danh mục"
              placeholder="Tìm vật phẩm, market hash, ghi chú..."
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-xs font-medium"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ResetButton
            isVisible={
              sourceFilters.length > 0 ||
              itemTypeFilters.length > 0 ||
              accountFilters.length > 0 ||
              statusFilters.length > 0 ||
              priceSourceFilters.length > 0
            }
            onReset={() => {
              setSourceFilters([]);
              setItemTypeFilters([]);
              setAccountFilters([]);
              setStatusFilters([]);
              setPriceSourceFilters([]);
            }}
          />
          <FilterPopover
            label="Nguồn"
            options={SOURCE_FILTER_OPTIONS}
            selectedValues={sourceFilters}
            onChange={(values) => setSourceFilters(values)}
          />
          <FilterPopover
            label="Loại vật phẩm"
            options={itemTypeOptions}
            selectedValues={itemTypeFilters}
            onChange={(values) => setItemTypeFilters(values)}
          />
          <FilterPopover
            label="Tài khoản"
            options={accountOptions.map((account) => ({ label: account.name, value: account.steamId64 }))}
            selectedValues={accountFilters}
            onChange={(values) => setAccountFilters(values)}
            disabled={accountOptions.length === 0}
          />
          <FilterPopover
            label="Trạng thái"
            options={[
              { label: "🟢 Tradeable", value: "tradeable" },
              { label: "🟡 On Market", value: "market" },
              { label: "🔵 Trade Protected", value: "protected" },
              { label: "🔴 Hold", value: "hold" },
            ]}
            selectedValues={statusFilters}
            onChange={(values) => setStatusFilters(values)}
          />
          <FilterPopover
            label="Định giá"
            options={[
              { label: "🪙 Giá BUFF", value: "buff" },
              { label: "🎮 Giá Steam", value: "steam" },
            ]}
            selectedValues={priceSourceFilters}
            onChange={(values) => setPriceSourceFilters(values)}
          />
          <ViewButton table={table} />
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <PortfolioBulkActions
          selectedCount={selectedIds.length}
          onClearSelection={() => setRowSelection({})}
          onSellSelected={() => setSellDialogOpen(true)}
          onDeleteSelected={handleDeleteSelected}
          isDeletingMany={isDeletingMany}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm text-stone-300">
          <thead className="bg-stone-900/80 text-xs uppercase text-stone-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-5 py-3 font-medium ${
                      header.column.id === "select" ? "text-center w-12" : header.column.id !== "case" ? "text-right" : ""
                    }`}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-stone-800 bg-stone-900/20">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`transition-colors ${
                  row.original.sourceType === "manual"
                    ? "bg-blue-500/[0.04] border-l-2 border-l-blue-500 hover:bg-blue-500/[0.08]"
                    : "hover:bg-stone-800/50"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-5 py-4 align-middle ${
                      cell.column.id === "select" ? "text-center w-12" : cell.column.id !== "case" ? "text-right" : ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination table={table} className="rounded-b-xl border-t border-stone-800" />



      <SellSelectedDialog
        open={sellDialogOpen}
        onClose={() => setSellDialogOpen(false)}
        selectedItems={selectedRows}
        allItems={rows}
        onDelete={onDelete}
        onUpdateQuantity={onUpdateQuantity || (() => {})}
        onClearSelection={() => setRowSelection({})}
        wholesaleRate={Number(wholesaleRate) || 60}
        retailRate={Number(retailRate) || 65}
        buffPricesCny={buffPricesCny}
        buffCnyToVndRate={buffCnyToVndRate}
      />

      <ConfirmDialog
        open={deleteSelectedConfirmOpen}
        onClose={() => setDeleteSelectedConfirmOpen(false)}
        title="Xác nhận xóa các vật phẩm đã chọn"
        description={`Bạn có chắc chắn muốn xóa ${selectedIds.length} vật phẩm đã chọn khỏi danh mục portfolio? Thao tác này không thể hoàn tác.`}
        confirmText="Đồng ý xóa"
        cancelText="Hủy"
        variant="danger"
        onConfirm={async () => {
          if (onDeleteMany) {
            await onDeleteMany(selectedIds);
            setRowSelection({});
          }
        }}
      />
    </div>
  );
}


