"use client";

import React, { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { CaseThumbnail } from "./case-thumbnail";
import { formatCurrency } from "@/utils/format";

import { Button } from "@/components/ui/button";
export interface CaseItemSearchData {
  id: string;
  name: string;
  marketHashName: string;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface CaseSearchResult {
  caseItem: CaseItemSearchData;
  price: number;
}

interface CaseSearchSelectProps {
  selectedCase: CaseItemSearchData | null;
  onSelect: (caseItem: CaseItemSearchData, price: number) => void;
  onClear: () => void;
  placeholder?: string;
  label?: string;
}

export const CaseSearchSelect: React.FC<CaseSearchSelectProps> = ({
  selectedCase,
  onSelect,
  onClear,
  placeholder,
  label,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CaseSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Clear query and results when selectedCase is set
  useEffect(() => {
    if (selectedCase) {
      setQuery("");
      setResults([]);
    }
  }, [selectedCase]);

  // Search cases with debounce and race condition prevention
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    let active = true;

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/inventory/search-case?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (active) {
          setResults(data.results || []);
        }
      } catch {
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [query]);

  const handleInputChange = (value: string) => {
    setQuery(value);
  };

  if (selectedCase) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-blue-500/20 bg-blue-500/5 p-3.5 transition-all duration-300">
        <div className="flex min-w-0 items-center gap-3.5">
          <CaseThumbnail
            imageUrl={selectedCase.imageUrl || undefined}
            name={selectedCase.name}
            size="md"
          />
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-blue-400">
              {selectedCase.name}
            </span>
            <span className="mt-1 block truncate text-xs text-stone-500">
              {selectedCase.marketHashName}
            </span>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => {
            onClear();
            setQuery("");
            setResults([]);
          }}
          className="hover:bg-stone-850 shrink-0 cursor-pointer rounded border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-300 transition-colors hover:border-stone-700"
        >
          Thay đổi
        </Button>
      </div>
    );
  }

  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-semibold text-stone-300"
        htmlFor="case-search"
      >
        {label || "Tìm kiếm vật phẩm"}
      </label>
      <div className="flex items-center gap-2 rounded-md border border-stone-800 bg-stone-950/70 px-3 py-0.5">
        <Search className="size-4 text-stone-500" />
        <input
          id="case-search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder || "Ví dụ: Kilowatt Case..."}
          className="h-10 w-full bg-transparent text-sm text-stone-200 outline-none placeholder:text-stone-600"
        />
        {loading && <Loader2 className="size-4 animate-spin text-stone-500" />}
      </div>

      {query.trim().length > 0 && results.length > 0 && (
        <div className="relative z-10 mt-2 max-h-48 divide-y divide-stone-900/40 overflow-auto rounded-md border border-stone-800 bg-stone-950 shadow-2xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-stone-950 [&::-webkit-scrollbar-thumb]:bg-stone-850 hover:[&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-thumb]:rounded-full">
          {results.map((r) => (
            <button
              type="button"
              key={r.caseItem.id}
              onClick={() => {
                onSelect(r.caseItem, r.price);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-stone-300 transition-all hover:bg-stone-900/60 hover:text-stone-100 focus:bg-stone-900/60 outline-none first:rounded-t-md last:rounded-b-md"
            >
              <span className="flex min-w-0 items-center gap-3">
                <CaseThumbnail
                  imageUrl={r.caseItem.imageUrl || undefined}
                  name={r.caseItem.name}
                  size="sm"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-200">
                    {r.caseItem.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-stone-500">
                    {r.caseItem.marketHashName}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-stone-400">
                {r.price > 0 ? formatCurrency(r.price) : "Chưa có giá"}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim() && results.length === 0 && !loading && (
        <div className="mt-2 rounded-md border border-stone-800 bg-stone-950 px-4 py-6 text-center text-sm text-stone-500 shadow-xl">
          Không tìm thấy vật phẩm nào phù hợp
        </div>
      )}
    </div>
  );
};
