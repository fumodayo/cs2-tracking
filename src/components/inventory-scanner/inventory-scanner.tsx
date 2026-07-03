'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';

import { useInventoryScanner } from './use-inventory-scanner';
import { usePatternInspect } from './hooks/use-pattern-inspect';

import { AddCaseSearch } from './add-case-search';
import { CookieGuideModal } from '@/components/shared/cookie-guide-modal';
import { ScanResultItem } from './types';
import { buildInventoryColumns } from './inventory-scanner-columns';
import { groupItemsForSummary, groupCommoditiesForMobile } from './hooks/use-scanner-data-merged';

import { AccountsSection } from './components/accounts-section';
import { AddAccountDialog } from '@/components/steam-accounts/components/add-account-dialog';
import { parseSteamCookies } from '@/utils/steam-cookies';
import { extractSteamKey } from './utils';
import { toast } from '@/stores';
import { CS2CapModal } from '@/components/auth/cs2cap-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SellSelectedDialog } from '../portfolio/sell-selected-dialog';
import type { PortfolioTableRow } from '../portfolio/portfolio-table-model';
import type { PortfolioReportRowDto, PriceChangeDto } from '@/types/report';
import type { PriceRange } from '@/domain/price';
import { toPortfolioItemType } from '@/utils/cs2-item-type';

import { ScannerToolbar } from './components/scanner-toolbar';
import { ScannerResults } from './components/scanner-results';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';
import { ItemHoverCard } from '../portfolio/item-hover-card';

