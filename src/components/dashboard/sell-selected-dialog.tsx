"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PortfolioTableRow } from "./portfolio-table-model";
import { formatPercent } from "@/utils/format";
import { useCurrency } from "@/components/currency-provider";
import { CaseThumbnail } from "./case-thumbnail";
import { SellSelectedDialogItemRow } from "./sell-selected-dialog-item-row";

type SellSelectedDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedItems: PortfolioTableRow[];
  allItems?: PortfolioTableRow[];
  onDelete: (id: string) => Promise<void> | void;
  onUpdateQuantity: (id: string, quantity: number) => Promise<void> | void;
  onClearSelection: () => void;
  wholesaleRate: number;
  retailRate: number;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
};

export function SellSelectedDialog({
  open,
  onClose,
  selectedItems,
  allItems,
  onDelete,
  onUpdateQuantity,
  onClearSelection,
  wholesaleRate,
  retailRate,
  buffPricesCny,
  buffCnyToVndRate,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

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
      setSearchQuery("");
    }
  }, [open]);

  // Exclude single item from active selection list
  const excludeItem = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    // Filter allItems: must have a valid currentPrice and match the query
    return (allItems ?? []).filter((item) => {
      const hasPrice =
        item.currentPrice !== null &&
        item.currentPrice !== undefined &&
        item.currentPrice > 0;
      if (!hasPrice) return false;

      return (
        item.case.name.toLowerCase().includes(query) ||
        (item.case.marketHashName &&
          item.case.marketHashName.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, allItems]);

  // Initialize sell quantities when list opens
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    selectedItems.forEach((item) => {
      initialQuantities[item.id] = item.quantity;
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItemRetailRates(initialRetailRates);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItemWholesaleRates(initialWholesaleRates);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuffCnyPrices(initialCnyPrices);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Perform sale for a single item
  const executeSingleSell = async (itemId: string, sellQty: number) => {
    const item = selectedItems.find((x) => x.id === itemId);
    if (!item) return;

    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      if (sellQty >= item.quantity) {
        // Full sell -> Delete completely
        await onDelete(itemId);
      } else {
        // Partial sell -> Deduct quantity
        const nextQty = item.quantity - sellQty;
        await onUpdateQuantity(itemId, nextQty);
      }
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
        if (sellQty >= item.quantity) {
          await onDelete(item.id);
        } else {
          const nextQty = item.quantity - sellQty;
          await onUpdateQuantity(item.id, nextQty);
        }
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

          {/* Grid Layout: Asymmetric 3/4 Table + 1/4 Sidebar Statistics */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-4">
            {/* Left Section: Interactive Items Table (takes 3 columns) */}
            <div className="flex min-h-0 scrollbar-thin scrollbar-thumb-stone-800 flex-col space-y-2.5 overflow-y-auto pr-1 lg:col-span-3">
              {/* Item Search Bar */}
              <div className="border-stone-850 relative z-20 mb-3 rounded-[6px] border bg-stone-950/40 p-3">
                <label className="mb-1.5 block font-mono text-[10px] font-extrabold tracking-widest text-stone-400 uppercase">
                  Thêm nhanh vật phẩm từ Portfolio
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="size-4 text-stone-500" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() =>
                      setTimeout(() => setIsSearchFocused(false), 200)
                    }
                    placeholder="Nhập tên vật phẩm trong kho để thêm..."
                    className="w-full rounded-[4px] border border-stone-800 bg-stone-950/80 py-2 pr-4 pl-9 text-xs font-medium text-stone-100 transition-all outline-none placeholder:text-stone-600 focus:border-blue-500/50"
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-500 hover:text-stone-300"
                    >
                      <X className="size-4" />
                    </Button>
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
                        const isAlreadyAdded = activeItems.some(
                          (x) => x.id === item.id,
                        );
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              handleAddItem(item);
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

            {/* Right Section: Sidebar Summary & Confirmation (takes 1 column) */}
            <div className="flex shrink-0 flex-col justify-between gap-6 border-t border-stone-800/80 pt-4 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <div className="space-y-4">
                <h3 className="font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
                  Thống kê phiên bán
                </h3>

                <div className="space-y-4.5 rounded-[5px] border border-stone-800 bg-gradient-to-b from-stone-950/60 to-stone-950/20 p-4.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
                  {/* Total Invested */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] font-medium tracking-wider text-stone-500 uppercase">
                      Tổng vốn thu hồi
                    </span>
                    <span className="font-mono text-sm font-bold text-stone-300">
                      {formatCurrency(metrics.totalInvested)}
                    </span>
                  </div>

                  {/* Total Current Value */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] font-medium tracking-wider text-stone-500 uppercase">
                      Tổng tiền nhận về
                    </span>
                    <span className="font-mono text-sm font-extrabold text-stone-200">
                      {formatCurrency(metrics.totalCurrentValue)}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="my-1 border-t border-stone-800/60" />

                  {/* Realized Profit/Loss block */}
                  <div
                    className={`rounded-[5px] border p-4 transition-all duration-300 ${
                      metrics.profitAmount >= 0
                        ? "border-emerald-500/20 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.02)] hover:border-emerald-500/30"
                        : "border-red-500/20 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.02)] hover:border-red-500/30"
                    }`}
                  >
                    <span className="font-mono text-[9px] font-bold tracking-widest text-stone-500 uppercase">
                      Ước tính Lãi/Lỗ ròng
                    </span>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {metrics.profitAmount >= 0 ? (
                          <div className="flex size-5 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                            <TrendingUp className="size-3" />
                          </div>
                        ) : (
                          <div className="flex size-5 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
                            <TrendingDown className="size-3" />
                          </div>
                        )}
                        <span
                          className={`font-mono text-xl leading-none font-black tracking-tight ${metrics.profitAmount >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {metrics.profitAmount >= 0 ? "+" : ""}
                          {formatCurrency(metrics.profitAmount)}
                        </span>
                      </div>
                      <div className="flex">
                        <span
                          className={`rounded-[3px] border px-2 py-0.5 font-mono text-[10px] font-black shadow-sm ${
                            metrics.profitAmount >= 0
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.05)]"
                              : "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.05)]"
                          }`}
                        >
                          {metrics.profitPercent >= 0 ? "+" : ""}
                          {formatPercent(metrics.profitPercent)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-auto space-y-2">
                <Button
                  onClick={() => setConfirmBulk(true)}
                  disabled={itemsCount === 0 || bulkLoading}
                  className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border-none bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 text-xs font-black tracking-widest text-stone-950 uppercase shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300 hover:from-blue-400 hover:to-blue-400 hover:shadow-[0_0_28px_rgba(245,158,11,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {bulkLoading ? (
                    <Loader2 className="size-4 animate-spin text-stone-950" />
                  ) : (
                    <span className="flex items-center gap-1.5 font-mono">
                      Bán tất cả đã chọn
                    </span>
                  )}
                </Button>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    disabled={bulkLoading}
                    className="border-slate-850 h-9 w-full cursor-pointer rounded-[4px] border bg-slate-950/40 font-mono text-xs font-bold text-stone-400 transition-all hover:border-slate-800 hover:bg-slate-900/40 hover:text-stone-200"
                  >
                    Đóng cửa sổ
                  </Button>
                </DialogClose>
              </div>
            </div>
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
