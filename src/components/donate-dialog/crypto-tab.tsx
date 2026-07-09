'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CryptoItem } from './donate-types';

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
    <div className="flex w-full flex-col">
      {/* Ô tìm kiếm */}
      <div className="relative mb-4">
        <Search className="text-muted-foreground/60 absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder={t('donate.searchPlaceholder', 'Search cryptocurrency...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-border/80 bg-card-alt/40 text-foreground placeholder:text-muted-foreground/40 focus:border-accent/60 focus:ring-accent/10 h-10 w-full rounded-xl border pr-10 pl-10 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-muted-foreground/60 hover:text-foreground bg-foreground/5 absolute top-1/2 right-3 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Lưới coin */}
      {filteredCryptoList.length === 0 ? (
        <div className="border-border bg-card-alt/20 text-muted-foreground flex h-48 w-full items-center justify-center rounded-2xl border border-dashed p-6 text-center text-xs">
          {t('donate.noCryptoFound', 'No cryptocurrency found')}
        </div>
      ) : (
        <div className="grid max-h-[300px] scrollbar-thin grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
          {filteredCryptoList.map((crypto) => (
            <button
              key={crypto.id}
              type="button"
              onClick={() => onSelectCrypto(crypto)}
              className="group border-border/80 bg-card-alt/30 hover:border-accent hover:bg-card-alt focus-visible:ring-accent/50 flex cursor-pointer flex-col items-center justify-between rounded-xl border p-3.5 transition-all duration-300 outline-none focus-visible:ring-2"
            >
              <div className="flex flex-1 items-center justify-center p-1.5">
                <img
                  src={crypto.iconUrl}
                  alt={crypto.name}
                  className="size-10 object-contain transition-all duration-300 group-hover:scale-105"
                />
              </div>
              <div className="mt-2 w-full text-center">
                <span className="text-foreground/85 group-hover:text-foreground block truncate text-[11px] font-bold tracking-tight">
                  {crypto.name}
                </span>
                <span className="text-muted-foreground block text-[9px] font-extrabold uppercase">
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
