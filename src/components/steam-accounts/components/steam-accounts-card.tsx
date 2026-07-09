'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TbPackage } from 'react-icons/tb';
import {
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';
import { FadeIn } from '@/components/ui/animation';

import { CookieGuideModal } from '@/components/shared/cookie-guide-modal';
import { proxySteamUrl } from '@/utils/url';
import { MissingItemsDialog, StorageUnitInspectPanel } from '@/components/portfolio';
import type { StorageUnit, StorageUnitItem } from '@/components/portfolio/storage-unit-panel';
import { getStorageUnitItemKey } from '@/components/portfolio/storage-unit-utils';
import { ItemHoverCard } from '@/components/portfolio/item-hover-card';
import { mapTransactionRow } from '@/components/portfolio/portfolio-table-model';
import { STORAGE_UNITS_QUERY_KEY } from '@/lib/api-client/steam-accounts-api';
import { useSteamAccounts } from '../use-steam-accounts';
import { toast } from '@/stores';
import type { PortfolioReportDto } from '@/types/report';
import { translateAccountError, translateSyncMessage } from '../../inventory-scanner/utils';
import { AddAccountDialog } from './add-account-dialog';
import { AccountList } from './account-list';

export function SteamAccountsCard({
  reportQuery,
  setError,
  buffPricesCny,
  buffCnyToVndRate,
}: {
  reportQuery: UseQueryResult<PortfolioReportDto, Error>;
  setError: (err: string | null) => void;
  buffPricesCny: Record<string, number>;
  buffCnyToVndRate: number;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedStorageUnit, setSelectedStorageUnit] = useState<StorageUnit | null>(null);
  const [selectedStorageItem, setSelectedStorageItem] = useState<StorageUnitItem | null>(null);
  const [deletingStorageUnitItemKey, setDeletingStorageUnitItemKey] = useState<string | null>(null);

  const {
    accountsQuery,
    addAccountMutation,
    deleteAccountMutation,
    isSyncing,
    syncOverallPercent,
    syncOverallMessage,
    syncAccountProgresses,
    singleScanId,
    startSync,
    startSingleSync,
    showCookies,
    setShowCookies,
    showCookieGuide,
    setShowCookieGuide,
    cookieInputs,
    setCookieInputs,
    parentalInputs,
    setParentalInputs,
    sessionIdInputs,
    setSessionIdInputs,
    updateCookieMutation,
    cookieStatuses,
    checkCooldowns,
    handleCheckCookie,
    missingItemsDialogOpen,
    setMissingItemsDialogOpen,
    syncMissingItems,
    syncExtraItems,
    syncStorageUnits,
    accountToDelete,
    setAccountToDelete,
  } = useSteamAccounts({ reportQuery, setError });

  const report = reportQuery.data ?? null;
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cs2_portfolio_accounts_collapsed');
      if (stored === 'true') {
        setIsCollapsed(true);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('cs2_portfolio_accounts_collapsed', String(collapsed));
    } catch (e) {
      console.error(e);
    }
  };

  const selectedStorageItemRow = useMemo(() => {
    if (!selectedStorageItem || !report) return null;
    const storageUnitIds = new Set(
      selectedStorageItem.storageUnitItems?.map((item) => item.storageUnitId) ?? []
    );

    const matchingRows = report.rows.filter(
      (row) =>
        row.case.id === selectedStorageItem.caseId ||
        row.case.marketHashName === selectedStorageItem.marketHashName
    );
    const storageRow =
      matchingRows.find((row) =>
        row.item.storageUnitDetails?.some((detail) => storageUnitIds.has(detail.storageUnitId))
      ) ?? matchingRows[0];

    return storageRow ? mapTransactionRow(storageRow, buffPricesCny, buffCnyToVndRate) : null;
  }, [selectedStorageItem, report, buffPricesCny, buffCnyToVndRate]);

  const handleSelectStorageItem = (item: StorageUnitItem) => {
    const hasMatchingRow = report?.rows.some(
      (row) => row.case.id === item.caseId || row.case.marketHashName === item.marketHashName
    );

    if (!hasMatchingRow) {
      toast.error(
        t('portfolio.itemDetailNotFound', 'Cannot find this item in the portfolio report.')
      );
      return;
    }
    setSelectedStorageItem(item);
  };

  const handleDeleteStorageUnitItem = async (item: StorageUnitItem) => {
    const itemKey = getStorageUnitItemKey(item);
    const sourceItems = item.storageUnitItems ?? [];

    if (sourceItems.length === 0) {
      toast.error(t('portfolio.storageUnitItemDeleteError', 'Cannot remove this storage item.'));
      return;
    }

    setDeletingStorageUnitItemKey(itemKey);
    try {
      const res = await fetch('/api/portfolio/storage-units/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: sourceItems.map((sourceItem) => ({
            storageUnitId: sourceItem.storageUnitId,
            caseId: item.caseId,
            marketHashName: item.marketHashName,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? 'deleteFailed');
      }

      setSelectedStorageUnit((current) => {
        if (!current) return current;
        return {
          ...current,
          currentCount: Math.max(0, current.currentCount - item.quantity),
          items: current.items.filter(
            (storageItem) => getStorageUnitItemKey(storageItem) !== itemKey
          ),
        };
      });
      if (selectedStorageItem && getStorageUnitItemKey(selectedStorageItem) === itemKey) {
        setSelectedStorageItem(null);
      }

      if (selectedStorageUnit?.steamId64) {
        await queryClient.invalidateQueries({
          queryKey: STORAGE_UNITS_QUERY_KEY(selectedStorageUnit.steamId64),
        });
      }
      await reportQuery.refetch();
      toast.success(t('portfolio.storageUnitItemDeleted', 'Removed item from Storage Unit.'));
    } catch {
      toast.error(t('portfolio.storageUnitItemDeleteError', 'Cannot remove this storage item.'));
    } finally {
      setDeletingStorageUnitItemKey(null);
    }
  };

  useEffect(() => {
    const handleShowGuide = () => setShowCookieGuide(true);
    window.addEventListener('show-cookie-guide', handleShowGuide);
    return () => window.removeEventListener('show-cookie-guide', handleShowGuide);
  }, [setShowCookieGuide]);

  return (
    <>
      <FadeIn delay={0.26} direction="up">
        <div className="mb-8 overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50 transition-all duration-200">
          {/* Hàng tiêu đề */}
          <div className="flex items-center justify-between p-4 select-none">
            <button
              type="button"
              onClick={() => handleToggleCollapse(!isCollapsed)}
              className="flex cursor-pointer items-center gap-2 text-stone-300 transition-colors hover:text-stone-100 focus:outline-none"
            >
              <Users className="size-4 text-blue-400" />
              <span className="text-xs font-semibold tracking-wider text-stone-300 uppercase sm:text-sm">
                {t('dashboard.steamAccounts')} ({accountsQuery.data?.length ?? 0})
              </span>
              {isCollapsed ? (
                <ChevronDown className="size-4 text-stone-500" />
              ) : (
                <ChevronUp className="size-4 text-stone-500" />
              )}
            </button>

            {!isCollapsed && accountsQuery.data && accountsQuery.data.length > 0 && (
              <div className="flex shrink-0 items-center justify-end gap-2 sm:w-auto">
                <Button
                  type="button"
                  variant="primary"
                  onClick={startSync}
                  disabled={isSyncing || !!singleScanId}
                  className="flex h-8 shrink-0 items-center justify-center px-2 text-xs font-semibold sm:px-4"
                >
                  <RefreshCcw className={`size-3.5 sm:mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{t('dashboard.scanAll')}</span>
                </Button>
              </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="border-stone-850/40 space-y-4 border-t p-4 pt-0 sm:p-6">
                  {(isSyncing || singleScanId) && (
                    <div className="space-y-3">
                      <div className="space-y-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-blue-200">
                            <Loader2 className="size-4 shrink-0 animate-spin" />
                            <span className="font-medium">{syncOverallMessage}</span>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-blue-300">
                            {Math.round(syncOverallPercent)}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-stone-800">
                          <div
                            className="h-full rounded-full bg-blue-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, syncOverallPercent))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {syncAccountProgresses.size > 0 && (
                        <div className="space-y-2">
                          {Array.from(syncAccountProgresses.values()).map((acc) => (
                            <div
                              key={acc.steamId64}
                              className={`rounded-md border px-3 py-2.5 transition-colors ${
                                acc.status === 'done'
                                  ? 'border-emerald-500/20 bg-emerald-950/20'
                                  : acc.status === 'error'
                                    ? 'border-red-500/20 bg-red-950/20'
                                    : 'border-stone-700 bg-stone-950/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {acc.avatarUrl ? (
                                  <img
                                    src={proxySteamUrl(acc.avatarUrl)}
                                    alt={t('steamAccounts.avatarAlt', "{{name}}'s Steam avatar", {
                                      name: acc.accountName,
                                    })}
                                    className="size-8 shrink-0 rounded-full border border-stone-700 object-cover"
                                  />
                                ) : (
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800">
                                    <Users className="size-3.5 text-stone-500" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-stone-200">
                                      {acc.accountName}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {acc.status === 'scanning' && (
                                        <Loader2 className="size-3.5 animate-spin text-blue-400" />
                                      )}
                                      {acc.status === 'done' && (
                                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                                      )}
                                      {acc.status === 'error' && (
                                        <AlertCircle className="size-3.5 text-red-400" />
                                      )}
                                      <span
                                        className={`text-xs font-medium ${
                                          acc.status === 'done'
                                            ? 'text-emerald-400'
                                            : acc.status === 'error'
                                              ? 'text-red-400'
                                              : 'text-blue-300'
                                        }`}
                                      >
                                        {acc.status === 'done'
                                          ? t('dashboard.done')
                                          : acc.status === 'error'
                                            ? t('dashboard.error')
                                            : `${Math.round(acc.percent)}%`}
                                      </span>
                                    </div>
                                  </div>
                                  {acc.status === 'scanning' && acc.scanProgress && (
                                    <>
                                      <p className="mt-1 truncate text-[11px] text-stone-400">
                                        {translateSyncMessage(
                                          acc.scanProgress.message,
                                          t,
                                          acc.scanProgress.detail
                                        )}
                                      </p>
                                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-800">
                                        <div
                                          className="h-full rounded-full bg-blue-400/80 transition-all duration-300"
                                          style={{
                                            width: `${Math.min(100, Math.max(0, acc.percent))}%`,
                                          }}
                                        />
                                      </div>
                                      {acc.scanProgress.detail && (
                                        <p className="mt-1 text-[10px] text-stone-500">
                                          {Object.entries(acc.scanProgress.detail)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join(' · ')}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {acc.status === 'error' && (
                                    <p className="mt-1 truncate text-[11px] text-red-300">
                                      {acc.message}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <AccountList
                    accounts={accountsQuery.data ?? []}
                    isLoading={accountsQuery.isLoading}
                    isSyncing={isSyncing}
                    singleScanId={singleScanId}
                    startSingleSync={startSingleSync}
                    setAccountToDelete={setAccountToDelete}
                    deleteAccountPending={deleteAccountMutation.isPending}
                    showCookies={showCookies}
                    setShowCookies={setShowCookies}
                    updateCookieMutation={updateCookieMutation}
                    cookieStatuses={cookieStatuses}
                    checkCooldowns={checkCooldowns}
                    handleCheckCookie={handleCheckCookie}
                    cookieInputs={cookieInputs}
                    setCookieInputs={setCookieInputs}
                    parentalInputs={parentalInputs}
                    setParentalInputs={setParentalInputs}
                    sessionIdInputs={sessionIdInputs}
                    setSessionIdInputs={setSessionIdInputs}
                    setShowCookieGuide={setShowCookieGuide}
                    onAddAccountClick={() => setShowAddAccountModal(true)}
                    onSelectStorageUnit={setSelectedStorageUnit}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>

      <CookieGuideModal open={showCookieGuide} onClose={() => setShowCookieGuide(false)} />

      <AddAccountDialog
        open={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSubmit={(payload) => addAccountMutation.mutate(payload)}
        isPending={addAccountMutation.isPending}
      />

      <ConfirmDialog
        open={accountToDelete !== null}
        onClose={() => setAccountToDelete(null)}
        title={t('steamAccounts.confirmUnlinkTitle', 'Confirm Unlink Account')}
        description={t(
          'steamAccounts.confirmUnlinkDesc',
          'Are you sure you want to unlink the Steam account "{{name}}"? This will remove all items synced from this account from your portfolio.',
          { name: accountToDelete?.name }
        )}
        confirmText={t('steamAccounts.unlinkButton', 'Unlink')}
        cancelText={t('common.back', 'Back')}
        variant="danger"
        onConfirm={async () => {
          if (accountToDelete) {
            await deleteAccountMutation.mutateAsync(accountToDelete.id);
            setAccountToDelete(null);
          }
        }}
      />

      <MissingItemsDialog
        open={missingItemsDialogOpen}
        onClose={() => setMissingItemsDialogOpen(false)}
        missingItems={syncMissingItems}
        extraItems={syncExtraItems}
        storageUnits={syncStorageUnits}
        onResolve={async (resolutions) => {
          try {
            const res = await fetch('/api/portfolio/storage-units/resolve-missing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resolutions }),
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              const msg = (data as { message?: string }).message;
              toast.success(
                msg
                  ? translateAccountError(msg, t)
                  : t(
                      'steamAccounts.resolveMissingSuccess',
                      'Successfully processed missing items.'
                    )
              );
            } else {
              const data = await res.json().catch(() => ({}));
              const msg = (data as { message?: string }).message;
              toast.error(
                msg
                  ? translateAccountError(msg, t)
                  : t('steamAccounts.resolveMissingError', 'Failed to process missing items.')
              );
            }
          } catch {
            toast.error(t('common.serverConnectionError', 'Cannot connect to server.'));
          }
        }}
      />

      <SlidePanel
        open={!!selectedStorageUnit}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStorageUnit(null);
            setSelectedStorageItem(null);
          }
        }}
      >
        {selectedStorageUnit && report && (
          <SlidePanelContent
            title={
              <span className="flex items-center gap-2">
                <TbPackage className="size-5 text-amber-400" />
                <span>
                  {selectedStorageUnit.name === 'Storage Unit'
                    ? t('steamAccounts.storageUnitSingle', 'Storage Unit')
                    : selectedStorageUnit.name}
                </span>
              </span>
            }
            description={t(
              'steamAccounts.storageUnitDetailDesc',
              'Details of cases and items inside the Storage Unit'
            )}
          >
            <StorageUnitInspectPanel
              storageUnit={selectedStorageUnit}
              report={report}
              buffPricesCny={buffPricesCny}
              buffCnyToVndRate={buffCnyToVndRate}
              onSelectItem={handleSelectStorageItem}
              onDeleteItem={handleDeleteStorageUnitItem}
              deletingItemKey={deletingStorageUnitItemKey}
            />
          </SlidePanelContent>
        )}
      </SlidePanel>

      <SlidePanel
        open={!!selectedStorageItemRow}
        onOpenChange={(open) => !open && setSelectedStorageItem(null)}
        modal={false}
      >
        {selectedStorageItemRow && (
          <SlidePanelContent
            title={selectedStorageItemRow.case.name}
            hideHeader
            noPadding
            side="left"
            showOverlay={false}
            className="max-w-[440px] overflow-hidden border-stone-800/80 bg-[#0e121a] text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
          >
            <ItemHoverCard
              item={selectedStorageItemRow}
              relatedRows={[selectedStorageItemRow]}
              buffCnyToVndRate={buffCnyToVndRate}
              buffPricesCny={buffPricesCny}
              embedded
            />
          </SlidePanelContent>
        )}
      </SlidePanel>
    </>
  );
}
