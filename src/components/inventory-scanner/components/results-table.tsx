"use client";

import React, { memo, useState, useEffect } from "react";
import { flexRender, type Table, type Row } from "@tanstack/react-table";
import { RefreshCw, Search, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FilterPopover, ResetButton, ViewButton } from "@/components/ui/actions";
import { TablePagination } from "@/components/shared/table-pagination";
import { cn } from "@/utils/cn";
import type { ScanResultItem } from "../types";
import { Button } from "@/components/ui/button";
import { FaBoxOpen, FaTrashAlt } from "react-icons/fa";

function ScanResultTableRowComponent({
  row,
  isSelected,
  isLoadingBuff,
  isInspecting,
  hasBuffError,
}: {
  row: Row<ScanResultItem>;
  isSelected: boolean;
  isLoadingBuff: boolean;
  isInspecting: boolean;
  hasBuffError: boolean;
}) {
  const isManual = row.original.isManual;

  return (
    <tr
      className={`transition-colors ${
        isManual
          ? isSelected
            ? "border-l-2 border-l-blue-500 bg-blue-500/[0.08]"
            : "border-l-2 border-l-blue-500 bg-blue-500/[0.04] hover:bg-blue-500/[0.08]"
          : isSelected
            ? "bg-blue-500/[0.04]"
            : "hover:bg-stone-800/50"
      }`}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-5 py-4">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

interface ResultsTableProps {
  mode: "case-summary" | "transactions";
  setMode: (mode: "case-summary" | "transactions") => void;
  table: Table<ScanResultItem>;
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  selectedTypes: Set<string>;
  clearTypeFilters: () => void;
  toggleTypeFilter: (val: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (val: string[]) => void;
  selectedAccounts: string[];
  setSelectedAccounts: (val: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  selectedIds: string[];
  setRowSelection: (val: Record<string, boolean>) => void;
  setSellDialogOpen: (open: boolean) => void;
  handleDeleteSelected: () => void;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  buffLoadingKeys?: Set<string>;
  inspectingKeys?: Set<string>;
  buffPriceErrors?: Record<string, string>;
}

export function ResultsTable({
  mode,
  setMode,
  table,
  globalFilter,
  setGlobalFilter,
  selectedTypes,
  clearTypeFilters,
  toggleTypeFilter,
  selectedStatuses,
  setSelectedStatuses,
  selectedAccounts,
  setSelectedAccounts,
  accountOptions,
  selectedIds,
  setRowSelection,
  setSellDialogOpen,
  handleDeleteSelected,
  onRefreshPrices,
  isRefreshingPrices = false,
  buffLoadingKeys = new Set(),
  inspectingKeys = new Set(),
  buffPriceErrors = {},
}: ResultsTableProps) {
  const { t } = useTranslation();

  const [localQuery, setLocalQuery] = useState(globalFilter);

  // Sync local query if global filter changes externally (like reset)
  useEffect(() => {
    setLocalQuery(globalFilter);
  }, [globalFilter]);

  // Debounce calling setGlobalFilter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== globalFilter) {
        setGlobalFilter(localQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, globalFilter, setGlobalFilter]);

  return (
    <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
      <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="relative inline-flex h-9 items-center rounded-lg border border-stone-800 bg-stone-950 p-1 shadow-sm select-none shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMode("case-summary");
                  table.setPageIndex(0);
                }}
                className={`relative inline-flex items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 cursor-pointer h-7 ${
                  mode === "case-summary"
                    ? "text-blue-400"
                    : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {mode === "case-summary" && (
                  <motion.div
                    layoutId="activeTabToolbarScanner"
                    className="absolute inset-0 rounded-md bg-stone-900 shadow-md border border-stone-800"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t("dashboard.caseSummaryMode", "Gom")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("transactions");
                  table.setPageIndex(0);
                }}
                className={`relative inline-flex items-center justify-center rounded-md px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200 cursor-pointer h-7 ${
                  mode === "transactions"
                    ? "text-blue-400"
                    : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {mode === "transactions" && (
                  <motion.div
                    layoutId="activeTabToolbarScanner"
                    className="absolute inset-0 rounded-md bg-stone-900 shadow-md border border-stone-800"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t("dashboard.viewMode", "Chi tiết")}</span>
              </button>
            </div>

            <label className="flex h-9 min-w-64 items-center gap-2 rounded-md border border-input-border bg-input px-3 text-xs transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                aria-label={t("inventoryScanner.searchPlaceholder")}
                placeholder={t("inventoryScanner.searchPlaceholder")}
                className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            {onRefreshPrices && (
              <Button
                type="button"
                onClick={onRefreshPrices}
                disabled={isRefreshingPrices}
                className="h-9 px-3 text-xs font-semibold cursor-pointer border border-stone-800 bg-stone-900/60 hover:bg-stone-850 hover:text-stone-200 flex items-center gap-1.5 shrink-0"
                title={t("inventoryScanner.refreshPrices")}
              >
                <RefreshCw
                  className={`size-3.5 text-blue-400 ${isRefreshingPrices ? "animate-spin" : ""}`}
                />
                <span className="text-stone-300">{t("inventoryScanner.refreshPrices")}</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ResetButton
            isVisible={
              selectedTypes.size > 0 ||
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
            label={t("inventoryScanner.itemType")}
            options={[
              { label: t("inventoryScanner.case"), value: "Case" },
              { label: t("inventoryScanner.stickerCapsule"), value: "Capsule" },
              { label: t("inventoryScanner.sticker"), value: "Sticker" },
              { label: t("inventoryScanner.skin"), value: "Skin" },
            ]}
            selectedValues={Array.from(selectedTypes)}
            onChange={(nextValues) => {
              clearTypeFilters();
              nextValues.forEach((val) => toggleTypeFilter(val));
              table.setPageIndex(0);
            }}
          />

          <FilterPopover
            label={t("inventoryScanner.status")}
            options={[
              {
                label: t("inventoryScanner.tradeable"),
                value: "tradeable",
                icon: ({ className }) => <span className={cn("size-2 rounded-full bg-emerald-500", className)} />
              },
              {
                label: t("inventoryScanner.onMarket"),
                value: "market",
                icon: ({ className }) => <span className={cn("size-2 rounded-full bg-amber-500", className)} />
              },
              {
                label: t("inventoryScanner.tradeProtected"),
                value: "protected",
                icon: ({ className }) => <span className={cn("size-2 rounded-full bg-blue-500", className)} />
              },
              {
                label: t("inventoryScanner.hold"),
                value: "hold",
                icon: ({ className }) => <span className={cn("size-2 rounded-full bg-red-500", className)} />
              },
            ]}
            selectedValues={selectedStatuses}
            onChange={(nextValues) => {
              setSelectedStatuses(nextValues);
              table.setPageIndex(0);
            }}
          />

          <FilterPopover
            label={t("inventoryScanner.account")}
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

      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between border-b border-stone-850 bg-stone-900/90 px-4 py-2.5 animate-fade-slide-in">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-stone-300">
              Đã chọn {selectedIds.length} vật phẩm
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="inline-flex h-8 items-center justify-center rounded-md border border-stone-800 bg-stone-900/60 hover:bg-stone-850 px-3 text-xs font-semibold text-stone-400 hover:text-stone-200 transition-all cursor-pointer hover:border-stone-700"
            >
              Hủy chọn
            </button>
            <button
              type="button"
              onClick={() => setSellDialogOpen(true)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent hover:bg-accent-hover px-3.5 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-md shadow-accent/25 active:scale-95"
            >
              <FaBoxOpen className="size-3.5" />
              <span>Bán ({selectedIds.length})</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 px-3.5 text-xs font-bold text-red-400 hover:border-red-500/30 hover:text-red-300 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <FaTrashAlt className="size-3" />
              <span>Xóa ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-stone-300">
          <thead className="bg-stone-900/80 text-xs text-stone-400 uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    aria-sort={
                      header.column.getCanSort()
                        ? (header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none")
                        : undefined
                    }
                    className={`px-5 py-3 font-medium ${
                      header.column.id !== "case" && header.column.id !== "select" ? "text-right" : ""
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-stone-800">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const marketHashName = row.original.caseItem.marketHashName;
                return (
                  <ScanResultTableRowComponent
                    key={row.id}
                    row={row}
                    isSelected={row.getIsSelected()}
                    isLoadingBuff={buffLoadingKeys.has(marketHashName)}
                    isInspecting={inspectingKeys.has(marketHashName)}
                    hasBuffError={!!buffPriceErrors[marketHashName]}
                  />
                );
              })
            ) : (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-5 py-8 text-center text-stone-500">
                  {t("inventoryScanner.noResultsFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination table={table} unit={t("inventoryScanner.itemUnit", "vật phẩm")} />
    </div>
  );
}
