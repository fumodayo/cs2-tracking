"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { FaSteam, FaCoins } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { CaseThumbnail } from "../case-thumbnail";
import type { PortfolioTableRow } from "../portfolio-table-model";

interface SellSelectedSearchProps {
  allItems?: PortfolioTableRow[];
  activeItems: PortfolioTableRow[];
  onAddItem: (item: PortfolioTableRow) => void;
  formatCurrency: (value: number) => string;
  buffPricesCny?: Record<string, number>;
}

export function SellSelectedSearch({
  allItems,
  activeItems,
  onAddItem,
  formatCurrency,
  buffPricesCny,
}: SellSelectedSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [priceFilter, setPriceFilter] = useState<"all" | "buff" | "steam">("all");
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
          !!buffPricesCny &&
          buffPricesCny[item.case.marketHashName] !== undefined &&
          buffPricesCny[item.case.marketHashName] > 0;

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
    <div ref={containerRef} className="border-stone-850 relative z-20 mb-3 rounded-[6px] border bg-stone-950/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="font-mono text-[10px] font-extrabold tracking-widest text-stone-400 uppercase">
          Thêm nhanh vật phẩm từ Portfolio
        </label>
        
        {/* Pricing segmented filter control */}
        <div className="flex items-center gap-1 rounded bg-stone-950/60 p-0.5 border border-stone-850">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPriceFilter("all")}
            className={`flex items-center gap-1 rounded-[3px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase transition-all cursor-pointer ${
              priceFilter === "all"
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                : "text-stone-500 hover:text-stone-300 border border-transparent"
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPriceFilter("buff")}
            className={`flex items-center gap-1 rounded-[3px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase transition-all cursor-pointer ${
              priceFilter === "buff"
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                : "text-stone-500 hover:text-stone-300 border border-transparent"
            }`}
          >
            <FaCoins className={`size-2.5 ${priceFilter === "buff" ? "text-amber-400" : "text-stone-600"}`} />
            Giá BUFF
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPriceFilter("steam")}
            className={`flex items-center gap-1 rounded-[3px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase transition-all cursor-pointer ${
              priceFilter === "steam"
                ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                : "text-stone-500 hover:text-stone-300 border border-transparent"
            }`}
          >
            <FaSteam className={`size-2.5 ${priceFilter === "steam" ? "text-sky-400" : "text-stone-600"}`} />
            Giá Steam
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
          placeholder="Nhập tên vật phẩm trong kho để thêm..."
          className="w-full rounded-[4px] border border-stone-800 bg-stone-950/80 py-2 pr-9 pl-9 text-xs font-medium text-stone-100 transition-all outline-none placeholder:text-stone-600 focus:border-blue-500/50"
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
        <div className="divide-stone-850 absolute right-3 left-3 z-50 mt-1 max-h-60 scrollbar-thin scrollbar-thumb-stone-800 divide-y overflow-y-auto rounded-[5px] border border-stone-800 bg-[#090d16] shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
          {searchResults.length === 0 ? (
            <div className="p-3 text-center font-mono text-xs text-stone-500">
              Không tìm thấy vật phẩm nào có giá hợp lệ
            </div>
          ) : (
            searchResults.map((item) => {
              const isAlreadyAdded = activeItems.some((x) => x.id === item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onAddItem(item);
                    setSearchQuery("");
                  }}
                  className="flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-stone-900/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="border-stone-850 flex size-9 shrink-0 items-center justify-center rounded border bg-stone-950 p-0.5">
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
                      <div className="mt-0.5 flex gap-2 font-mono text-[10px] text-stone-500">
                        <span>
                          Kho:{" "}
                          <strong className="text-stone-300">
                            {item.quantity}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Giá:{" "}
                          <strong className="text-blue-400">
                            {formatCurrency(item.currentPrice ?? 0)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className={`h-6 rounded-[3px] px-2.5 font-mono text-[10px] font-black tracking-wider uppercase transition-all ${
                      isAlreadyAdded
                        ? "border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                        : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-stone-950"
                    }`}
                  >
                    {isAlreadyAdded ? "+1 Cái" : "Thêm"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
