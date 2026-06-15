import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { TbPackage } from "react-icons/tb";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccountStorageUnitsProps {
  steamId64: string;
  onSelectStorageUnit: (su: {
    id: string;
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
    }>;
  }) => void;
}

export function AccountStorageUnits({
  steamId64,
  onSelectStorageUnit,
}: AccountStorageUnitsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: storageUnits, isLoading } = useQuery({
    queryKey: ["account-storage-units", steamId64],
    queryFn: async () => {
      const res = await fetch(
        `/api/portfolio/storage-units?steamId64=${steamId64}`,
      );
      if (!res.ok) throw new Error("Failed to fetch storage units");
      const data = await res.json();
      return data.storageUnits as Array<{
        id: string;
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
        }>;
      }>;
    },
    enabled: isExpanded,
  });

  return (
    <div className="mt-1.5 rounded border border-stone-800 bg-stone-950/25">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full cursor-pointer items-center justify-between rounded-t px-2.5 py-1.5 text-[11px] font-semibold text-stone-400 transition-colors hover:bg-stone-900/20 hover:text-stone-300"
      >
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span>Storage Units</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </Button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="storage-units-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-1 max-h-[200px] space-y-1.5 overflow-y-auto border-t border-stone-800/40 p-2.5 pt-1.5 pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-2.5">
                  <Loader2 className="size-3.5 animate-spin text-stone-500" />
                </div>
              ) : storageUnits && storageUnits.length > 0 ? (
                storageUnits.map((su) => (
                  <Button
                    key={su.id}
                    type="button"
                    onClick={() => onSelectStorageUnit(su)}
                    className="border-stone-850/60 group flex w-full cursor-pointer items-center justify-between rounded border bg-stone-900/40 p-2 text-left text-[11px] font-medium text-stone-300 transition-all duration-150 hover:border-amber-500/30 hover:bg-stone-900/80 active:scale-[0.99]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <TbPackage className="size-3.5 shrink-0 text-amber-400 transition-transform group-hover:scale-110" />
                      <span className="truncate font-semibold text-stone-200 transition-colors group-hover:text-amber-400">
                        {su.name}
                      </span>
                    </div>
                    <span className="border-stone-850/80 ml-2 shrink-0 rounded-sm border bg-stone-950/90 px-1.5 py-0.5 font-mono text-[10px] text-stone-400">
                      {su.currentCount} items
                    </span>
                  </Button>
                ))
              ) : (
                <div className="py-2.5 text-center text-[10px] text-stone-500">
                  Không có Storage Unit nào
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
