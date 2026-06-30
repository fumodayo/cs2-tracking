"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CryptoItem } from "./donate-types";

interface CryptoTabProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCryptoList: CryptoItem[];
  onSelectCrypto: (crypto: CryptoItem) => void;
}

export function CryptoTab({
  searchQuery,
  setSearchQuery,
  filteredCryptoList,
  onSelectCrypto,
}: CryptoTabProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col w-full">
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          type="text"
          placeholder={t("donate.searchPlaceholder", "Search cryptocurrency...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full border border-border/80 bg-card-alt/40 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-accent/60 focus:ring-accent/10 rounded-xl"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 size-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground text-xs cursor-pointer bg-foreground/5 rounded-full"
          >
            ✕
          </button>
        )}
      </div>

      {/* Coins Grid */}
      {filteredCryptoList.length === 0 ? (
        <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-dashed border-border bg-card-alt/20 text-center text-xs text-muted-foreground p-6">
          {t("donate.noCryptoFound", "No cryptocurrency found")}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {filteredCryptoList.map((crypto) => (
            <button
              key={crypto.id}
              type="button"
              onClick={() => onSelectCrypto(crypto)}
              className="group flex flex-col items-center justify-between rounded-xl border border-border/80 bg-card-alt/30 p-3.5 transition-all duration-300 hover:border-accent hover:bg-card-alt cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <div className="flex-1 flex items-center justify-center p-1.5">
                <img
                  src={crypto.iconUrl}
                  alt={crypto.name}
                  className="size-10 object-contain transition-all duration-300 group-hover:scale-105"
                />
              </div>
              <div className="mt-2 text-center w-full">
                <span className="block truncate text-[11px] font-bold tracking-tight text-foreground/85 group-hover:text-foreground">
                  {crypto.name}
                </span>
                <span className="block text-[9px] font-extrabold text-muted-foreground uppercase">
                  {crypto.symbol}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
