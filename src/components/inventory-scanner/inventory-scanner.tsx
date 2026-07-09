'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useInventoryScanner } from './use-inventory-scanner';

import { AddCaseSearch } from './add-case-search';
import { CookieGuideModal } from '@/components/shared/cookie-guide-modal';
import { ScanResultItem } from './types';
import { groupItemsForSummary } from './hooks/use-scanner-data-merged';

import { AccountsSection } from './components/accounts-section';
import { AddAccountDialog } from '@/components/steam-accounts/components/add-account-dialog';
import { parseSteamCookies } from '@/utils/steam-cookies';
import { extractSteamKey } from './utils';
import {
  findScannerRowByRowId,
  getScannerGroupRows,
  getScannerGroupSelection,
  getSelectedScannerRows,
  remapScannerRowSelection,
} from './scanner-selection';
import { useScannerAccountOptions, useScannerDisplayData } from './use-scanner-display-data';
import { useScannerUrlTableState } from './use-scanner-url-table-state';
import { useScannerPortfolioItemActions } from './use-scanner-portfolio-item-actions';
import { useScannerResultsTable } from './use-scanner-results-table';
import { toast } from '@/stores';
import { CS2CapModal } from '@/components/auth/cs2cap-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SellSelectedDialog } from '../portfolio/sell-selected-dialog';
import type { PortfolioTableRow } from '../portfolio/portfolio-table-model';
import {
  createPortfolioReportRowFromScannerItem,
  createPortfolioRowFromScannerItem,
} from './scanner-portfolio-mappers';

import { ScannerToolbar } from './components/scanner-toolbar';
import { ScannerResults } from './components/scanner-results';
import { DeleteSelectedSummary } from './components/delete-selected-summary';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';
import { ItemHoverCard } from '../portfolio/item-hover-card';
import { useIsMobile } from '@/hooks/use-is-mobile';

