"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { FaSteam, FaCoins } from "react-icons/fa";
import { CaseThumbnail } from "../case-thumbnail";
import { useTranslation } from "react-i18next";
import type { PortfolioTableRow } from "../portfolio-table-model";
import { motion } from "framer-motion";

interface SellSelectedSearchProps {
  allItems?: PortfolioTableRow[];
  activeItems: PortfolioTableRow[];
  onAddItem: (item: PortfolioTableRow) => void;
  formatCurrency: (value: number) => string;
  buffPricesCny?: Record<string, number>;
  priceFilter: "all" | "buff" | "steam";
  setPriceFilter: (value: "all" | "buff" | "steam") => void;
}

export function SellSelectedSearch({
  allItems,
  activeItems,
  onAddItem,
  formatCurrency,
  buffPricesCny,
  priceFilter,
  setPriceFilter,
}: SellSelectedSearchProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    const filtered = (allItems ?? []).filter((item) => {
      const hasPrice =
        item.currentPrice !== null &&
        item.currentPrice !== undefined &&
        item.currentPrice > 0;
      if (!hasPrice) return false;

      let keep = true;
      if (priceFilter !== "all") {
        const hasBuffPrice =
          (item.itemType === "skin" &&
            item.currentPrice !== null &&
            item.steamPrice !== null &&
            item.steamPrice !== undefined &&
            item.currentPrice !== item.steamPrice) ||
          (!!buffPricesCny &&
            buffPricesCny[item.case.marketHashName] !== undefined &&
            buffPricesCny[item.case.marketHashName] > 0);

        if (priceFilter === "buff" && !hasBuffPrice) keep = false;
        if (priceFilter === "steam" && hasBuffPrice) keep = false;
      }

      if (!keep) return false;

      return (
        item.case.name.toLowerCase().includes(query) ||
        (item.case.marketHashName &&
          item.case.marketHashName.toLowerCase().includes(query))
      );
    });

    return filtered;
  }, [searchQuery, allItems, priceFilter, buffPricesCny]);

  return (
    <div ref={containerRef} className="relative z-20 mb-3 rounded-[2px] border border-stone-800 bg-card p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="font-mono text-[9px] font-extrabold tracking-widest text-stone-400 dark:text-stone-500">
          {t("portfolio.quickAddItem", "Quick add items from Portfolio")}
        </label>
        
        {/* Pricing segmented filter control */}
        <div className="relative flex items-center gap-0.5 rounded-[2px] bg-card p-0.5 border border-stone-800 shadow-inner">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPriceFilter("all")}
            className={`relative flex items-center gap-1 rounded-[2px] px-2.5 py-0.5 font-mono text-[9px] font-bold transition-all cursor-pointer z-10 ${
              priceFilter === "all" ? "text-blue-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {priceFilter === "all" && (
              <motion.div
                layoutId="activePricingFilterBg"
                className="absolute inset-0 -z-10 rounded-[2px] bg-blue-955/40 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {t("common.all", "All")}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPriceFilter("buff")}
            className={`relative flex items-center gap-1 rounded-[2px] px-2.5 py-0.5 font-mono text-[9px] font-bold transition-all cursor-pointer z-10 ${
              priceFilter === "buff" ? "text-amber-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {priceFilter === "buff" && (
              <motion.div
                layoutId="activePricingFilterBg"
                className="absolute inset-0 -z-10 rounded-[2px] bg-amber-955/40 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <FaCoins className={`size-2.5 ${priceFilter === "buff" ? "text-amber-500 dark:text-amber-400" : "text-stone-600"}`} />
            {t("portfolio.pricingBuff", "BUFF Price")}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPriceFilter("steam")}
            className={`relative flex items-center gap-1 rounded-[2px] px-2.5 py-0.5 font-mono text-[9px] font-bold transition-all cursor-pointer z-10 ${
              priceFilter === "steam" ? "text-sky-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {priceFilter === "steam" && (
              <motion.div
                layoutId="activePricingFilterBg"
                className="absolute inset-0 -z-10 rounded-[2px] bg-sky-955/40 border border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.15)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <FaSteam className={`size-2.5 ${priceFilter === "steam" ? "text-sky-500 dark:text-sky-400" : "text-stone-600"}`} />
            {t("portfolio.pricingSteam", "Steam Price")}
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="size-4 text-stone-500" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          placeholder={t("portfolio.searchPlaceholderQuickAdd", "Enter item name in stock to add...")}
          className="w-full rounded-[2px] border border-stone-800 bg-card py-2 pr-9 pl-9 text-xs font-mono font-medium text-foreground transition-all outline-none placeholder:text-stone-500 focus:border-blue-500/40 focus:shadow-[0_0_10px_rgba(59,130,246,0.1)]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isSearchFocused && searchQuery.trim() && (
        <div className="absolute right-3 left-3 z-50 mt-1 max-h-60 overflow-y-auto rounded-[2px] border border-stone-800 bg-card shadow-2xl divide-y divide-stone-800 scrollbar-thin scrollbar-thumb-stone-800 pr-0.5">
          {searchResults.length === 0 ? (
            <div className="p-3 text-center font-mono text-xs text-stone-500">
              {t("portfolio.noValidPriceItemsFound", "No items found with a valid price")}
            </div>
          ) : (
            searchResults.map((item) => {
              const isAlreadyAdded = activeItems.some((x) => x.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onAddItem(item);
                    setSearchQuery("");
                  }}
                  className="flex w-full cursor-pointer items-center justify-between p-2.5 text-left transition-colors hover:bg-stone-900/30 border-none bg-transparent"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[2px] border border-stone-850 bg-stone-950 p-0.5 shadow-inner">
                      <CaseThumbnail
                        imageUrl={item.case.imageUrl}
                        name={item.case.name}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="truncate text-xs font-bold text-stone-200"
                        title={item.case.name}
                      >
                        {item.case.name}
                      </div>
                      <div className="mt-0.5 flex gap-2 font-mono text-[10px] text-stone-550">
                        <span>
                          {t("portfolio.stockShort", "Stock")}:{" "}
                          <strong className="text-stone-400">
                            {item.quantity}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          {t("portfolio.priceShort", "Price")}:{" "}
                          <strong className="text-blue-400">
                            {formatCurrency(item.currentPrice ?? 0)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`inline-flex shrink-0 items-center justify-center gap-2 font-medium h-6 rounded-[2px] px-2.5 font-mono text-[9px] font-black tracking-wider uppercase transition-all ${
                      isAlreadyAdded
                        ? "border border-blue-500/25 bg-blue-950/20 text-blue-400 hover:bg-blue-950/40"
                        : "border border-emerald-500/25 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-500 hover:text-stone-950"
                    }`}
                  >
                    {isAlreadyAdded ? t("portfolio.addOneItemShort", "+1 Item") : t("portfolio.addItemShort", "Add")}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
