import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { TbPackage } from 'react-icons/tb';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import {
  STORAGE_UNITS_QUERY_KEY,
  fetchAccountStorageUnits,
  type StorageUnitDto,
} from '@/lib/api-client/steam-accounts-api';

interface AccountStorageUnitsProps {
  steamId64: string;
  onSelectStorageUnit: (su: {
    id: string;
    steamId64?: string;
    name: string;
    currentCount: number;
    maxCapacity: number;
    items: Array<{
      caseId: string;
      marketHashName: string;
      name: string;
      imageUrl?: string;
      rarity?: { name: string; color: string } | null;
      quantity: number;
      storageUnitItems?: Array<{
        storageUnitId: string;
        quantity: number;
      }>;
    }>;
  }) => void;
}

export function AccountStorageUnits({ steamId64, onSelectStorageUnit }: AccountStorageUnitsProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: storageUnits, isLoading } = useQuery({
    queryKey: STORAGE_UNITS_QUERY_KEY(steamId64),
    queryFn: () => fetchAccountStorageUnits(steamId64, { aggregate: true }),
    enabled: isExpanded,
    staleTime: 5 * 60 * 1000,
  });

  const displayStorageUnits = useMemo(
    () => aggregateStorageUnits(storageUnits ?? [], steamId64),
    [storageUnits, steamId64]
  );

  return (
    <div
      className={cn(
        'relative z-10 mt-1.5 rounded-lg border transition-all duration-300',
        isExpanded
          ? 'border-stone-800/80 bg-stone-950/70 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]'
          : 'border-stone-800 bg-stone-950/20'
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full cursor-pointer items-center justify-between rounded-t px-3 py-2 text-[11px] font-bold text-stone-400 transition-colors hover:bg-stone-900/15 hover:text-stone-200"
      >
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          <span>{t('steamAccounts.storageUnits', 'Storage Units')}</span>
        </span>
        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </Button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="storage-units-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1 max-h-[200px] space-y-1.5 overflow-y-auto border-t border-stone-800/30 p-3 pt-1.5 pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-2.5">
                  <Loader2 className="size-3.5 animate-spin text-stone-500" />
                </div>
              ) : displayStorageUnits.length > 0 ? (
                displayStorageUnits.map((su) => (
                  <Button
                    key={su.id}
                    type="button"
                    onClick={() => onSelectStorageUnit(su)}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-lg border border-stone-800/80 bg-stone-900/20 p-2 text-left text-[11px] font-bold text-stone-300 transition-all duration-200 hover:border-amber-500/25 hover:bg-stone-900/50 hover:shadow-[0_2px_8px_rgba(245,158,11,0.02)] active:scale-[0.99]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <TbPackage className="size-4 shrink-0 text-amber-500 transition-transform group-hover:scale-110" />
                      <span className="truncate text-stone-200 transition-colors group-hover:text-amber-400">
                        {su.name === 'Storage Unit'
                          ? t('steamAccounts.storageUnitSingle', 'Storage Unit')
                          : su.name}
                      </span>
                    </div>
                    <span className="ml-2 shrink-0 rounded-full border border-stone-800/80 bg-stone-950/80 px-2 py-0.5 font-mono text-[9px] font-medium text-stone-400">
                      {t('portfolio.itemsCount', { count: su.currentCount })}
                    </span>
                  </Button>
                ))
              ) : (
                <div className="py-2.5 text-center text-[10px] text-stone-500">
                  {t('steamAccounts.noStorageUnits', 'No Storage Units found')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function aggregateStorageUnits(
  storageUnits: StorageUnitDto[],
  steamId64: string
): StorageUnitDto[] {
  if (storageUnits.length <= 1) {
    return storageUnits.map((su) => ({
      ...su,
      steamId64: su.steamId64 ?? steamId64,
      items: su.items.map((item) => ({
        ...item,
        storageUnitItems:
          item.storageUnitItems && item.storageUnitItems.length > 0
            ? item.storageUnitItems
            : [{ storageUnitId: su.id, quantity: item.quantity }],
      })),
    }));
  }

  const itemMap = new Map<string, StorageUnitDto['items'][number]>();

  for (const su of storageUnits) {
    for (const item of su.items) {
      const key = item.caseId || item.marketHashName;
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.storageUnitItems = [
          ...(existing.storageUnitItems ?? []),
          { storageUnitId: su.id, quantity: item.quantity },
        ];
      } else {
        itemMap.set(key, {
          ...item,
          storageUnitItems:
            item.storageUnitItems && item.storageUnitItems.length > 0
              ? item.storageUnitItems
              : [{ storageUnitId: su.id, quantity: item.quantity }],
        });
      }
    }
  }

  return [
    {
      id: `storage-units:${steamId64}`,
      steamId64,
      name: 'Storage Unit',
      currentCount: storageUnits.reduce((sum, su) => sum + su.currentCount, 0),
      maxCapacity: storageUnits.reduce((sum, su) => sum + su.maxCapacity, 0),
      items: Array.from(itemMap.values()).sort((first, second) =>
        first.name.localeCompare(second.name)
      ),
    },
  ];
}
