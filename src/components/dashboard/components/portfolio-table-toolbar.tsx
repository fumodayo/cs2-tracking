import React from "react";
import { FaSteam, FaCoins } from "react-icons/fa";
import { TbCircleFilled, TbPencil, TbDatabase } from "react-icons/tb";
import { RefreshCcw, Search, ShoppingBag, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FilterPopover, ResetButton, ViewButton } from "@/components/ui/actions";
import { BuffRateInput } from "../portfolio-columns";
import { PortfolioSourceFilter, PortfolioTableMode } from "../portfolio-table-model";
import { Table } from "@tanstack/react-table";

export const SOURCE_FILTER_OPTIONS: Array<{
  label: string;
  value: PortfolioSourceFilter;
  icon?: React.ComponentType<{ className?: string }>;
}> = [
  { label: "Thủ công", value: "manual", icon: TbPencil },
  { label: "Có sẵn", value: "existing", icon: TbDatabase },
];

export interface PortfolioTableToolbarProps {
  mode: PortfolioTableMode;
  setMode: (mode: PortfolioTableMode) => void;
  globalFilter: string;
  setGlobalFilter: (q: string) => void;
  sourceFilters: PortfolioSourceFilter[];
  setSourceFilters: (val: PortfolioSourceFilter[]) => void;
  itemTypeFilters: string[];
  setItemTypeFilters: (val: string[]) => void;
  accountFilters: string[];
  setAccountFilters: (val: string[]) => void;
  statusFilters: string[];
  setStatusFilters: (val: string[]) => void;
  priceSourceFilters: string[];
  setPriceSourceFilters: (val: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  itemTypeOptions: Array<any>;
  t: any;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  onUpdateBuffRate?: (rate: number) => void;
  buffCnyToVndRate: number;
  table: Table<any>;
  
  // Bulk actions
  selectedIds: string[];
  setRowSelection: (selection: Record<string, boolean>) => void;
  setSellDialogOpen: (open: boolean) => void;
  handleDeleteSelected: () => void;
  isDeletingMany?: boolean;
}

export function PortfolioTableToolbar({
  mode,
  setMode,
  globalFilter,
  setGlobalFilter,
  sourceFilters,
  setSourceFilters,
  itemTypeFilters,
  setItemTypeFilters,
  accountFilters,
  setAccountFilters,
  statusFilters,
  setStatusFilters,
  priceSourceFilters,
  setPriceSourceFilters,
  accountOptions,
  itemTypeOptions,
  t,
  onRefreshPrices,
  isRefreshingPrices,
  onUpdateBuffRate,
  buffCnyToVndRate,
  table,
  selectedIds,
  setRowSelection,
  setSellDialogOpen,
  handleDeleteSelected,
  isDeletingMany = false,
}: PortfolioTableToolbarProps) {
  return (
    <>
      <div className="flex flex-col gap-3 rounded-t-xl border-b border-stone-800 bg-stone-900/60 p-3">
        {/* Row 1: Modes & Main Actions & Search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
                    layoutId="activeTabToolbar"
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
                    layoutId="activeTabToolbar"
                    className="absolute inset-0 rounded-md bg-accent shadow-sm shadow-blue-500/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t("dashboard.viewMode", "Chi tiết")}</span>
              </button>
            </div>
            {onRefreshPrices && (
              <Button
                type="button"
                onClick={onRefreshPrices}
                disabled={isRefreshingPrices}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-stone-700 hover:bg-surface-hover disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCcw
                  className={`size-3.5 text-blue-400 ${isRefreshingPrices ? "animate-spin" : ""}`}
                />
                <span>Refresh giá</span>
              </Button>
            )}
            {onUpdateBuffRate && (
              <BuffRateInput
                value={buffCnyToVndRate}
                onChange={onUpdateBuffRate}
              />
            )}
          </div>

          {/* Search bar */}
          <div className="w-full md:w-80">
            <label className="flex h-9 w-full items-center gap-2 rounded-md border border-input-border bg-input px-3 text-xs transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder="Tìm vật phẩm, market hash, ghi chú..."
                className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
        </div>

        {/* Divider */}
        <div className="bg-stone-850 -mx-3 h-px" />

        {/* Row 2: Filters */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
              Bộ lọc:
            </span>
            <FilterPopover
              label="Nguồn"
              options={SOURCE_FILTER_OPTIONS}
              selectedValues={sourceFilters}
              onChange={(values) => setSourceFilters(values as PortfolioSourceFilter[])}
            />
            <FilterPopover
              label="Loại vật phẩm"
              options={itemTypeOptions}
              selectedValues={itemTypeFilters}
              onChange={(values) => setItemTypeFilters(values)}
            />
            <FilterPopover
              label="Tài khoản"
              options={accountOptions.map((account) => ({
                label: account.name,
                value: account.steamId64,
              }))}
              selectedValues={accountFilters}
              onChange={(values) => setAccountFilters(values)}
              disabled={accountOptions.length === 0}
            />
            <FilterPopover
              label="Trạng thái"
              options={[
                {
                  label: "Tradeable",
                  value: "tradeable",
                  icon: () => <TbCircleFilled className="size-3.5 text-emerald-500" />,
                },
                {
                  label: "On Market",
                  value: "market",
                  icon: () => <TbCircleFilled className="size-3.5 text-amber-500" />,
                },
                {
                  label: "Trade Protected",
                  value: "protected",
                  icon: () => <TbCircleFilled className="size-3.5 text-blue-500" />,
                },
                {
                  label: "Hold",
                  value: "hold",
                  icon: () => <TbCircleFilled className="size-3.5 text-red-500" />,
                },
              ]}
              selectedValues={statusFilters}
              onChange={(values) => setStatusFilters(values)}
            />
            <FilterPopover
              label="Định giá"
              options={[
                {
                  label: "Giá BUFF",
                  value: "buff",
                  icon: () => <FaCoins className="size-4.5 text-amber-500" />,
                },
                {
                  label: "Giá Steam",
                  value: "steam",
                  icon: () => <FaSteam className="size-4.5 text-sky-400" />,
                },
              ]}
              selectedValues={priceSourceFilters}
              onChange={(values) => setPriceSourceFilters(values)}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
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
            <ViewButton table={table} />
          </div>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="animate-fade-slide-in flex items-center justify-between border-b border-red-500/20 bg-red-950/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-400">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-stone-300">
              vật phẩm được chọn
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setRowSelection({})}
              className="border-stone-850 inline-flex h-8 cursor-pointer items-center justify-center rounded-md border bg-stone-900/60 px-3 text-xs font-semibold text-stone-400 transition-all hover:bg-stone-900 hover:text-stone-200"
            >
              Hủy chọn
            </Button>
            <Button
              type="button"
              onClick={() => setSellDialogOpen(true)}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accent px-3.5 text-xs font-bold text-slate-950 shadow-md shadow-blue-950/20 transition-all hover:bg-accent-hover"
            >
              <ShoppingBag className="size-3 text-slate-950" />
              <span>Bán đã chọn</span>
            </Button>
            <Button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeletingMany}
              className="bg-red-650 hover:bg-red-750 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-bold text-white shadow-md shadow-red-950/20 transition-all disabled:cursor-wait disabled:opacity-50"
            >
              {isDeletingMany ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3 text-red-200" />
              )}
              <span>Xóa đã chọn</span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
