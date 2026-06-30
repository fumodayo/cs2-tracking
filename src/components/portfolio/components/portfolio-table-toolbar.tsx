/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { FaSteam, FaCoins } from "react-icons/fa";
import { TbCircleFilled, TbPencil, TbDatabase } from "react-icons/tb";
import { RefreshCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FilterPopover, ResetButton, ViewButton } from "@/components/ui/actions";
import { BuffRateInput } from "../portfolio-columns";
import { PortfolioSourceFilter, PortfolioTableMode, PortfolioTableRow } from "../portfolio-table-model";
import { Table } from "@tanstack/react-table";
import { PortfolioBulkActions } from "./portfolio-bulk-actions";
import type { TFunction } from "i18next";
import { cn } from "@/utils/cn";

export const SOURCE_FILTER_OPTIONS: Array<{
  label: string;
  value: PortfolioSourceFilter;
  icon?: React.ComponentType<{ className?: string }>;
}> = [
    { label: "Th\u1ee7 c\u00f4ng", value: "manual", icon: TbPencil },
    { label: "C\u00f3 s\u1eb5n", value: "existing", icon: TbDatabase },
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-t-2xl border-b border-stone-850/60 bg-stone-900/40 backdrop-blur-md p-4">
        {/* Row 1: Modes, Rates & Search/Refresh Actions */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Modes & Rates */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="relative inline-flex h-9 items-center rounded-lg border border-stone-800 bg-surface-muted/20 p-1 shadow-sm select-none">
              <button
                type="button"
                onClick={() => setMode("case-summary")}
                className={`relative inline-flex items-center justify-center rounded-md px-3.5 py-1 text-[11.5px] font-extrabold transition-all duration-200 cursor-pointer h-7 ${mode === "case-summary"
                  ? "text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {mode === "case-summary" && (
                  <motion.div
                    layoutId="activeTabToolbar"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-accent to-accent-hover shadow-md shadow-accent/15"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t("dashboard.caseSummaryMode", "Group Cases")}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("transactions")}
                className={`relative inline-flex items-center justify-center rounded-md px-3.5 py-1 text-[11.5px] font-extrabold transition-all duration-200 cursor-pointer h-7 ${mode === "transactions"
                  ? "text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {mode === "transactions" && (
                  <motion.div
                    layoutId="activeTabToolbar"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-accent to-accent-hover shadow-md shadow-accent/15"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t("dashboard.viewMode", "Detail")}</span>
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
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className={cn(
              "flex-grow transition-all duration-300 ease-in-out lg:flex-initial",
              isSearchFocused ? "lg:w-[24rem]" : "lg:w-72"
            )}>
              <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/40 px-3 text-xs transition-all duration-200 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/25 focus-within:bg-stone-950/70 focus-within:shadow-[0_0_12px_rgba(59,130,246,0.06)]">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder={t("portfolio.searchPlaceholder", "Search items, market hash, notes...")}
                  className="w-full bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
                {globalFilter && (
                  <button
                    type="button"
                    onClick={() => setGlobalFilter("")}
                    className="text-stone-500 hover:text-stone-300 transition-colors p-0.5 rounded-full hover:bg-stone-800/60 shrink-0 cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </label>
            </div>

            {onRefreshPrices && (
              <Button
                type="button"
                onClick={onRefreshPrices}
                disabled={isRefreshingPrices}
                className="h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-stone-850 bg-stone-900/40 px-3.5 text-xs font-bold text-stone-200 shadow-sm transition-all duration-200 hover:border-accent/40 hover:bg-accent/5 hover:text-accent hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
                title={t("portfolio.refreshPrices", "Refresh prices")}
              >
                <RefreshCcw
                  className={cn("size-3.5 text-accent", isRefreshingPrices && "animate-spin")}
                />
                <span className="hidden sm:inline">{t("portfolio.refreshPrices", "Refresh prices")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="bg-stone-850/60 -mx-4 h-px" />

        {/* Row 2: Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
            <div className="flex items-center gap-1.5 shrink-0 select-none mr-2">
              <span className="text-xs font-bold    tracking-wider text-stone-500 uppercase">
                {t("portfolio.filtersLabel", "Filters:")}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <FilterPopover
                label={t("portfolio.filterSource", "Source")}
                options={[
                  { label: t("portfolio.sourceManual", "Manual"), value: "manual" },
                  { label: t("portfolio.sourceExisting", "Existing"), value: "existing" },
                ]}
                selectedValues={sourceFilters}
                onChange={(values) => setSourceFilters(values as PortfolioSourceFilter[])}
              />
              <FilterPopover
                label={t("portfolio.filterItemType", "Item Type")}
                options={itemTypeOptions}
                selectedValues={itemTypeFilters}
                onChange={(values) => setItemTypeFilters(values)}
              />
              <FilterPopover
                label={t("portfolio.filterAccount", "Account")}
                options={accountOptions.map((account) => ({
                  label: account.name,
                  value: account.steamId64,
                }))}
                selectedValues={accountFilters}
                onChange={(values) => setAccountFilters(values)}
                disabled={accountOptions.length === 0}
              />
              <FilterPopover
                label={t("portfolio.filterStatus", "Status")}
                options={[
                  {
                    label: t("portfolio.statusTradeable", "Tradeable"),
                    value: "tradeable",
                    icon: () => <TbCircleFilled className="size-3.5 text-emerald-500" />,
                  },
                  {
                    label: t("portfolio.statusOnMarket", "On Market"),
                    value: "market",
                    icon: () => <TbCircleFilled className="size-3.5 text-amber-500" />,
                  },
                  {
                    label: t("portfolio.statusTradeProtected", "Trade Protected"),
                    value: "protected",
                    icon: () => <TbCircleFilled className="size-3.5 text-blue-500" />,
                  },
                  {
                    label: t("portfolio.statusHold", "Hold"),
                    value: "hold",
                    icon: () => <TbCircleFilled className="size-3.5 text-red-500" />,
                  },
                ]}
                selectedValues={statusFilters}
                onChange={(values) => setStatusFilters(values)}
              />
              <FilterPopover
                label={t("portfolio.filterPricing", "Pricing")}
                options={[
                  {
                    label: t("portfolio.pricingBuff", "BUFF Price"),
                    value: "buff",
                    icon: () => <FaCoins className="size-4.5 text-amber-500" />,
                  },
                  {
                    label: t("portfolio.pricingSteam", "Steam Price"),
                    value: "steam",
                    icon: () => <FaSteam className="size-4.5 text-sky-400" />,
                  },
                ]}
                selectedValues={priceSourceFilters}
                onChange={(values) => setPriceSourceFilters(values)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-stone-850/60 lg:mt-0 lg:pt-0 lg:border-none lg:shrink-0 lg:gap-3 lg:self-auto">
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
