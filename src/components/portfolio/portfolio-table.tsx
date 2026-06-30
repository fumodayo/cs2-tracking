"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PortfolioReportDto } from "@/types/report";
import { useCurrency } from "@/components/currency-provider";
import { useLocalStorage } from "@/hooks/use-local-storage";

import {
  buildPortfolioTableRows,
  remapPortfolioRowSelection,
  type PortfolioTableRow,
  type PortfolioTableMode,
} from "./portfolio-table-model";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SellSelectedDialog } from "./sell-selected-dialog";
import { ItemCell } from "./components/portfolio-item-cell";
import { buildColumns } from "./portfolio-columns";
import { TablePagination } from "@/components/shared/table-pagination";
import {
  usePortfolioFilters,
  usePortfolioTableState,
} from "./hooks";
import { PortfolioTableToolbar } from "./components/portfolio-table-toolbar";
import { PortfolioTableBody } from "./components/portfolio-table-body";

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

  const buffLoadingKeysRef = useRef<Set<string>>(new Set());
  const [, setBuffLoadingTick] = useState(0);
  const wholesaleRate = "60";
  const retailRate = "65";

  const [deleteSelectedConfirmOpen, setDeleteSelectedConfirmOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const fetchBuffPrice = useCallback(
    async (marketHashName: string) => {
      if (buffLoadingKeysRef.current.has(marketHashName) || !onUpdateBuffPrice) return;
      
      buffLoadingKeysRef.current.add(marketHashName);
      setBuffLoadingTick((t) => t + 1);

      try {
        const response = await fetch("/api/inventory/buff-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketHashName, cnyToVndRate: buffCnyToVndRate }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch BUFF163 price.");
        }

        const data = await response.json();
        if (data && typeof data.priceCny === "number") {
          onUpdateBuffPrice(marketHashName, data.priceCny);
        }
      } catch (error) {
        console.error(error);
      } finally {
        buffLoadingKeysRef.current.delete(marketHashName);
        setBuffLoadingTick((t) => t + 1);
      }
    },
    [buffCnyToVndRate, onUpdateBuffPrice],
  );

  const [mode, setMode] = useLocalStorage<PortfolioTableMode>("cs2t_portfolio_mode", "case-summary");

  const rows = useMemo(
    () => buildPortfolioTableRows(report, mode, buffPricesCny, buffCnyToVndRate),
    [report, mode, buffPricesCny, buffCnyToVndRate],
  );

  // Filters hook
  const filters = usePortfolioFilters({ rows, buffPricesCny });

  // Table state hook
  const tableState = usePortfolioTableState({
    filteredDataCount: filters.filteredData.length,
    globalFilter: filters.globalFilter,
    sourceFilters: filters.sourceFilters,
    itemTypeFilters: filters.itemTypeFilters,
    accountFilters: filters.accountFilters,
    statusFilters: filters.statusFilters,
    priceSourceFilters: filters.priceSourceFilters,
  });
  const { setRowSelection } = tableState;

  const handleModeChange = useCallback(
    (newMode: PortfolioTableMode) => {
      if (newMode === mode) return;

      const nextRows = buildPortfolioTableRows(report, newMode, buffPricesCny, buffCnyToVndRate);
      setRowSelection((prevSelection) =>
        remapPortfolioRowSelection(prevSelection, rows, nextRows)
      );
      setMode(newMode);
    },
    [mode, report, buffPricesCny, buffCnyToVndRate, rows, setMode, setRowSelection]
  );

  const handleSellItem = useCallback(
    (id: string) => {
      setLastSelectedId(id);
      setRowSelection((prev) => ({
        ...prev,
        [id]: true,
      }));
      setSellDialogOpen(true);
    },
    [setRowSelection, setSellDialogOpen],
  );

  const columns = useMemo(
    () =>
      buildColumns({
        t,
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
        buffLoadingKeys: buffLoadingKeysRef.current,
        allRows: rows,
        originalRows: report.rows,
        wholesaleRatePercent: Number(wholesaleRate) || 0,
        retailRatePercent: Number(retailRate) || 0,
        onUpdateBuffRate,
        formatCurrency,
        onSellItem: handleSellItem,
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
      rows,
      report.rows,
      wholesaleRate,
      retailRate,
      formatCurrency,
      handleSellItem,
      t,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filters.filteredData,
    columns,
    state: {
      globalFilter: filters.globalFilter,
      sorting: tableState.sorting,
      rowSelection: tableState.rowSelection,
      pagination: tableState.pagination,
      columnVisibility: tableState.columnVisibility,
    },
    onPaginationChange: tableState.setPagination,
    onColumnVisibilityChange: tableState.setColumnVisibility,
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
    onGlobalFilterChange: filters.setGlobalFilter,
    onSortingChange: tableState.setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedIds = useMemo(() => {
    if (Object.keys(tableState.rowSelection).length === 0) return [];
    return table.getSelectedRowModel().flatRows.map((r) => r.original.id);
  }, [table, tableState.rowSelection]);

  const selectedDbIds = useMemo(() => {
    if (Object.keys(tableState.rowSelection).length === 0) return [];
    return table.getSelectedRowModel().flatRows.flatMap((r) => r.original.itemIds);
  }, [table, tableState.rowSelection]);

  const selectedRows = useMemo(() => {
    return rows.filter((r) => selectedIds.includes(r.id));
  }, [rows, selectedIds]);

  const handleDeleteSelected = () => {
    if (selectedDbIds.length === 0) return;
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
      <PortfolioTableToolbar
        mode={mode}
        setMode={handleModeChange}
        globalFilter={filters.globalFilter}
        setGlobalFilter={filters.setGlobalFilter}
        sourceFilters={filters.sourceFilters}
        setSourceFilters={filters.setSourceFilters}
        itemTypeFilters={filters.itemTypeFilters}
        setItemTypeFilters={filters.setItemTypeFilters}
        accountFilters={filters.accountFilters}
        setAccountFilters={filters.setAccountFilters}
        statusFilters={filters.statusFilters}
        setStatusFilters={filters.setStatusFilters}
        priceSourceFilters={filters.priceSourceFilters}
        setPriceSourceFilters={filters.setPriceSourceFilters}
        accountOptions={filters.accountOptions}
        itemTypeOptions={filters.itemTypeOptions}
        t={t}
        onRefreshPrices={onRefreshPrices}
        isRefreshingPrices={isRefreshingPrices}
        onUpdateBuffRate={onUpdateBuffRate}
        buffCnyToVndRate={buffCnyToVndRate}
        table={table}
        selectedIds={selectedIds}
        setRowSelection={setRowSelection}
        setSellDialogOpen={setSellDialogOpen}
        handleDeleteSelected={handleDeleteSelected}
        isDeletingMany={isDeletingMany}
      />

      <PortfolioTableBody table={table} />

      <TablePagination table={table} className="rounded-b-xl border-t border-stone-800" />

      <SellSelectedDialog
        open={sellDialogOpen}
        onClose={() => {
          setSellDialogOpen(false);
          setLastSelectedId(null);
        }}
        selectedItems={selectedRows}
        allItems={rows}
        originalRows={report.rows}
        onDelete={onDelete}
        onUpdateQuantity={onUpdateQuantity || (() => {})}
        onClearSelection={() => {
          setRowSelection({});
          setLastSelectedId(null);
        }}
        onDeselectItem={(id) => {
          setRowSelection((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }}
        wholesaleRate={Number(wholesaleRate) || 60}
        retailRate={Number(retailRate) || 65}
        buffPricesCny={buffPricesCny}
        buffCnyToVndRate={buffCnyToVndRate}
        lastSelectedId={lastSelectedId}
      />

      <ConfirmDialog
        open={deleteSelectedConfirmOpen}
        onClose={() => setDeleteSelectedConfirmOpen(false)}
        title={t("portfolio.deleteSelectedConfirmTitle", "Confirm deletion of selected items")}
        description={t("portfolio.deleteSelectedConfirmDesc", "Are you sure you want to delete {{count}} selected items from your portfolio? This action cannot be undone.", { count: selectedDbIds.length })}
        confirmText={t("portfolio.deleteSelectedConfirmButton", "Confirm Delete")}
        cancelText={t("common.cancel")}
        variant="danger"
        onConfirm={async () => {
          if (onDeleteMany) {
            await onDeleteMany(selectedDbIds);
            setRowSelection({});
          }
        }}
      />
    </div>
  );
}