export function InventoryScanner() {
  const { t } = useTranslation();
  const [showGuestKeyModal, setShowGuestKeyModal] = useState(false);
  const [selectedItemForPanel, setSelectedItemForPanel] = useState<ScanResultItem | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const {
    state,
    isLoaded,
    rateAll,
    setRateAll,
    rateLe,
    setRateLe,
    buffCnyToVndRate,
    setBuffCnyToVndRate,
    mode,
    setMode,
    user,
    googleConfigured,
    updateAccountUrl,
    updateAccountCookie,
    updateAccountSessionId,
    removeAccount,
    addAccount,
    doScan,
    scanAll,
    cancelScanAll,
    addManualItem,
    updateManualItemQty,
    updateManualItem,
    removeItem,
    updateBuffPriceCny,
    fetchBuffPrice,
    importInventoryToPortfolio,
    setExpandedAccId,
    toggleTypeFilter,
    clearTypeFilters,
    setGlobalFilter,
    merged,
    mergedRaw,
    totalSi,
    totalLe,
    filteredManualItems,
    isAnyScanPending,
    hasValidUrls,
    zeroPricedItems,
    refreshPrices,
    isRefreshingPrices,
    urlState,
    setters,
    debouncedUrlState,
  } = useInventoryScanner();

  const activeMode = isMobile ? 'transactions' : mode;

  const { inspectingKeys, patternResults, inspectPattern } = usePatternInspect();

  // Trigger automatic portfolio import after Gmail login redirect
  useEffect(() => {
    if (
      isLoaded &&
      user &&
      typeof window !== 'undefined' &&
      localStorage.getItem('pending_portfolio_sync') === 'true'
    ) {
      if (mergedRaw && mergedRaw.items.length > 0) {
        localStorage.removeItem('pending_portfolio_sync');
        localStorage.setItem('pending_portfolio_sync_redirect', 'true');
        importInventoryToPortfolio();
      } else {
        localStorage.removeItem('pending_portfolio_sync');
        window.location.href = '/portfolio';
      }
    }
  }, [isLoaded, user, mergedRaw, importInventoryToPortfolio]);

  // Monitor auto-import result and redirect on success
  useEffect(() => {
    if (
      state.portfolioImportMessage &&
      typeof window !== 'undefined' &&
      localStorage.getItem('pending_portfolio_sync_redirect') === 'true'
    ) {
      localStorage.removeItem('pending_portfolio_sync_redirect');
      window.location.href = '/portfolio';
    }
  }, [state.portfolioImportMessage]);

  // Clear pending redirect flag on import error
  useEffect(() => {
    if (
      state.portfolioImportError &&
      typeof window !== 'undefined' &&
      localStorage.getItem('pending_portfolio_sync_redirect') === 'true'
    ) {
      localStorage.removeItem('pending_portfolio_sync_redirect');
    }
  }, [state.portfolioImportError]);

  // Listen for global cookie guide event from the add account dialog
  useEffect(() => {
    const handleShowGuide = () => setShowCookieGuide(true);
    window.addEventListener('show-cookie-guide', handleShowGuide);
    return () => window.removeEventListener('show-cookie-guide', handleShowGuide);
  }, []);

  const hasScannedAccount = useMemo(() => state.accounts.some((a) => a.result), [state.accounts]);

  const selectedAccounts = urlState.accounts;
  const setSelectedAccounts = setters.accounts;

  const selectedStatuses = urlState.status;
  const setSelectedStatuses = setters.status;

  const selectedSourceFilters = useMemo(() => urlState.source ?? [], [urlState.source]);
  const setSelectedSourceFilters = setters.source;

  const selectedPriceSourceFilters = useMemo(
    () => urlState.priceSource ?? [],
    [urlState.priceSource]
  );
  const setSelectedPriceSourceFilters = setters.priceSource;

  const pagination = useMemo(
    () => ({
      pageIndex: urlState.page - 1,
      pageSize: urlState.pageSize,
    }),
    [urlState.page, urlState.pageSize]
  );

  const setPagination = useCallback(
    (
      value:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          })
    ) => {
      if (typeof value === 'function') {
        const next = value({
          pageIndex: urlState.page - 1,
          pageSize: urlState.pageSize,
        });
        setters.page(next.pageIndex + 1);
        setters.pageSize(next.pageSize);
      } else {
        setters.page(value.pageIndex + 1);
        setters.pageSize(value.pageSize);
      }
    },
    [urlState.page, urlState.pageSize, setters]
  );

  // Reset pagination to first page when search filters change
  useEffect(() => {
    if (urlState.page !== 1) {
      setters.page(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    urlState.q,
    urlState.type,
    urlState.status,
    urlState.accounts,
    urlState.source,
    urlState.priceSource,
    setters,
  ]);
  const [showCookieGuide, setShowCookieGuide] = useState<boolean>(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);

  const accountOptions = useMemo(
    () =>
      state.accounts
        .filter((account) => account.result)
        .map((account) => ({
          steamId64: account.result!.steamId64,
          name: account.result!.profile?.name || account.result!.steamId64,
        }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [state.accounts]
  );

  const matchesSourceFilter = useCallback(
    (item: ScanResultItem) => {
      if (selectedSourceFilters.length === 0) return true;

      return selectedSourceFilters.some((source) => {
        if (source === 'manual') return !!item.isManual;
        if (source === 'existing') return !item.isManual;
        return false;
      });
    },
    [selectedSourceFilters]
  );

  const matchesPriceSourceFilter = useCallback(
    (item: ScanResultItem) => {
      if (selectedPriceSourceFilters.length === 0) return true;

      const priceSource = item.priceSource === 'buff163' ? 'buff' : 'steam';
      return selectedPriceSourceFilters.includes(priceSource);
    },
    [selectedPriceSourceFilters]
  );

  const filteredScannedItems = useMemo(
    () =>
      (merged?.scannedItems ?? []).filter((item) => {
        if (!matchesSourceFilter(item)) return false;
        if (!matchesPriceSourceFilter(item)) return false;

        // Account filter
        if (selectedAccounts.length > 0) {
          const matchesAccount =
            item.sourceAccounts?.some((account) => selectedAccounts.includes(account.steamId64)) ??
            false;
          if (!matchesAccount) return false;
        }
        // Hold status filter
        if (selectedStatuses.length > 0) {
          const statuses = new Set<string>();
          if (item.sourceAccounts) {
            for (const acc of item.sourceAccounts) {
              if (acc.breakdown) {
                if (acc.breakdown.tradeable > 0) statuses.add('tradeable');
                if (acc.breakdown.onMarket > 0) statuses.add('market');
                if (acc.breakdown.tradeProtected > 0) statuses.add('protected');
                if (acc.breakdown.hold > 0) statuses.add('hold');
              }
            }
          }
          // If no breakdown data, treat as tradeable
          if (statuses.size === 0) statuses.add('tradeable');
          const matchesStatus = selectedStatuses.some((s) => statuses.has(s));
          if (!matchesStatus) return false;
        }
        return true;
      }),
    [
      selectedAccounts,
      selectedStatuses,
      merged?.scannedItems,
      matchesSourceFilter,
      matchesPriceSourceFilter,
    ]
  );

  const visibleManualItems = useMemo(() => {
    if (selectedAccounts.length > 0) return [];

    return filteredManualItems.filter(
      (item) => matchesSourceFilter(item) && matchesPriceSourceFilter(item)
    );
  }, [selectedAccounts, filteredManualItems, matchesSourceFilter, matchesPriceSourceFilter]);

  const sellDialogSourceItems = useMemo(
    () => [...visibleManualItems, ...filteredScannedItems],
    [visibleManualItems, filteredScannedItems]
  );

  const tableData = useMemo(() => {
    const rawData = sellDialogSourceItems;
    if (isMobile) {
      return groupCommoditiesForMobile(rawData);
    }
    if (activeMode === 'case-summary') {
      return groupItemsForSummary(rawData);
    }
    return rawData;
  }, [sellDialogSourceItems, activeMode, isMobile]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    console.log('DEBUG SCANNER - mode:', mode, 'rowSelection:', rowSelection);
  }, [mode, rowSelection]);

  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleteListExpanded, setIsDeleteListExpanded] = useState(false);

  const handleModeChange = useCallback(
    (newMode: 'case-summary' | 'transactions') => {
      if (newMode === mode) return;

      const rawData = [...visibleManualItems, ...filteredScannedItems];
      const currentRows = mode === 'case-summary' ? groupItemsForSummary(rawData) : rawData;
      const nextRows = newMode === 'case-summary' ? groupItemsForSummary(rawData) : rawData;

      setRowSelection((selection) => {
        const selectedUnderlyingIds = new Set<string>();
        const currentRowsMap = new Map(
          currentRows.map((row) => [
            row.isManual && row.id ? row.id : row.identityKey || row.caseItem.marketHashName,
            row,
          ])
        );

        for (const [rowId, isSelected] of Object.entries(selection)) {
          if (!isSelected) continue;
          const row = currentRowsMap.get(rowId);
          if (row) {
            const ids = row.underlyingIds || [rowId];
            ids.forEach((id) => selectedUnderlyingIds.add(id));
          } else {
            selectedUnderlyingIds.add(rowId);
          }
        }

        const nextSelection: Record<string, boolean> = {};
        for (const row of nextRows) {
          const rowId =
            row.isManual && row.id ? row.id : row.identityKey || row.caseItem.marketHashName;
          const ids = row.underlyingIds || [rowId];
          if (ids.some((id) => selectedUnderlyingIds.has(id))) {
            nextSelection[rowId] = true;
          }
        }
        return nextSelection;
      });

      setMode(newMode);
    },
    [mode, visibleManualItems, filteredScannedItems, setMode, setRowSelection]
  );

  useEffect(() => {
    if (!deleteConfirmOpen) {
      setIsDeleteListExpanded(false);
    }
  }, [deleteConfirmOpen]);

  const mapScannerItemToPortfolioRow = useCallback(
    (item: ScanResultItem): PortfolioTableRow => {
      const id =
        item.isManual && item.id ? item.id : item.identityKey || item.caseItem.marketHashName;
      const itemIds =
        item.underlyingIds && item.underlyingIds.length > 0 ? item.underlyingIds : [id];
      const marketHashName = item.caseItem.marketHashName;

      const rawItem = mergedRaw?.items.find((i) => i.caseItem.marketHashName === marketHashName);
      const steamPrice = rawItem?.price ?? item.price;
      const currentPrice = item.price;

      return {
        id,
        mode: 'case-summary',
        case: {
          id: item.caseItem.id,
          name: item.caseItem.name,
          marketHashName: item.caseItem.marketHashName,
          imageUrl: item.caseItem.imageUrl ?? undefined,
          isActive: true,
          rarity: item.rarity,
        },
        itemIds,
        quantity: item.quantity,
        lotCount: 1,
        buyPrice: item.buyPrice ?? 0,
        buyDate: item.buyDate ?? null,
        createdAt: null,
        note: item.note ?? (item.isManual ? t('common.manual') : undefined),
        sourceType: item.isManual ? 'manual' : 'existing',
        itemType: toPortfolioItemType(item.type),
        sourceAccounts: (item.sourceAccounts ?? []).map((sa) => ({
          steamId64: sa.steamId64,
          name: sa.name,
          breakdown: sa.breakdown,
        })),
        currentPrice,
        steamPrice,
        currentPriceCapturedAt: null,
        investedValue: (item.buyPrice ?? 0) * item.quantity,
        currentValue: currentPrice * item.quantity,
        profitAmount: 0,
        profitPercent: 0,
        marketChanges: {} as Record<PriceRange, PriceChangeDto>,
        tradeHoldUntil: null,
        isTemporaryPrice: false,
        storageUnitQuantity: 0,
        patternInfo: item.patternInfo,
        dopplerPhase: item.dopplerPhase,
        inspectLink: item.inspectLink,
      };
    },
    [mergedRaw, t]
  );

  const currentSelectedItemForPanel = useMemo(() => {
    if (!selectedItemForPanel) return null;
    const targetId =
      selectedItemForPanel.isManual && selectedItemForPanel.id
        ? selectedItemForPanel.id
        : selectedItemForPanel.identityKey || selectedItemForPanel.caseItem.marketHashName;

    return (
      tableData.find((item) => {
        const id =
          item.isManual && item.id ? item.id : item.identityKey || item.caseItem.marketHashName;
        return id === targetId;
      }) ?? selectedItemForPanel
    );
  }, [selectedItemForPanel, tableData]);

  const selectedPortfolioRowForPanel = useMemo(() => {
    return currentSelectedItemForPanel
      ? mapScannerItemToPortfolioRow(currentSelectedItemForPanel)
      : null;
  }, [currentSelectedItemForPanel, mapScannerItemToPortfolioRow]);

  const relatedPortfolioRowsForPanel = useMemo(() => {
    if (!selectedItemForPanel || !currentSelectedItemForPanel) return [];
    if (mode === 'transactions') {
      return selectedPortfolioRowForPanel ? [selectedPortfolioRowForPanel] : [];
    }

    const rawData = [...visibleManualItems, ...filteredScannedItems];
    const targetMarketHashName = currentSelectedItemForPanel.caseItem.marketHashName;
    const targetDoppler = currentSelectedItemForPanel.dopplerPhase ?? 'normal';

    return rawData
      .filter((item) => {
        const itemDoppler = item.dopplerPhase ?? 'normal';
        return (
          item.caseItem.marketHashName === targetMarketHashName && itemDoppler === targetDoppler
        );
      })
      .map(mapScannerItemToPortfolioRow);
  }, [
    selectedItemForPanel,
    currentSelectedItemForPanel,
    selectedPortfolioRowForPanel,
    mode,
    visibleManualItems,
    filteredScannedItems,
    mapScannerItemToPortfolioRow,
  ]);

  const selectedRows = useMemo(() => {
    return tableData.filter((item) => {
      const id =
        item.isManual && item.id ? item.id : item.identityKey || item.caseItem.marketHashName;
      return rowSelection[id];
    });
  }, [tableData, rowSelection]);

  const selectedPortfolioRows = useMemo(() => {
    return selectedRows.map(mapScannerItemToPortfolioRow);
  }, [selectedRows, mapScannerItemToPortfolioRow]);

  const allPortfolioRows = useMemo(() => {
    return tableData.map(mapScannerItemToPortfolioRow);
  }, [tableData, mapScannerItemToPortfolioRow]);

  const sellDialogOriginalRows = useMemo(() => {
    return sellDialogSourceItems.map((item) => {
      const id =
        item.isManual && item.id ? item.id : item.identityKey || item.caseItem.marketHashName;
      return {
        item: {
          id,
          quantity: item.quantity,
          buyPrice: item.buyPrice ?? 0,
          buyDate: item.buyDate ?? null,
          createdAt: null,
          note: item.isManual ? t('common.manual') : t('inventoryScanner.scanned'),
          sourceAccounts: item.sourceAccounts,
          storageUnitId: item.storageUnitId,
          storageUnitQuantity: item.storageUnitId ? item.quantity : 0,
        },
        case: {
          id: item.caseItem.id,
          name: item.caseItem.name,
          marketHashName: item.caseItem.marketHashName,
          imageUrl: item.caseItem.imageUrl,
        },
        currentPrice: item.price,
        currentValue: item.total,
        investedValue: (item.buyPrice ?? 0) * item.quantity,
        profitAmount: 0,
        profitPercent: 0,
        marketChanges: {} as Record<PriceRange, PriceChangeDto>,
      };
    }) as unknown as PortfolioReportRowDto[];
  }, [sellDialogSourceItems, t]);

  const handleSellDelete = useCallback(
    (id: string) => {
      if (id.startsWith('manual-')) {
        removeItem('', true, id);
      } else {
        removeItem('', false, id);
      }
    },
    [removeItem]
  );

  const handleSellUpdateQuantity = useCallback(
    (id: string, newQty: number) => {
      if (id.startsWith('manual-')) {
        updateManualItemQty(id, newQty);
      } else {
        const scannedItem = sellDialogSourceItems.find(
          (item) => !item.isManual && (item.identityKey || item.caseItem.marketHashName) === id
        );
        if (scannedItem) {
          removeItem('', false, id);
          addManualItem(
            scannedItem.caseItem,
            scannedItem.price,
            newQty,
            scannedItem.buyPrice,
            scannedItem.buyDate,
            scannedItem.sourceAccounts,
            scannedItem.storageUnitId,
            scannedItem.buffPriceManual,
            scannedItem.buffRateManual,
            scannedItem.storageUnitName
          );
        }
      }
    },
    [removeItem, updateManualItemQty, addManualItem, sellDialogSourceItems]
  );

  const handleUpdateLot = useCallback(
    async (
      id: string,
      payload: {
        quantity?: number;
        buyPrice?: number;
        note?: string;
        sourceAccounts?: Array<{ steamId64: string; name: string }>;
        storageUnitId?: string;
        stickerPriceRate?: number;
        stickerBuyPriceRate?: number;
        dopplerPhase?: string;
        patternInfo?: any;
        inspectLink?: string;
      }
    ) => {
      if (id.startsWith('manual-')) {
        updateManualItem(id, {
          quantity: payload.quantity,
          buyPrice: payload.buyPrice,
          note: payload.note,
          sourceAccounts: payload.sourceAccounts,
          storageUnitId: payload.storageUnitId,
          stickerPriceRate: payload.stickerPriceRate,
          stickerBuyPriceRate: payload.stickerBuyPriceRate,
          dopplerPhase: payload.dopplerPhase,
          patternInfo: payload.patternInfo,
          inspectLink: payload.inspectLink,
        });
      } else {
        const scannedItem = tableData.find(
          (item) => !item.isManual && (item.identityKey || item.caseItem.marketHashName) === id
        );
        if (scannedItem) {
          removeItem('', false, id);
          addManualItem(
            scannedItem.caseItem,
            scannedItem.price,
            payload.quantity ?? scannedItem.quantity,
            payload.buyPrice ?? scannedItem.buyPrice,
            scannedItem.buyDate,
            payload.sourceAccounts ?? scannedItem.sourceAccounts,
            payload.storageUnitId ?? scannedItem.storageUnitId,
            scannedItem.buffPriceManual,
            scannedItem.buffRateManual,
            scannedItem.storageUnitName,
            payload.stickerPriceRate ?? scannedItem.buffRateManual,
            payload.stickerBuyPriceRate ?? scannedItem.buffRateManual,
            id,
            payload.note ?? scannedItem.note
          );
        }
      }
    },
    [removeItem, addManualItem, updateManualItem, tableData]
  );

  const handleUpdateQuantity = useCallback(
    (id: string, newQty: number) => {
      if (id.startsWith('manual-')) {
        updateManualItemQty(id, newQty);
      } else {
        const scannedItem = tableData.find(
          (item) => !item.isManual && (item.identityKey || item.caseItem.marketHashName) === id
        );
        if (scannedItem) {
          removeItem('', false, id);
          addManualItem(
            scannedItem.caseItem,
            scannedItem.price,
            newQty,
            scannedItem.buyPrice,
            scannedItem.buyDate,
            scannedItem.sourceAccounts,
            scannedItem.storageUnitId,
            scannedItem.buffPriceManual,
            scannedItem.buffRateManual,
            scannedItem.storageUnitName,
            scannedItem.stickerPriceRate,
            scannedItem.stickerBuyPriceRate,
            id,
            scannedItem.note
          );
        }
      }
    },
    [removeItem, updateManualItemQty, addManualItem, tableData]
  );

  const handleUpdateBuyPrice = useCallback(
    (id: string, newBuyPrice: number) => {
      if (id.startsWith('manual-')) {
        updateManualItem(id, { buyPrice: newBuyPrice });
      } else {
        const scannedItem = tableData.find(
          (item) => !item.isManual && (item.identityKey || item.caseItem.marketHashName) === id
        );
        if (scannedItem) {
          removeItem('', false, id);
          addManualItem(
            scannedItem.caseItem,
            scannedItem.price,
            scannedItem.quantity,
            newBuyPrice,
            scannedItem.buyDate,
            scannedItem.sourceAccounts,
            scannedItem.storageUnitId,
            scannedItem.buffPriceManual,
            scannedItem.buffRateManual,
            scannedItem.storageUnitName,
            scannedItem.stickerPriceRate,
            scannedItem.stickerBuyPriceRate,
            id,
            scannedItem.note
          );
        }
      }
    },
    [removeItem, updateManualItem, addManualItem, tableData]
  );

  const handleUpdateNote = useCallback(
    (id: string, newNote: string) => {
      if (id.startsWith('manual-')) {
        updateManualItem(id, { note: newNote });
      } else {
        const scannedItem = tableData.find(
          (item) => !item.isManual && (item.identityKey || item.caseItem.marketHashName) === id
        );
        if (scannedItem) {
          removeItem('', false, id);
          addManualItem(
            scannedItem.caseItem,
            scannedItem.price,
            scannedItem.quantity,
            scannedItem.buyPrice,
            scannedItem.buyDate,
            scannedItem.sourceAccounts,
            scannedItem.storageUnitId,
            scannedItem.buffPriceManual,
            scannedItem.buffRateManual,
            scannedItem.storageUnitName,
            scannedItem.stickerPriceRate,
            scannedItem.stickerBuyPriceRate,
            id,
            newNote
          );
        }
      }
    },
    [removeItem, updateManualItem, addManualItem, tableData]
  );

  const handleDelete = useCallback(
    (id: string) => {
      handleSellDelete(id);
      if (relatedPortfolioRowsForPanel.length <= 1 || mode === 'transactions') {
        setSelectedItemForPanel(null);
      }
    },
    [handleSellDelete, relatedPortfolioRowsForPanel.length, mode]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedRows.length === 0) return;
    setDeleteConfirmOpen(true);
  }, [selectedRows]);

  const executeDeleteSelected = useCallback(() => {
    for (const item of selectedRows) {
      if (item.underlyingIds && item.underlyingIds.length > 0) {
        for (const uid of item.underlyingIds) {
          removeItem('', item.isManual, uid);
        }
      } else {
        const itemId = item.id || item.identityKey;
        if (itemId) {
          removeItem('', item.isManual, itemId);
        } else {
          removeItem(item.caseItem.marketHashName, item.isManual);
        }
      }
    }
    setRowSelection({});
    setDeleteConfirmOpen(false);
    setSelectedItemForPanel(null);
  }, [selectedRows, removeItem]);

  const handleSellAll = useCallback(() => {
    if (!currentSelectedItemForPanel) return;
    const targetMarketHashName = currentSelectedItemForPanel.caseItem.marketHashName;
    const targetDoppler = currentSelectedItemForPanel.dopplerPhase ?? 'normal';

    const newSelection: Record<string, boolean> = {};
    tableData.forEach((row) => {
      const itemDoppler = row.dopplerPhase ?? 'normal';
      if (row.caseItem.marketHashName === targetMarketHashName && itemDoppler === targetDoppler) {
        const id = row.isManual && row.id ? row.id : row.identityKey || row.caseItem.marketHashName;
        newSelection[id] = true;
      }
    });

    setRowSelection(newSelection);
    setSellDialogOpen(true);
    setSelectedItemForPanel(null);
  }, [currentSelectedItemForPanel, tableData, setSelectedItemForPanel]);

  const handleSellItem = useCallback(
    (id: string) => {
      setRowSelection((prev) => ({
        ...prev,
        [id]: true,
      }));
      setSellDialogOpen(true);
      setSelectedItemForPanel(null);
    },
    [setRowSelection, setSellDialogOpen, setSelectedItemForPanel]
  );

  const handleDeleteAll = useCallback(() => {
    if (!currentSelectedItemForPanel) return;
    const targetMarketHashName = currentSelectedItemForPanel.caseItem.marketHashName;
    const targetDoppler = currentSelectedItemForPanel.dopplerPhase ?? 'normal';

    const newSelection: Record<string, boolean> = {};
    tableData.forEach((row) => {
      const itemDoppler = row.dopplerPhase ?? 'normal';
      if (row.caseItem.marketHashName === targetMarketHashName && itemDoppler === targetDoppler) {
        const id = row.isManual && row.id ? row.id : row.identityKey || row.caseItem.marketHashName;
        newSelection[id] = true;
      }
    });

    setRowSelection(newSelection);
    setDeleteConfirmOpen(true);
  }, [currentSelectedItemForPanel, tableData]);

  const totalWalletVnd = useMemo(() => {
    return state.accounts.reduce((sum, acc) => {
      if (acc.result?.walletBalanceVnd) {
        return sum + acc.result.walletBalanceVnd;
      }
      return sum;
    }, 0);
  }, [state.accounts]);

  /**
   * Defines TanStack Table columns, linking custom cells with action callbacks
   * and complex multi-source Buff & Steam pricing models.
   */
  const columns = useMemo<ColumnDef<ScanResultItem>[]>(
    () =>
      buildInventoryColumns({
        t,
        buffLoadingKeys: state.buffLoadingKeys,
        buffPricesCny: state.buffPricesCny,
        buffPriceErrors: state.buffPriceErrors,
        fetchBuffPrice,
        updateBuffPriceCny,
        buffCnyToVndRate,
        rateAll,
        rateLe,
        updateManualItemQty,
        mergedRawItems: mergedRaw?.items,
        inspectingKeys,
        patternResults,
        inspectPattern,
        mode: activeMode,
        onSelectItem: setSelectedItemForPanel,
        isMobile,
      }),
    [
      t,
      buffCnyToVndRate,
      state.buffLoadingKeys,
      state.buffPriceErrors,
      state.buffPricesCny,
      fetchBuffPrice,
      updateBuffPriceCny,
      rateAll,
      rateLe,
      updateManualItemQty,
      mergedRaw,
      inspectingKeys,
      patternResults,
      inspectPattern,
      activeMode,
      setSelectedItemForPanel,
      isMobile,
    ]
  );

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    rateAll: false,
    rateLe: false,
  });
  const [isColumnVisibilityLoaded, setIsColumnVisibilityLoaded] = useState(false);

  // Load column visibility from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cs2t_scanner_columnVisibility');
      if (saved) {
        setColumnVisibility(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load scanner column visibility', e);
    }
    setIsColumnVisibilityLoaded(true);
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (isColumnVisibilityLoaded) {
      localStorage.setItem('cs2t_scanner_columnVisibility', JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, isColumnVisibilityLoaded]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      globalFilter: debouncedUrlState.q,
      columnVisibility,
      pagination,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) =>
      row.isManual && row.id ? row.id : row.identityKey || row.caseItem.marketHashName,
    enableRowSelection: true,
    initialState: {
      sorting: [{ id: 'total', desc: true }],
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;
      return [
        row.original.caseItem.name,
        row.original.caseItem.marketHashName,
        row.original.type,
        ...(row.original.sourceAccounts ?? []).map((account) => account.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <main className="min-h-screen">
      <ScannerToolbar user={user} onShowGuestKeyModal={() => setShowGuestKeyModal(true)} />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AccountsSection
          isLoaded={isLoaded}
          accounts={state.accounts}
          scanningAll={state.scanningAll}
          isAnyScanPending={isAnyScanPending}
          hasValidUrls={hasValidUrls}
          expandedAccId={state.expandedAccId}
          setExpandedAccId={setExpandedAccId}
          cancelScanAll={cancelScanAll}
          scanAll={scanAll}
          doScan={doScan}
          removeAccount={removeAccount}
          updateAccountUrl={updateAccountUrl}
          updateAccountCookie={updateAccountCookie}
          updateAccountSessionId={updateAccountSessionId}
          addAccount={() => setShowAddAccountModal(true)}
          setShowCookieGuide={setShowCookieGuide}
        />

        <ScannerResults
          mode={activeMode}
          setMode={handleModeChange}
          isMobile={isMobile}
          onSelectItem={setSelectedItemForPanel}
          merged={merged}
          state={state}
          isAnyScanPending={isAnyScanPending}
          addManualItem={addManualItem}
          buffCnyToVndRate={buffCnyToVndRate}
          setBuffCnyToVndRate={setBuffCnyToVndRate}
          rateAll={rateAll}
          setRateAll={setRateAll}
          rateLe={rateLe}
          setRateLe={setRateLe}
          totalSi={totalSi}
          totalLe={totalLe}
          totalWalletVnd={totalWalletVnd}
          table={table}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          selectedAccounts={selectedAccounts}
          setSelectedAccounts={setSelectedAccounts}
          selectedSourceFilters={selectedSourceFilters}
          setSelectedSourceFilters={setSelectedSourceFilters}
          selectedPriceSourceFilters={selectedPriceSourceFilters}
          setSelectedPriceSourceFilters={setSelectedPriceSourceFilters}
          accountOptions={accountOptions}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          setSellDialogOpen={setSellDialogOpen}
          handleDeleteSelected={handleDeleteSelected}
          refreshPrices={refreshPrices}
          isRefreshingPrices={isRefreshingPrices}
          setGlobalFilter={setGlobalFilter}
          clearTypeFilters={clearTypeFilters}
          toggleTypeFilter={toggleTypeFilter}
          user={user}
          googleConfigured={googleConfigured}
          importInventoryToPortfolio={importInventoryToPortfolio}
          zeroPricedItems={zeroPricedItems}
        />
      </section>

      {!merged && hasScannedAccount && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <AddCaseSearch onAdd={addManualItem} />
          </div>
        </section>
      )}

      <CookieGuideModal open={showCookieGuide} onClose={() => setShowCookieGuide(false)} />

      <AddAccountDialog
        open={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSubmit={(payload) => {
          const parsed = parseSteamCookies(payload.steamCookie);
          const newUrlKey = extractSteamKey(payload.steamUrl);

          const duplicateAccount = state.accounts.find((a) => {
            const existingKey = extractSteamKey(a.url);
            return existingKey && newUrlKey && existingKey === newUrlKey;
          });

          if (duplicateAccount) {
            const dupeName = duplicateAccount.result?.profile?.name || duplicateAccount.url;
            toast.error(
              t('inventoryScanner.apiErrors.duplicateUrlError', {
                name: dupeName,
                defaultValue: `URL matches "${dupeName}". Please enter a different account.`,
              })
            );
            return;
          }

          addAccount({
            url: payload.steamUrl,
            steamCookie: payload.steamCookie,
            steamSessionId: parsed.sessionid || '',
          });
          setShowAddAccountModal(false);
        }}
        isPending={false}
      />

      <CS2CapModal open={showGuestKeyModal} onOpenChange={setShowGuestKeyModal} mode="guest" />

      {sellDialogOpen && (
        <SellSelectedDialog
          open={sellDialogOpen}
          onClose={() => setSellDialogOpen(false)}
          selectedItems={selectedPortfolioRows}
          allItems={allPortfolioRows}
          originalRows={sellDialogOriginalRows}
          onDelete={handleSellDelete}
          onUpdateQuantity={handleSellUpdateQuantity}
          onClearSelection={() => setRowSelection({})}
          wholesaleRate={rateAll}
          retailRate={rateLe}
          buffPricesCny={state.buffPricesCny}
          buffCnyToVndRate={buffCnyToVndRate}
          onDeselectItem={(id) => setRowSelection((prev) => ({ ...prev, [id]: false }))}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={t('inventoryScanner.confirmDeleteTitle')}
        description={t('inventoryScanner.confirmDeleteDesc', { count: selectedRows.length })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={executeDeleteSelected}
        variant="danger"
      >
        {selectedRows.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-500/10 bg-red-950/5 p-4 text-xs">
            <p className="mb-2.5 text-[10px] font-bold tracking-wider text-red-400/90 uppercase">
              {t('portfolio.deleteSelectedConfirmListHeader', 'Items to be deleted:')}
            </p>
            {(() => {
              const summaryMap = new Map<string, number>();
              selectedRows.forEach((row) => {
                const name = row.caseItem.name;
                const currentQty = summaryMap.get(name) || 0;
                summaryMap.set(name, currentQty + row.quantity);
              });
              const summaryList = Array.from(summaryMap.entries()).map(([name, qty]) => ({
                name,
                qty,
              }));
              const visibleList = isDeleteListExpanded ? summaryList : summaryList.slice(0, 5);
              const remainingCount = summaryList.length - 5;

              return (
                <div className="space-y-2">
                  <ul
                    className={`space-y-2 text-stone-300 ${isDeleteListExpanded ? 'max-h-[200px] scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent overflow-y-auto pr-1.5' : ''}`}
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
                      onClick={() => setIsDeleteListExpanded(!isDeleteListExpanded)}
                      className="mt-2.5 flex w-full items-center justify-between border-t border-stone-900 pt-2 text-left font-semibold text-stone-400 italic transition-colors hover:text-stone-200"
                    >
                      <span>
                        {isDeleteListExpanded
                          ? t('portfolio.deleteSelectedConfirmListCollapse', 'Collapse list')
                          : t(
                              'portfolio.deleteSelectedConfirmListRemaining',
                              '... and {{count}} other items',
                              { count: remainingCount }
                            )}
                      </span>
                      <span className="rounded border border-red-500/10 bg-red-500/5 px-2 py-0.5 text-[10px] tracking-wider text-red-400/80 uppercase not-italic hover:bg-red-500/10">
                        {isDeleteListExpanded ? t('common.collapse') : t('common.expand')}
                      </span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </ConfirmDialog>

      <SlidePanel
        open={!!selectedItemForPanel}
        onOpenChange={(open) => !open && setSelectedItemForPanel(null)}
      >
        {selectedItemForPanel && selectedPortfolioRowForPanel && (
          <SlidePanelContent
            title={selectedPortfolioRowForPanel.case.name}
            hideHeader
            noPadding
            className="border-stone-850/80 border-border max-w-[440px] overflow-hidden border-l bg-[#0e121a] text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
          >
            <ItemHoverCard
              item={selectedPortfolioRowForPanel}
              relatedRows={relatedPortfolioRowsForPanel}
              buffCnyToVndRate={buffCnyToVndRate}
              buffPricesCny={state.buffPricesCny}
              embedded
              useSellLabel
              isGuest={!user}
              onUpdateLot={handleUpdateLot}
              onUpdateQuantity={handleUpdateQuantity}
              onUpdateBuyPrice={handleUpdateBuyPrice}
              onUpdateNote={handleUpdateNote}
              onDelete={handleDelete}
              onSellItem={handleSellItem}
              onSellAll={handleSellAll}
              onDeleteAll={handleDeleteAll}
            />
          </SlidePanelContent>
        )}
      </SlidePanel>
    </main>
  );
}
