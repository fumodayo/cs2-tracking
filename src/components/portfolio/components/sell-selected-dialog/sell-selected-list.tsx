"use client";

import { AlertCircle } from "lucide-react";
import type { PortfolioTableRow } from "../../portfolio-table-model";
import { SellSelectedDialogItemRow } from "../../sell-selected-dialog-item-row";
import { motion, AnimatePresence } from "framer-motion";

interface SellSelectedListProps {
  activeItems: PortfolioTableRow[];
  sellQuantities: Record<string, number>;
  loadingIds: Set<string>;
  wholesaleRate: number;
  retailRate: number;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  buffCnyPrices: Record<string, string>;
  setBuffCnyPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  buffRates: Record<string, string>;
  setBuffRates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemRetailRates: Record<string, string>;
  itemWholesaleRates: Record<string, string>;
  itemStickerRates: Record<string, string>;
  getItemStickerScanTotal: (item: PortfolioTableRow) => number;
  accessoryPriceMap: Map<string, number>;
  handleQuantityChange: (id: string, value: number, maxQuantity: number) => void;
  handleWholesaleRateChange: (id: string, value: string) => void;
  handleRetailRateChange: (id: string, value: string) => void;
  handleStickerRateChange: (id: string, value: string) => void;
  setConfirmSingle: React.Dispatch<
    React.SetStateAction<{
      open: boolean;
      itemId: string;
      quantity: number;
      itemName: string;
    } | null>
  >;
  excludeItem: (id: string) => void;
  formatCurrency: (value: number) => string;
}

export function SellSelectedList({
  activeItems,
  sellQuantities,
  loadingIds,
  wholesaleRate,
  retailRate,
  buffPricesCny,
  buffCnyToVndRate,
  buffCnyPrices,
  setBuffCnyPrices,
  buffRates,
  setBuffRates,
  itemRetailRates,
  itemWholesaleRates,
  itemStickerRates,
  getItemStickerScanTotal,
  accessoryPriceMap,
  handleQuantityChange,
  handleWholesaleRateChange,
  handleRetailRateChange,
  handleStickerRateChange,
  setConfirmSingle,
  excludeItem,
  formatCurrency,
}: SellSelectedListProps) {
  const itemsCount = activeItems.length;

  return (
    <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-stone-900 pr-1 space-y-2.5 pb-24">
      {itemsCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2px] border border-dashed border-stone-800 bg-stone-955/20 py-20 text-center">
          <AlertCircle className="mb-2 size-8 text-stone-600" />
          <p className="text-sm font-semibold text-stone-300">
            Không có vật phẩm nào được chọn
          </p>
          <p className="mt-1 font-mono text-xs text-stone-500">
            Đóng hộp thoại và tích chọn vật phẩm trên bảng chính để bắt đầu
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 pb-4">
          <AnimatePresence initial={false} mode="popLayout">
            {activeItems.map((item) => {
              const maxQty = item.quantity;
              const sellQty = sellQuantities[item.id] !== undefined ? sellQuantities[item.id] : maxQty;
              const isLoading = loadingIds.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -15, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 38,
                    mass: 1,
                  }}
                >
                  <SellSelectedDialogItemRow
                    item={item}
                    isLoading={isLoading}
                    sellQty={sellQty}
                    maxQty={maxQty}
                    wholesaleRate={wholesaleRate}
                    retailRate={retailRate}
                    buffPricesCny={buffPricesCny}
                    buffCnyToVndRate={buffCnyToVndRate}
                    buffCnyPrices={buffCnyPrices}
                    setBuffCnyPrices={setBuffCnyPrices}
                    buffRates={buffRates}
                    setBuffRates={setBuffRates}
                    itemRetailRates={itemRetailRates}
                    itemWholesaleRates={itemWholesaleRates}
                    itemStickerRates={itemStickerRates}
                    getItemStickerScanTotal={getItemStickerScanTotal}
                    accessoryPriceMap={accessoryPriceMap}
                    handleQuantityChange={handleQuantityChange}
                    handleWholesaleRateChange={handleWholesaleRateChange}
                    handleRetailRateChange={handleRetailRateChange}
                    handleStickerRateChange={handleStickerRateChange}
                    setConfirmSingle={setConfirmSingle}
                    excludeItem={excludeItem}
                    formatCurrency={formatCurrency}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
