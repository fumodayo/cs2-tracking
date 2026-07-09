'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { PortfolioTableRow } from './portfolio-table-model';
import type { PortfolioReportRowDto } from '@/types/report';
import { useCurrency } from '@/components/currency-provider';
import { SellSelectedSearch } from './components/sell-selected-search';

import { SellSelectedList } from './components/sell-selected-dialog/sell-selected-list';
import { SellSelectedFooter } from './components/sell-selected-dialog/sell-selected-footer';
import {
  SellSelectedConfirmDialogs,
  type SellSelectedConfirmSingleState,
} from './components/sell-selected-dialog/sell-selected-confirm-dialogs';
import { SellSelectedDialogHeader } from './components/sell-selected-dialog/sell-selected-dialog-header';
import { SellSelectedLoadingOverlay } from './components/sell-selected-dialog/sell-selected-loading-overlay';
import { useAccessoryPrices } from '@/hooks/use-accessory-prices';
import {
  calculateSellSelectedMetrics,
  getDefaultSellSelectedBuffCnyPrice,
  hasSellSelectedBuffFilterMatch,
  hasSellSelectedBuffPricing,
  splitSellSelectedItem,
} from './sell-selected-dialog-utils';

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
  lastSelectedId?: string | null;
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
  lastSelectedId,
}: SellSelectedDialogProps) {
  const splitSelectedItems = useMemo(() => {
    return selectedItems.flatMap((item) => splitSellSelectedItem(item, originalRows));
  }, [selectedItems, originalRows]);
  const { formatCurrency } = useCurrency();
  // Số lượng cần bán, key theo item ID
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});

  // Vật phẩm thêm tay qua tìm kiếm
  const [manuallyAddedItems, setManuallyAddedItems] = useState<PortfolioTableRow[]>([]);

  // Override rate theo từng vật phẩm (lẻ và sỉ), key theo item ID
  const [itemRetailRates, setItemRetailRates] = useState<Record<string, string>>({});
  const [itemWholesaleRates, setItemWholesaleRates] = useState<Record<string, string>>({});
  // Override rate sticker theo từng vật phẩm, key theo item ID
  const [itemStickerRates, setItemStickerRates] = useState<Record<string, string>>({});

  // Với vật phẩm BUFF: giá Buff CNY và tỷ giá CNY nhập theo từng item ID
  const [buffCnyPrices, setBuffCnyPrices] = useState<Record<string, string>>({});
  const [buffRates, setBuffRates] = useState<Record<string, string>>({});

  // Danh sách loại trừ local (vật phẩm bỏ khỏi list)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Theo dõi thao tác từng vật phẩm đang chạy
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  // Theo dõi thao tác hàng loạt đang chạy
  const [bulkLoading, setBulkLoading] = useState(false);

  // Trạng thái xác nhận
  const [confirmSingle, setConfirmSingle] = useState<SellSelectedConfirmSingleState | null>(null);

  const [confirmBulk, setConfirmBulk] = useState(false);
  const [isBulkSellListExpanded, setIsBulkSellListExpanded] = useState(false);

  useEffect(() => {
    if (!confirmBulk) {
      setIsBulkSellListExpanded(false);
    }
  }, [confirmBulk]);

  // Trạng thái lọc nhóm định giá
  const [priceFilter, setPriceFilter] = useState<'all' | 'buff' | 'steam'>('all');

  // Theo dõi thứ tự vật phẩm được thêm hoặc active lại
  const [addedOrder, setAddedOrder] = useState<string[]>([]);

  // Xóa loại trừ và khởi tạo thứ tự vật phẩm khi trạng thái dialog đổi
  useEffect(() => {
    if (open) {
      setExcludedIds(new Set());
      setManuallyAddedItems([]);

      const ids = splitSelectedItems.map((item) => item.id);
      if (lastSelectedId) {
        const matchingSplitIds = ids.filter(
          (id) => id === lastSelectedId || id.startsWith(`${lastSelectedId}_split_`)
        );
        const otherIds = ids.filter((id) => !matchingSplitIds.includes(id));
        setAddedOrder([...matchingSplitIds, ...otherIds]);
      } else {
        setAddedOrder(ids);
      }

      setPriceFilter('all');
    }
  }, [open, splitSelectedItems, lastSelectedId]);

  const combinedItems = useMemo(() => {
    const itemMap = new Map<string, PortfolioTableRow>();
    splitSelectedItems.forEach((item) => itemMap.set(item.id, item));
    manuallyAddedItems.forEach((item) => itemMap.set(item.id, item));

    // Sắp xếp vật phẩm theo thời điểm được thêm/active lại
    const ordered = addedOrder
      .map((id) => itemMap.get(id))
      .filter((item): item is PortfolioTableRow => !!item);

    // Fallback cho vật phẩm chưa có trong addedOrder
    const seen = new Set(ordered.map((item) => item.id));
    const remaining = [...manuallyAddedItems, ...splitSelectedItems].filter(
      (item) => !seen.has(item.id)
    );

    return [...ordered, ...remaining];
  }, [splitSelectedItems, manuallyAddedItems, addedOrder]);

  // Loại một vật phẩm khỏi danh sách chọn active
  const excludeItem = useCallback(
    (id: string) => {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        next.add(id);

        const originalId = id.includes('_split_') ? id.split('_split_')[0] : id;
        if (onDeselectItem) {
          const allSplitsForOriginal = combinedItems.filter(
            (item) => item.id === originalId || item.id.startsWith(`${originalId}_split_`)
          );
          const allExcluded = allSplitsForOriginal.every(
            (item) => item.id === id || next.has(item.id)
          );
          if (allExcluded) {
            onDeselectItem(originalId);
          }
        }

        return next;
      });
    },
    [combinedItems, onDeselectItem]
  );

  const activeItems = useMemo(() => {
    const filtered = combinedItems.filter((item) => !excludedIds.has(item.id));
    if (priceFilter === 'all') return filtered;

    return filtered.filter((item) => {
      const hasBuffPrice = hasSellSelectedBuffFilterMatch(item, buffPricesCny);
      return priceFilter === 'buff' ? hasBuffPrice : !hasBuffPrice;
    });
  }, [combinedItems, excludedIds, priceFilter, buffPricesCny]);

  const activeAccessories = useMemo(() => {
    return activeItems.flatMap((item) => [
      ...(item.patternInfo?.stickers ?? []),
      ...(item.patternInfo?.charms ?? []),
    ]);
  }, [activeItems]);

  const { priceMap: accessoryPriceMap } = useAccessoryPrices(activeAccessories);

  const getItemStickerScanTotal = useCallback(
    (item: PortfolioTableRow) => {
      if (item.stickerScanTotalPrice !== undefined) {
        return item.stickerScanTotalPrice;
      }
      const stickers = item.patternInfo?.stickers ?? [];
      const charms = item.patternInfo?.charms ?? [];
      if (stickers.length === 0 && charms.length === 0) return 0;
      return [...stickers, ...charms].reduce((sum, acc) => {
        if (!acc.marketHashName) return sum;
        return sum + (accessoryPriceMap.get(acc.marketHashName) ?? 0);
      }, 0);
    },
    [accessoryPriceMap]
  );

  const handleAddItem = useCallback(
    (item: PortfolioTableRow) => {
      const splitItems = splitSellSelectedItem(item);

      // Kết quả tìm kiếm có thể thêm lại dòng active, khôi phục dòng đã loại, hoặc thêm dòng mới.
      splitItems.forEach((split) => {
        // Nếu vật phẩm đã có trong activeItems và chưa bị loại
        const existingActive = activeItems.find((x) => x.id === split.id);
        if (existingActive) {
          // Đưa lên đầu danh sách thứ tự
          setAddedOrder((prev) => {
            const next = prev.filter((id) => id !== split.id);
            return [split.id, ...next];
          });

          // Tăng số lượng thêm 1, tối đa bằng số lượng trong kho
          const currentQty =
            sellQuantities[split.id] !== undefined
              ? sellQuantities[split.id]
              : existingActive.quantity;
          const nextQty = Math.min(existingActive.quantity, currentQty + 1);
          setSellQuantities((prev) => ({
            ...prev,
            [split.id]: nextQty,
          }));
          return;
        }

        // Nếu trước đó đã bị loại, xóa khỏi excludedIds, reset số lượng và đưa lên đầu
        if (excludedIds.has(split.id)) {
          setExcludedIds((prev) => {
            const next = new Set(prev);
            next.delete(split.id);
            return next;
          });
          setAddedOrder((prev) => {
            const next = prev.filter((id) => id !== split.id);
            return [split.id, ...next];
          });
          // Tăng số lượng bán nếu đã khởi tạo, nếu chưa thì khởi tạo
          setSellQuantities((prev) => ({
            ...prev,
            [split.id]: Math.min(split.quantity, (prev[split.id] || 0) + 1),
          }));
          return;
        }

        // Thêm vào manuallyAddedItems
        setManuallyAddedItems((prev) => [...prev, split]);
        // Thêm vào đầu addedOrder
        setAddedOrder((prev) => [split.id, ...prev]);

        // Khởi tạo state cho vật phẩm mới
        setSellQuantities((prev) => ({
          ...prev,
          [split.id]: 1, // Start at 1 for manually added items
        }));

        setItemRetailRates((prev) => ({
          ...prev,
          [split.id]: String(retailRate),
        }));

        setItemWholesaleRates((prev) => ({
          ...prev,
          [split.id]: String(wholesaleRate),
        }));

        setItemStickerRates((prev) => ({
          ...prev,
          [split.id]: '0',
        }));

        const hasBuff = hasSellSelectedBuffPricing(split);

        if (hasBuff) {
          const defaultCny = getDefaultSellSelectedBuffCnyPrice({
            item: split,
            buffPricesCny,
            buffCnyToVndRate,
          });
          setBuffCnyPrices((prev) => ({
            ...prev,
            [split.id]: String(Number(defaultCny.toFixed(2))),
          }));
          setBuffRates((prev) => ({
            ...prev,
            [split.id]: String(buffCnyToVndRate ?? 3600),
          }));
        }
      });
    },
    [
      activeItems,
      sellQuantities,
      excludedIds,
      retailRate,
      wholesaleRate,
      buffPricesCny,
      buffCnyToVndRate,
    ]
  );

  // Khởi tạo số lượng bán khi danh sách mở
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    splitSelectedItems.forEach((item) => {
      initialQuantities[item.id] = item.quantity;
    });
    setSellQuantities(initialQuantities);
  }, [splitSelectedItems]);

  // Khởi tạo rate vật phẩm khi danh sách mở
  useEffect(() => {
    const initialRetailRates: Record<string, string> = {};
    const initialWholesaleRates: Record<string, string> = {};
    const initialStickerRates: Record<string, string> = {};
    const initialCnyPrices: Record<string, string> = {};
    const initialRatesCny: Record<string, string> = {};

    splitSelectedItems.forEach((item) => {
      const hasBuff = hasSellSelectedBuffPricing(item);

      initialRetailRates[item.id] = String(retailRate);
      initialWholesaleRates[item.id] = String(wholesaleRate);
      initialStickerRates[item.id] = '0';

      if (hasBuff) {
        const defaultCny = getDefaultSellSelectedBuffCnyPrice({
          item,
          buffPricesCny,
          buffCnyToVndRate,
        });
        initialCnyPrices[item.id] = String(Number(defaultCny.toFixed(2)));
        initialRatesCny[item.id] = String(buffCnyToVndRate ?? 3600);
      }
    });

    setItemRetailRates(initialRetailRates);
    setItemWholesaleRates(initialWholesaleRates);
    setItemStickerRates(initialStickerRates);
    setBuffCnyPrices(initialCnyPrices);
    setBuffRates(initialRatesCny);
  }, [splitSelectedItems, wholesaleRate, retailRate, buffPricesCny, buffCnyToVndRate]);

  const getSellQuantity = (id: string, maxQuantity: number) => {
    const val = sellQuantities[id];
    if (val === undefined) return maxQuantity;
    return val;
  };

  const handleQuantityChange = useCallback((id: string, value: number, maxQuantity: number) => {
    const nextVal = Math.max(1, Math.min(maxQuantity, value));
    setSellQuantities((prev) => ({
      ...prev,
      [id]: nextVal,
    }));
  }, []);

  const handleRetailRateChange = useCallback((id: string, value: string) => {
    setItemRetailRates((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  const handleWholesaleRateChange = useCallback((id: string, value: string) => {
    setItemWholesaleRates((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  const handleStickerRateChange = useCallback((id: string, value: string) => {
    setItemStickerRates((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  // Helper phân bổ lượt bán của vật phẩm đã gom nhóm qua các item trong database
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

  // Thực hiện bán một vật phẩm
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
      excludeItem(itemId);
    } catch (err) {
      console.error('Sale failed for item:', itemId, err);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      // Nếu đã bán vật phẩm cuối cùng thì đóng dialog
      if (activeItems.length <= 1) {
        onClose();
        onClearSelection();
      }
    }
  };

  // Thực hiện bán toàn bộ vật phẩm
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
      console.error('Bulk sale failed:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  // Tính chỉ số realtime dựa trên số lượng bán tùy chỉnh và rate từng vật phẩm
  const metrics = useMemo(
    () =>
      calculateSellSelectedMetrics({
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
        itemStickerRates,
        getItemStickerScanTotal,
      }),
    [
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
      itemStickerRates,
      getItemStickerScanTotal,
    ]
  );

  const itemsCount = activeItems.length;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !bulkLoading && !val && onClose()}>
        <DialogContent className="bg-card text-foreground shadow-soft flex max-h-[92vh] max-w-7xl flex-col overflow-hidden rounded-[2px] border border-stone-800 p-6 backdrop-blur-3xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.95)]">
          {bulkLoading && <SellSelectedLoadingOverlay />}
          <SellSelectedDialogHeader itemsCount={itemsCount} />

          {/* Main Content: Interactive Items Table */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <SellSelectedSearch
              allItems={allItems}
              activeItems={activeItems}
              onAddItem={handleAddItem}
              formatCurrency={formatCurrency}
              buffPricesCny={buffPricesCny}
              priceFilter={priceFilter}
              setPriceFilter={setPriceFilter}
            />

            <SellSelectedList
              activeItems={activeItems}
              sellQuantities={sellQuantities}
              loadingIds={loadingIds}
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

            <SellSelectedFooter
              bulkLoading={bulkLoading}
              itemsCount={itemsCount}
              metrics={metrics}
              formatCurrency={formatCurrency}
              onConfirmBulk={() => setConfirmBulk(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <SellSelectedConfirmDialogs
        confirmSingle={confirmSingle}
        onCloseSingle={() => setConfirmSingle(null)}
        onConfirmSingle={executeSingleSell}
        confirmBulk={confirmBulk}
        onCloseBulk={() => setConfirmBulk(false)}
        onConfirmBulk={executeBulkSell}
        itemsCount={itemsCount}
        activeItems={activeItems}
        isBulkSellListExpanded={isBulkSellListExpanded}
        onToggleBulkSellListExpanded={() => setIsBulkSellListExpanded((value) => !value)}
        getSellQuantity={getSellQuantity}
      />
    </>
  );
}
