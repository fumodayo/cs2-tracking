/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { FaSteam, FaCoins } from "react-icons/fa";
import { TbCircleFilled, TbPencil, TbDatabase } from "react-icons/tb";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FilterPopover, ResetButton, ViewButton } from "@/components/ui/actions";
import { BuffRateInput } from "../portfolio-columns";
import { PortfolioSourceFilter, PortfolioTableMode, PortfolioTableRow } from "../portfolio-table-model";
import { Table } from "@tanstack/react-table";
import { PortfolioBulkActions } from "./portfolio-bulk-actions";
import type { TFunction } from "i18next";

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
  itemTypeOptions: Array<{ label: string; value: string; icon?: React.ComponentType<{ className?: string }> }>;
  t: TFunction;
  onRefreshPrices?: () => void;
  isRefreshingPrices?: boolean;
  onUpdateBuffRate?: (rate: number) => void;
  buffCnyToVndRate: number;
  table: Table<PortfolioTableRow>;
  
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
      <div className="flex flex-col gap-3 rounded-t-xl border-b border-stone-850 bg-stone-900/60 p-3">
        {/* Row 1: Modes, Rates & Search/Refresh Actions */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Modes & Rates */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="relative inline-flex h-9 items-center rounded-lg border border-border bg-surface-muted/40 p-1 shadow-sm select-none">
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
                    className="absolute inset-0 rounded-md bg-accent shadow-sm shadow-accent/10"
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
                    className="absolute inset-0 rounded-md bg-accent shadow-sm shadow-accent/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t("dashboard.viewMode", "Chi tiết")}</span>
              </button>
            </div>
            {onUpdateBuffRate && (
              <BuffRateInput
                value={buffCnyToVndRate}
                onChange={onUpdateBuffRate}
              />
            )}
          </div>

          {/* Search bar & Refresh Action */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex-1 lg:w-80">
              <label className="flex h-9 w-full items-center gap-2 rounded-md border border-input-border bg-input px-3 text-xs transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder={t("portfolio.searchPlaceholder", "Tìm vật phẩm, market hash, ghi chú...")}
                  className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>
            
            {onRefreshPrices && (
              <Button
                type="button"
                onClick={onRefreshPrices}
                disabled={isRefreshingPrices}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-stone-700 hover:bg-surface-hover disabled:cursor-wait disabled:opacity-50"
                title={t("portfolio.refreshPrices", "Refresh giá")}
              >
                <RefreshCcw
                  className={`size-3.5 text-blue-400 ${isRefreshingPrices ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">{t("portfolio.refreshPrices", "Refresh giá")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="bg-stone-850 -mx-3 h-px" />

        {/* Row 2: Filters */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-3 px-3">
            <span className="shrink-0 text-[10px] font-bold tracking-wider text-stone-500 uppercase select-none mr-1">
              {t("portfolio.filtersLabel", "Bộ lọc:")}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <FilterPopover
                label={t("portfolio.filterSource", "Nguồn")}
                options={[
                  { label: t("portfolio.sourceManual", "Thủ công"), value: "manual" },
                  { label: t("portfolio.sourceExisting", "Có sẵn"), value: "existing" },
                ]}
                selectedValues={sourceFilters}
                onChange={(values) => setSourceFilters(values as PortfolioSourceFilter[])}
              />
              <FilterPopover
                label={t("portfolio.filterItemType", "Loại vật phẩm")}
                options={itemTypeOptions}
                selectedValues={itemTypeFilters}
                onChange={(values) => setItemTypeFilters(values)}
              />
              <FilterPopover
                label={t("portfolio.filterAccount", "Tài khoản")}
                options={accountOptions.map((account) => ({
                  label: account.name,
                  value: account.steamId64,
                }))}
                selectedValues={accountFilters}
                onChange={(values) => setAccountFilters(values)}
                disabled={accountOptions.length === 0}
              />
              <FilterPopover
                label={t("portfolio.filterStatus", "Trạng thái")}
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
                label={t("portfolio.filterPricing", "Định giá")}
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
          </div>

          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-stone-850/60 lg:mt-0 lg:pt-0 lg:border-none lg:shrink-0 lg:gap-2 lg:self-auto">
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
        <PortfolioBulkActions
          selectedCount={selectedIds.length}
          onClearSelection={() => setRowSelection({})}
          onSellSelected={() => setSellDialogOpen(true)}
          onDeleteSelected={handleDeleteSelected}
          isDeletingMany={isDeletingMany}
        />
      )}
    </>
  );
}
