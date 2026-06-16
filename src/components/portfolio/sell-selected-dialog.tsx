"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PortfolioTableRow } from "./portfolio-table-model";
import type { PortfolioReportRowDto } from "@/types/report";
import { useCurrency } from "@/components/currency-provider";
import { SellSelectedDialogItemRow } from "./sell-selected-dialog-item-row";
import { SellSelectedSearch } from "./components/sell-selected-search";

type SellSelectedDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedItems: PortfolioTableRow[];
  allItems?: PortfolioTableRow[];
  originalRows?: PortfolioReportRowDto[];
  onDelete: (id: string) => Promise<void> | void;
  onUpdateQuantity: (id: string, quantity: number) => Promise<void> | void;
  onClearSelection: () => void;
  wholesaleRate: number;
  retailRate: number;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  onDeselectItem?: (id: string) => void;
};

export function SellSelectedDialog({
  open,
  onClose,
  selectedItems,
  allItems,
  originalRows,
  onDelete,
  onUpdateQuantity,
  onClearSelection,
  wholesaleRate,
  retailRate,
  buffPricesCny,
  buffCnyToVndRate,
  onDeselectItem,
}: SellSelectedDialogProps) {
  const { formatCurrency } = useCurrency();
  // Quantities to sell, keyed by item ID
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>(
    {},
  );

  // Manually added items via search
  const [manuallyAddedItems, setManuallyAddedItems] = useState<
    PortfolioTableRow[]
  >([]);

  // Per-item rate overrides (retail & wholesale), keyed by item ID
  const [itemRetailRates, setItemRetailRates] = useState<
    Record<string, string>
  >({});
  const [itemWholesaleRates, setItemWholesaleRates] = useState<
    Record<string, string>
  >({});

  // For BUFF items: Buff CNY price and CNY rate input values per item ID
  const [buffCnyPrices, setBuffCnyPrices] = useState<Record<string, string>>(
    {},
  );
  const [buffRates, setBuffRates] = useState<Record<string, string>>({});

  // Local list exclusions (trash items)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Track individual item actions in progress
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  // Track bulk action in progress
  const [bulkLoading, setBulkLoading] = useState(false);

  // Confirmation states
  const [confirmSingle, setConfirmSingle] = useState<{
    open: boolean;
    itemId: string;
    quantity: number;
    itemName: string;
  } | null>(null);

  const [confirmBulk, setConfirmBulk] = useState(false);

  // Clear exclusions when dialog state changes
  useEffect(() => {
    if (open) {
      setExcludedIds(new Set());
      setManuallyAddedItems([]);
    }
  }, [open]);

  // Exclude single item from active selection list
  const excludeItem = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (onDeselectItem) {
      onDeselectItem(id);
    }
  };

  const combinedItems = useMemo(() => {
    // Merge selectedItems and manuallyAddedItems, avoiding duplicates by id
    const seen = new Set(selectedItems.map((item) => item.id));
    const uniqueManual = manuallyAddedItems.filter(
      (item) => !seen.has(item.id),
    );
    return [...selectedItems, ...uniqueManual];
  }, [selectedItems, manuallyAddedItems]);

  const activeItems = useMemo(() => {
    return combinedItems.filter((item) => !excludedIds.has(item.id));
  }, [combinedItems, excludedIds]);

  const handleAddItem = (item: PortfolioTableRow) => {
    // If it's already in activeItems (not excluded)
    const existingActive = activeItems.find((x) => x.id === item.id);
    if (existingActive) {
      // Increment quantity by 1, up to the maximum inventory quantity
      const currentQty =
        sellQuantities[item.id] !== undefined
          ? sellQuantities[item.id]
          : existingActive.quantity;
      const nextQty = Math.min(existingActive.quantity, currentQty + 1);
      setSellQuantities((prev) => ({
        ...prev,
        [item.id]: nextQty,
      }));
      return;
    }

    // If it was excluded before, remove from excludedIds and reset its quantity
    if (excludedIds.has(item.id)) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      // Increment its sell quantity if it was already initialized, or initialize it
      setSellQuantities((prev) => ({
        ...prev,
        [item.id]: Math.min(item.quantity, (prev[item.id] || 0) + 1),
      }));
      return;
    }

    // Add to manuallyAddedItems
    setManuallyAddedItems((prev) => [...prev, item]);

    // Initialize state for the new item
    setSellQuantities((prev) => ({
      ...prev,
      [item.id]: 1, // Start at 1 for manually added items
    }));

    setItemRetailRates((prev) => ({
      ...prev,
      [item.id]: String(retailRate),
    }));

    setItemWholesaleRates((prev) => ({
      ...prev,
      [item.id]: String(wholesaleRate),
    }));

    const hasBuff =
      item.itemType === "skin" &&
      item.currentPrice !== null &&
      item.steamPrice !== null &&
      item.steamPrice !== undefined &&
      item.currentPrice !== item.steamPrice;

    if (hasBuff) {
      const defaultCny =
        buffPricesCny?.[item.case.marketHashName] ??
        (item.currentPrice
          ? item.currentPrice / (buffCnyToVndRate ?? 3600)
          : 0);
      setBuffCnyPrices((prev) => ({
        ...prev,
        [item.id]: String(Number(defaultCny.toFixed(2))),
      }));
      setBuffRates((prev) => ({
        ...prev,
        [item.id]: String(buffCnyToVndRate ?? 3600),
      }));
    }
  };


  // Initialize sell quantities when list opens
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    selectedItems.forEach((item) => {
      initialQuantities[item.id] = item.quantity;
    });
    setSellQuantities(initialQuantities);
  }, [selectedItems]);

  // Initialize item rates when list opens
  useEffect(() => {
    const initialRetailRates: Record<string, string> = {};
    const initialWholesaleRates: Record<string, string> = {};
    const initialCnyPrices: Record<string, string> = {};
    const initialRatesCny: Record<string, string> = {};

    selectedItems.forEach((item) => {
      const hasBuff =
        item.itemType === "skin" &&
        item.currentPrice !== null &&
        item.steamPrice !== null &&
        item.steamPrice !== undefined &&
        item.currentPrice !== item.steamPrice;

      initialRetailRates[item.id] = String(retailRate);
      initialWholesaleRates[item.id] = String(wholesaleRate);

      if (hasBuff) {
        // Find default CNY price
        const defaultCny =
          buffPricesCny?.[item.case.marketHashName] ??
          (item.currentPrice
            ? item.currentPrice / (buffCnyToVndRate ?? 3600)
            : 0);
        initialCnyPrices[item.id] = String(Number(defaultCny.toFixed(2)));
        initialRatesCny[item.id] = String(buffCnyToVndRate ?? 3600);
      }
    });

    setItemRetailRates(initialRetailRates);
    setItemWholesaleRates(initialWholesaleRates);
    setBuffCnyPrices(initialCnyPrices);
    setBuffRates(initialRatesCny);
  }, [
    selectedItems,
    wholesaleRate,
    retailRate,
    buffPricesCny,
    buffCnyToVndRate,
  ]);

  const getSellQuantity = (id: string, maxQuantity: number) => {
    const val = sellQuantities[id];
    if (val === undefined) return maxQuantity;
    return val;
  };

  const handleQuantityChange = (
    id: string,
    value: number,
    maxQuantity: number,
  ) => {
    const nextVal = Math.max(1, Math.min(maxQuantity, value));
    setSellQuantities((prev) => ({
      ...prev,
      [id]: nextVal,
    }));
  };

  const handleRetailRateChange = (id: string, value: string) => {
    setItemRetailRates((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleWholesaleRateChange = (id: string, value: string) => {
    setItemWholesaleRates((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Helper to distribute a sale of grouped items across database items
  const sellItems = async (itemIds: string[], totalQtyToSell: number) => {
    let remainingSellQty = totalQtyToSell;

    const matchingItems = (originalRows || [])
      .filter((row) => itemIds.includes(row.item.id))
      .map((row) => row.item)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const dbItem of matchingItems) {
      if (remainingSellQty <= 0) break;
      if (dbItem.quantity <= remainingSellQty) {
        await onDelete(dbItem.id);
        remainingSellQty -= dbItem.quantity;
      } else {
        await onUpdateQuantity(dbItem.id, dbItem.quantity - remainingSellQty);
        remainingSellQty = 0;
      }
    }
  };

  // Perform sale for a single item
  const executeSingleSell = async (itemId: string, sellQty: number) => {
    const item = combinedItems.find((x) => x.id === itemId);
    if (!item) return;

    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      await sellItems(item.itemIds, sellQty);
    } catch (err) {
      console.error("Sale failed for item:", itemId, err);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      // If we sold the last item, close the dialog
      if (activeItems.length <= 1) {
        onClose();
        onClearSelection();
      }
    }
  };

  // Perform sale for all items
  const executeBulkSell = async () => {
    setBulkLoading(true);
    try {
      for (const item of activeItems) {
        const sellQty = getSellQuantity(item.id, item.quantity);
        await sellItems(item.itemIds, sellQty);
      }
      onClearSelection();
      onClose();
    } catch (err) {
      console.error("Bulk sale failed:", err);
    } finally {
      setBulkLoading(false);
    }
  };

  // Real-time metrics calculations based on customized sell quantities and per-item rates
  const metrics = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;

    activeItems.forEach((item) => {
      const qty =
        sellQuantities[item.id] !== undefined
          ? sellQuantities[item.id]
          : item.quantity;

      const hasBuff =
        item.itemType === "skin" &&
        item.currentPrice !== null &&
        item.steamPrice !== null &&
        item.steamPrice !== undefined &&
        item.currentPrice !== item.steamPrice;

      const unitBuy = item.buyPrice;
      let unitCurrent = item.currentPrice ?? item.buyPrice;

      if (hasBuff) {
        const cnyPriceVal = Number(
          buffCnyPrices[item.id] !== undefined
            ? buffCnyPrices[item.id]
            : (buffPricesCny?.[item.case.marketHashName] ??
                (item.currentPrice
                  ? item.currentPrice / (buffCnyToVndRate ?? 3600)
                  : 0)),
        );
        const cnyRateVal = Number(
          buffRates[item.id] !== undefined
            ? buffRates[item.id]
            : (buffCnyToVndRate ?? 3600),
        );
        unitCurrent = Math.round(cnyPriceVal * cnyRateVal);
      }

      let unitSellDynamic = unitCurrent;

      if (!hasBuff) {
        const itemRetailRateVal = Number(
          itemRetailRates[item.id] !== undefined
            ? itemRetailRates[item.id]
            : retailRate,
        );
        const itemWholesaleRateVal = Number(
          itemWholesaleRates[item.id] !== undefined
            ? itemWholesaleRates[item.id]
            : wholesaleRate,
        );

        const rateDynamic =
          qty < item.quantity ? itemRetailRateVal : itemWholesaleRateVal;
        unitSellDynamic = Math.round(unitCurrent * (rateDynamic / 100));
      }

      totalInvested += unitBuy * qty;
      totalCurrentValue += unitSellDynamic * qty;
    });

    const profitAmount = totalCurrentValue - totalInvested;
    const profitPercent =
      totalInvested > 0 ? (profitAmount / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      profitAmount,
      profitPercent,
    };
  }, [
    activeItems,
    sellQuantities,
    itemRetailRates,
    itemWholesaleRates,
    wholesaleRate,
    retailRate,
    buffCnyPrices,
    buffRates,
    buffPricesCny,
    buffCnyToVndRate,
  ]);

  const itemsCount = activeItems.length;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(val) => !bulkLoading && !val && onClose()}
      >
        <DialogContent className="flex max-h-[92vh] max-w-7xl flex-col overflow-hidden rounded-[6px] border-stone-800/80 bg-[#06080c]/98 p-6 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-3xl">
          {/* Main Modal Spinner overlay when bulk loading */}
          {bulkLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#06080c]/90 backdrop-blur-md transition-all duration-300">
              <Loader2 className="mb-3 size-10 animate-spin text-blue-400" />
              <p className="font-mono text-sm font-black tracking-widest text-stone-200 uppercase">
                Đang cập nhật Portfolio...
              </p>
              <p className="mt-1 font-mono text-xs text-stone-500">
                Dữ liệu đang được đồng bộ lên hệ thống
              </p>
            </div>
          )}

          <DialogHeader className="mb-4 border-b border-stone-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[4px] border border-blue-500/25 bg-blue-500/10 text-blue-400 shadow-inner">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-wider text-stone-100 uppercase">
                  Xác nhận bán{" "}
                  <span className="font-mono font-black text-blue-400">
                    {itemsCount}
                  </span>{" "}
                  loại vật phẩm
                </DialogTitle>
                <DialogDescription className="mt-0.5 font-mono text-xs text-stone-500">
                  Vui lòng kiểm tra kỹ đơn hàng trước khi bán
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Main Content: Interactive Items Table */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <SellSelectedSearch
              allItems={allItems}
              activeItems={activeItems}
              onAddItem={handleAddItem}
              formatCurrency={formatCurrency}
              buffPricesCny={buffPricesCny}
            />

            {/* Scrollable list items */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-stone-800 pr-1 space-y-2.5 pb-24">
              {itemsCount === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[4px] border border-dashed border-stone-800 bg-stone-950/20 py-20 text-center">
                  <AlertCircle className="mb-2 size-8 text-stone-600" />
                  <p className="text-sm font-semibold text-stone-400">
                    Không có vật phẩm nào được chọn
                  </p>
                  <p className="mt-1 font-mono text-xs text-stone-600">
                    Đóng modal và tích chọn vật phẩm trên bảng chính để bắt đầu
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 pb-4">
                  {activeItems.map((item) => {
                    const maxQty = item.quantity;
                    const sellQty = getSellQuantity(item.id, maxQty);
                    const isLoading = loadingIds.has(item.id);

                    return (
                      <SellSelectedDialogItemRow
                        key={item.id}
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
                        handleQuantityChange={handleQuantityChange}
                        handleWholesaleRateChange={handleWholesaleRateChange}
                        handleRetailRateChange={handleRetailRateChange}
                        setConfirmSingle={setConfirmSingle}
                        excludeItem={excludeItem}
                        formatCurrency={formatCurrency}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Absolute overlay at the bottom with floating control dock */}
            {itemsCount > 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-4 rounded-[6px] border border-stone-800/80 bg-stone-950/90 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-md">
                <div className="flex items-center gap-6">
                  {/* Total Current Value Metric */}
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                      Tổng nhận về
                    </span>
                    <span className="mt-0.5 font-mono text-base font-extrabold text-stone-100">
                      {formatCurrency(metrics.totalCurrentValue)}
                    </span>
                  </div>

                  {/* Divider vertical */}
                  <div className="h-8 border-l border-stone-800/80" />

                  {/* Net Profit/Loss Metric */}
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                      Lãi/Lỗ ước tính
                    </span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`font-mono text-base font-black tracking-tight ${
                          metrics.profitAmount >= 0 ? "text-emerald-400" : "text-red-500"
                        }`}
                      >
                        {metrics.profitAmount >= 0 ? "+" : ""}
                        {formatCurrency(metrics.profitAmount).replace(/\s*[đ₫]/g, "").trim()}
                      </span>
                      <span
                        className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-black ${
                          metrics.profitAmount >= 0
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-red-500/20 bg-red-500/10 text-red-400"
                        }`}
                      >
                        {metrics.profitPercent >= 0 ? "+" : ""}
                        {metrics.profitPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Button Sell All */}
                <button
                  onClick={() => setConfirmBulk(true)}
                  disabled={bulkLoading}
                  className="pointer-events-auto flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-blue-500/20 bg-gradient-to-r from-blue-600 to-blue-550 px-6 shadow-[0_4px_20px_rgba(37,99,235,0.2)] transition-all duration-300 hover:from-blue-500 hover:to-blue-450 hover:shadow-[0_4px_25px_rgba(37,99,235,0.35)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {bulkLoading ? (
                    <Loader2 className="size-4 animate-spin text-stone-950" />
                  ) : (
                    <>
                      <ShoppingBag className="size-3.5 text-stone-950 fill-stone-950/20" />
                      <span className="font-sans text-[11px] font-extrabold tracking-wider text-stone-950 uppercase">
                        Bán tất cả đã chọn
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog for single row sell */}
      {confirmSingle && (
        <ConfirmDialog
          open={confirmSingle.open}
          onClose={() => setConfirmSingle(null)}
          title="Xác nhận giao dịch bán"
          description={`Bạn có chắc chắn muốn bán ${confirmSingle.quantity} vật phẩm "${confirmSingle.itemName}"? Thao tác này sẽ cập nhật số lượng hoặc xóa vĩnh viễn khỏi danh mục portfolio của bạn.`}
          confirmText="Xác nhận Bán"
          cancelText="Hủy"
          variant="primary"
          onConfirm={() =>
            executeSingleSell(confirmSingle.itemId, confirmSingle.quantity)
          }
        />
      )}

      {/* Confirm dialog for bulk sell */}
      {confirmBulk && (
        <ConfirmDialog
          open={confirmBulk}
          onClose={() => setConfirmBulk(false)}
          title="Xác nhận Bán Tất Cả Vật Phẩm Đã Chọn"
          description={`Bạn có chắc chắn muốn thực hiện bán toàn bộ ${itemsCount} loại vật phẩm đã cấu hình ở trên không? Số lượng tương ứng sẽ bị trừ hoặc xóa hoàn toàn khỏi portfolio của bạn.`}
          confirmText="Đồng ý, Bán tất cả"
          cancelText="Hủy"
          variant="danger"
          onConfirm={executeBulkSell}
        />
      )}
    </>
  );
}