export function InventoryScanner() {
  const { t } = useTranslation();
  const [showGuestKeyModal, setShowGuestKeyModal] = useState(false);
  const [selectedItemForPanel, setSelectedItemForPanel] = useState<ScanResultItem | null>(null);
  const [showCookieGuide, setShowCookieGuide] = useState<boolean>(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);

  const isMobile = useIsMobile();

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

  // Kích hoạt import portfolio tự động sau redirect đăng nhập Gmail
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

  // Theo dõi kết quả auto-import và redirect khi thành công
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

  // Xóa cờ redirect đang chờ khi import lỗi
  useEffect(() => {
    if (
      state.portfolioImportError &&
      typeof window !== 'undefined' &&
      localStorage.getItem('pending_portfolio_sync_redirect') === 'true'
    ) {
      localStorage.removeItem('pending_portfolio_sync_redirect');
    }
  }, [state.portfolioImportError]);

  // Lắng nghe sự kiện cookie guide toàn cục từ dialog thêm tài khoản
  useEffect(() => {
    const handleShowGuide = () => setShowCookieGuide(true);
    window.addEventListener('show-cookie-guide', handleShowGuide);
    return () => window.removeEventListener('show-cookie-guide', handleShowGuide);
  }, []);

  const hasScannedAccount = useMemo(() => state.accounts.some((a) => a.result), [state.accounts]);

  const {
    selectedAccounts,
    setSelectedAccounts,
    selectedStatuses,
    setSelectedStatuses,
    selectedSourceFilters,
    setSelectedSourceFilters,
    selectedPriceSourceFilters,
    setSelectedPriceSourceFilters,
    pagination,
    setPagination,
  } = useScannerUrlTableState({ urlState, setters });
  const accountOptions = useScannerAccountOptions(state.accounts);
  const { filteredScannedItems, visibleManualItems, sellDialogSourceItems, tableData } =
    useScannerDisplayData({
      scannedItems: merged?.scannedItems,
      filteredManualItems,
      selectedAccounts,
      selectedStatuses,
      selectedSourceFilters,
      selectedPriceSourceFilters,
      activeMode,
      isMobile,
    });

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleteListExpanded, setIsDeleteListExpanded] = useState(false);

  const handleModeChange = useCallback(
    (newMode: 'case-summary' | 'transactions') => {
      if (newMode === mode) return;

      const rawData = [...visibleManualItems, ...filteredScannedItems];
      const currentRows = mode === 'case-summary' ? groupItemsForSummary(rawData) : rawData;
      const nextRows = newMode === 'case-summary' ? groupItemsForSummary(rawData) : rawData;

      setRowSelection((selection) => remapScannerRowSelection(selection, currentRows, nextRows));

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
      return createPortfolioRowFromScannerItem({
        item,
        mergedRawItems: mergedRaw?.items,
        t,
      });
    },
    [mergedRaw, t]
  );

  const currentSelectedItemForPanel = useMemo(() => {
    if (!selectedItemForPanel) return null;
    return findScannerRowByRowId(tableData, selectedItemForPanel) ?? selectedItemForPanel;
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
    return getScannerGroupRows(rawData, currentSelectedItemForPanel).map(
      mapScannerItemToPortfolioRow
    );
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
    return getSelectedScannerRows(tableData, rowSelection);
  }, [tableData, rowSelection]);

  const selectedPortfolioRows = useMemo(() => {
    return selectedRows.map(mapScannerItemToPortfolioRow);
  }, [selectedRows, mapScannerItemToPortfolioRow]);

  const allPortfolioRows = useMemo(() => {
    return tableData.map(mapScannerItemToPortfolioRow);
  }, [tableData, mapScannerItemToPortfolioRow]);

  const sellDialogOriginalRows = useMemo(() => {
    return sellDialogSourceItems.map((item) => createPortfolioReportRowFromScannerItem(item, t));
  }, [sellDialogSourceItems, t]);

  const {
    handleDelete,
    handleSellDelete,
    handleSellUpdateQuantity,
    handleUpdateBuyPrice,
    handleUpdateLot,
    handleUpdateNote,
    handleUpdateQuantity,
  } = useScannerPortfolioItemActions({
    tableData,
    sellDialogSourceItems,
    relatedPortfolioRowsForPanelLength: relatedPortfolioRowsForPanel.length,
    mode,
    addManualItem,
    updateManualItem,
    updateManualItemQty,
    removeItem,
    setSelectedItemForPanel,
  });

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

  const getSelectionForItemGroup = useCallback(
    (targetItem: ScanResultItem) => getScannerGroupSelection(tableData, targetItem),
    [tableData]
  );

  const handleSellAll = useCallback(() => {
    if (!currentSelectedItemForPanel) return;
    setRowSelection(getSelectionForItemGroup(currentSelectedItemForPanel));
    setSellDialogOpen(true);
    setSelectedItemForPanel(null);
  }, [currentSelectedItemForPanel, getSelectionForItemGroup, setSelectedItemForPanel]);

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
    setRowSelection(getSelectionForItemGroup(currentSelectedItemForPanel));
    setDeleteConfirmOpen(true);
  }, [currentSelectedItemForPanel, getSelectionForItemGroup]);

  const totalWalletVnd = useMemo(() => {
    return state.accounts.reduce((sum, acc) => {
      if (acc.result?.walletBalanceVnd) {
        return sum + acc.result.walletBalanceVnd;
      }
      return sum;
    }, 0);
  }, [state.accounts]);

  const table = useScannerResultsTable({
    t,
    tableData,
    debouncedGlobalFilter: debouncedUrlState.q,
    pagination,
    setPagination,
    rowSelection,
    setRowSelection,
    setGlobalFilter,
    scannerState: state,
    fetchBuffPrice,
    updateBuffPriceCny,
    buffCnyToVndRate,
    rateAll,
    rateLe,
    updateManualItemQty,
    mergedRawItems: mergedRaw?.items,
    activeMode,
    onSelectItem: setSelectedItemForPanel,
    isMobile,
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
        <DeleteSelectedSummary
          selectedRows={selectedRows}
          isExpanded={isDeleteListExpanded}
          onToggleExpanded={() => setIsDeleteListExpanded((value) => !value)}
          t={t}
        />
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
