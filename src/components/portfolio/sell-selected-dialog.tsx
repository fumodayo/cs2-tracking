'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ShoppingBag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PortfolioTableRow } from './portfolio-table-model';
import type { PortfolioReportRowDto } from '@/types/report';
import { useCurrency } from '@/components/currency-provider';
import { SellSelectedSearch } from './components/sell-selected-search';

import { SellSelectedList } from './components/sell-selected-dialog/sell-selected-list';
import { SellSelectedFooter } from './components/sell-selected-dialog/sell-selected-footer';
import { useAccessoryPrices } from '@/hooks/use-accessory-prices';
import { splitSellSelectedItem } from './sell-selected-dialog-utils';

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
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  // Quantities to sell, keyed by item ID
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});

  // Manually added items via search
  const [manuallyAddedItems, setManuallyAddedItems] = useState<PortfolioTableRow[]>([]);

  // Per-item rate overrides (retail & wholesale), keyed by item ID
  const [itemRetailRates, setItemRetailRates] = useState<Record<string, string>>({});
  const [itemWholesaleRates, setItemWholesaleRates] = useState<Record<string, string>>({});
  // Per-item sticker rate overrides, keyed by item ID
  const [itemStickerRates, setItemStickerRates] = useState<Record<string, string>>({});

  // For BUFF items: Buff CNY price and CNY rate input values per item ID
  const [buffCnyPrices, setBuffCnyPrices] = useState<Record<string, string>>({});
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
  const [isBulkSellListExpanded, setIsBulkSellListExpanded] = useState(false);

  useEffect(() => {
    if (!confirmBulk) {
      setIsBulkSellListExpanded(false);
    }
  }, [confirmBulk]);

  // Pricing category filter state
  const [priceFilter, setPriceFilter] = useState<'all' | 'buff' | 'steam'>('all');

  // Track order in which items are added or re-activated
  const [addedOrder, setAddedOrder] = useState<string[]>([]);

  // Clear exclusions and initialize ordered items when dialog state changes
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

    // Order items by when they were added/re-activated
    const ordered = addedOrder
      .map((id) => itemMap.get(id))
      .filter((item): item is PortfolioTableRow => !!item);

    // Fallback for items that are not yet in addedOrder
    const seen = new Set(ordered.map((item) => item.id));
    const remaining = [...manuallyAddedItems, ...splitSelectedItems].filter(
      (item) => !seen.has(item.id)
    );

    return [...ordered, ...remaining];
  }, [splitSelectedItems, manuallyAddedItems, addedOrder]);

  // Exclude single item from active selection list
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
      const hasBuffPrice =
        (item.itemType === 'skin' &&
          item.currentPrice !== null &&
          item.steamPrice !== null &&
          item.steamPrice !== undefined &&
          item.currentPrice !== item.steamPrice) ||
        (!!buffPricesCny &&
          buffPricesCny[item.case.marketHashName] !== undefined &&
          buffPricesCny[item.case.marketHashName] > 0);

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

      splitItems.forEach((split) => {
        // If it's already in activeItems (not excluded)
        const existingActive = activeItems.find((x) => x.id === split.id);
        if (existingActive) {
          // Bring to top of the order list
          setAddedOrder((prev) => {
            const next = prev.filter((id) => id !== split.id);
            return [split.id, ...next];
          });

          // Increment quantity by 1, up to the maximum inventory quantity
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

        // If it was excluded before, remove from excludedIds, reset its quantity, and bring to top
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
          // Increment its sell quantity if it was already initialized, or initialize it
          setSellQuantities((prev) => ({
            ...prev,
            [split.id]: Math.min(split.quantity, (prev[split.id] || 0) + 1),
          }));
          return;
        }

        // Add to manuallyAddedItems
        setManuallyAddedItems((prev) => [...prev, split]);
        // Prepend to addedOrder
        setAddedOrder((prev) => [split.id, ...prev]);

        // Initialize state for the new item
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

        const hasBuff =
          split.itemType === 'skin' &&
          split.currentPrice !== null &&
          split.steamPrice !== null &&
          split.steamPrice !== undefined &&
          split.currentPrice !== split.steamPrice;

        if (hasBuff) {
          const defaultCny =
            buffPricesCny?.[split.case.marketHashName] ??
            (split.currentPrice ? split.currentPrice / (buffCnyToVndRate ?? 3600) : 0);
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

  // Initialize sell quantities when list opens
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    splitSelectedItems.forEach((item) => {
      initialQuantities[item.id] = item.quantity;
    });
    setSellQuantities(initialQuantities);
  }, [splitSelectedItems]);

  // Initialize item rates when list opens
  useEffect(() => {
    const initialRetailRates: Record<string, string> = {};
    const initialWholesaleRates: Record<string, string> = {};
    const initialStickerRates: Record<string, string> = {};
    const initialCnyPrices: Record<string, string> = {};
    const initialRatesCny: Record<string, string> = {};

    splitSelectedItems.forEach((item) => {
      const hasBuff =
        item.itemType === 'skin' &&
        item.currentPrice !== null &&
        item.steamPrice !== null &&
        item.steamPrice !== undefined &&
        item.currentPrice !== item.steamPrice;

      initialRetailRates[item.id] = String(retailRate);
      initialWholesaleRates[item.id] = String(wholesaleRate);
      initialStickerRates[item.id] = '0';

      if (hasBuff) {
        // Find default CNY price
        const defaultCny =
          buffPricesCny?.[item.case.marketHashName] ??
          (item.currentPrice ? item.currentPrice / (buffCnyToVndRate ?? 3600) : 0);
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
      excludeItem(itemId);
    } catch (err) {
      console.error('Sale failed for item:', itemId, err);
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
      console.error('Bulk sale failed:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  // Real-time metrics calculations based on customized sell quantities and per-item rates
  const metrics = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;

    activeItems.forEach((item) => {
      const qty = sellQuantities[item.id] !== undefined ? sellQuantities[item.id] : item.quantity;

      const hasBuff =
        item.itemType === 'skin' &&
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
                (item.currentPrice ? item.currentPrice / (buffCnyToVndRate ?? 3600) : 0))
        );
        const cnyRateVal = Number(
          buffRates[item.id] !== undefined ? buffRates[item.id] : (buffCnyToVndRate ?? 3600)
        );
        unitCurrent = Math.round(cnyPriceVal * cnyRateVal);
      }

      let unitSellDynamic = unitCurrent;

      if (!hasBuff) {
        const itemRetailRateVal = Number(
          itemRetailRates[item.id] !== undefined ? itemRetailRates[item.id] : retailRate
        );
        const itemWholesaleRateVal = Number(
          itemWholesaleRates[item.id] !== undefined ? itemWholesaleRates[item.id] : wholesaleRate
        );

        const rateDynamic = qty < item.quantity ? itemRetailRateVal : itemWholesaleRateVal;
        unitSellDynamic = Math.round(unitCurrent * (rateDynamic / 100));
      }

      // Add sticker price addition
      const stickerScanTotalPrice = getItemStickerScanTotal(item);
      if (stickerScanTotalPrice > 0) {
        const itemStickerRateVal = Number(
          itemStickerRates[item.id] !== undefined ? itemStickerRates[item.id] : 0
        );
        const stickerAddVnd = Math.round((stickerScanTotalPrice * itemStickerRateVal) / 100);
        unitSellDynamic += stickerAddVnd;
      }

      totalInvested += unitBuy * qty;
      totalCurrentValue += unitSellDynamic * qty;
    });

    const profitAmount = totalCurrentValue - totalInvested;
    const profitPercent = totalInvested > 0 ? (profitAmount / totalInvested) * 100 : 0;

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
    itemStickerRates,
    getItemStickerScanTotal,
  ]);

  const itemsCount = activeItems.length;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !bulkLoading && !val && onClose()}>
        <DialogContent className="bg-card text-foreground shadow-soft flex max-h-[92vh] max-w-7xl flex-col overflow-hidden rounded-[2px] border border-stone-800 p-6 backdrop-blur-3xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.95)]">
          {/* Main Modal Spinner overlay when bulk loading */}
          {bulkLoading && (
            <div className="bg-card/90 absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300">
              <Loader2 className="mb-3 size-10 animate-spin text-blue-400" />
              <p className="font-mono text-sm font-black tracking-widest text-stone-200 uppercase">
                {t('portfolio.updatingPortfolio', 'Updating Portfolio...')}
              </p>
              <p className="mt-1 font-mono text-xs text-stone-500">
                {t('portfolio.syncingData', 'Synchronizing data with the server...')}
              </p>
            </div>
          )}

          <DialogHeader className="mb-4 border-b border-stone-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-955/20 flex size-10 items-center justify-center rounded-[2px] border border-blue-500/25 text-blue-400 shadow-inner">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-wider text-stone-100">
                  {t('portfolio.confirmSell', 'Confirm Sale')}{' '}
                  <span className="font-mono font-black text-blue-400">{itemsCount}</span>{' '}
                  {t('portfolio.itemTypesCount', 'item type(s)')}
                </DialogTitle>
                <DialogDescription className="mt-0.5 font-mono text-xs text-stone-500">
                  {t(
                    'portfolio.doubleCheckOrder',
                    'Please review your sell list before proceeding'
                  )}
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

      {/* Confirm dialog for single row sell */}
      {confirmSingle && (
        <ConfirmDialog
          open={confirmSingle.open}
          onClose={() => setConfirmSingle(null)}
          title={t('portfolio.confirmSellTransaction', 'Confirm Sell Transaction')}
          description={t(
            'portfolio.confirmSellSingleDesc',
            'Are you sure you want to sell {{quantity}} unit(s) of "{{name}}"? This will update the quantity or permanently remove the item from your portfolio.',
            { quantity: confirmSingle.quantity, name: confirmSingle.itemName }
          )}
          confirmText={t('portfolio.confirmSellButton', 'Confirm Sell')}
          cancelText={t('common.cancel', 'Cancel')}
          variant="primary"
          onConfirm={() => executeSingleSell(confirmSingle.itemId, confirmSingle.quantity)}
        />
      )}

      {/* Confirm dialog for bulk sell */}
      {confirmBulk && (
        <ConfirmDialog
          open={confirmBulk}
          onClose={() => setConfirmBulk(false)}
          title={t('portfolio.confirmSellAllTitle', 'Confirm Sale of All Selected Items')}
          description={t(
            'portfolio.confirmSellAllDesc',
            'Are you sure you want to sell all configured units for these {{count}} item(s)? The corresponding quantities will be deducted or permanently removed from your portfolio.',
            { count: itemsCount }
          )}
          confirmText={t('portfolio.confirmSellAllButton', 'Yes, Sell All')}
          cancelText={t('common.cancel', 'Cancel')}
          variant="danger"
          onConfirm={executeBulkSell}
        >
          {activeItems.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-500/10 bg-red-950/5 p-4 text-xs">
              <p className="mb-2.5 text-[10px] font-bold tracking-wider text-red-400/90 uppercase">
                {t('portfolio.sellSelectedConfirmListHeader', 'Items to be sold:')}
              </p>
              {(() => {
                const summaryMap = new Map<string, number>();
                activeItems.forEach((item) => {
                  const name = item.case.name;
                  const qty = getSellQuantity(item.id, item.quantity);
                  const currentQty = summaryMap.get(name) || 0;
                  summaryMap.set(name, currentQty + qty);
                });
                const summaryList = Array.from(summaryMap.entries()).map(([name, qty]) => ({
                  name,
                  qty,
                }));
                const visibleList = isBulkSellListExpanded ? summaryList : summaryList.slice(0, 5);
                const remainingCount = summaryList.length - 5;

                return (
                  <div className="space-y-2">
                    <ul
                      className={`space-y-2 text-stone-300 ${isBulkSellListExpanded ? 'max-h-[200px] scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent overflow-y-auto pr-1.5' : ''}`}
                    >
                      {visibleList.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between border-b border-stone-900 pb-1.5 last:border-b-0 last:pb-0"
                        >
                          <span className="truncate font-semibold text-stone-200">{item.name}</span>
                          <span className="ml-2 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[10.5px] font-extrabold text-red-400">
                            {item.qty}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {summaryList.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setIsBulkSellListExpanded(!isBulkSellListExpanded)}
                        className="mt-2.5 flex w-full items-center justify-between border-t border-stone-900 pt-2 text-left font-semibold text-stone-400 italic transition-colors hover:text-stone-200"
                      >
                        <span>
                          {isBulkSellListExpanded
                            ? t('portfolio.deleteSelectedConfirmListCollapse', 'Collapse list')
                            : t(
                                'portfolio.deleteSelectedConfirmListRemaining',
                                '... and {{count}} other items',
                                { count: remainingCount }
                              )}
                        </span>
                        <span className="rounded border border-red-500/10 bg-red-500/5 px-2 py-0.5 text-[10px] tracking-wider text-red-400/80 uppercase not-italic hover:bg-red-500/10">
                          {isBulkSellListExpanded ? t('common.collapse') : t('common.expand')}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
