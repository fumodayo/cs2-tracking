'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AccountCard } from './account-card';
import {
  STEAM_PRIVACY_SETTINGS_URL,
  isPrivateInventoryAccountError,
  translateAccountError,
} from '../utils';
import type { AccountEntry } from '../types';

interface AccountsSectionProps {
  isLoaded: boolean;
  accounts: AccountEntry[];
  scanningAll: boolean;
  isAnyScanPending: boolean;
  hasValidUrls: boolean;
  expandedAccId: string | null;
  setExpandedAccId: (id: string | null) => void;
  cancelScanAll: () => void;
  scanAll: (force?: boolean) => void;
  doScan: (
    accountId: string,
    forceRefresh: boolean,
    currentAccounts: AccountEntry[],
    signal?: AbortSignal,
    isPartOfScanAll?: boolean
  ) => Promise<void>;
  removeAccount: (accountId: string) => void;
  updateAccountUrl: (accountId: string, url: string) => void;
  updateAccountCookie: (accountId: string, cookie: string) => void;
  updateAccountSessionId: (accountId: string, sessionId: string) => void;
  addAccount: () => void;
  setShowCookieGuide: (show: boolean) => void;
}

export function AccountsSection({
  isLoaded,
  accounts,
  scanningAll,
  isAnyScanPending,
  hasValidUrls,
  expandedAccId,
  setExpandedAccId,
  cancelScanAll,
  scanAll,
  doScan,
  removeAccount,
  updateAccountUrl,
  updateAccountCookie,
  updateAccountSessionId,
  addAccount,
  setShowCookieGuide,
}: AccountsSectionProps) {
  const { t } = useTranslation();
  const [accountToDelete, setAccountToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cs2_scanner_accounts_collapsed');
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
      localStorage.setItem('cs2_scanner_accounts_collapsed', String(collapsed));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="mb-8 overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50 transition-all duration-200">
      {/* Hàng tiêu đề */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleToggleCollapse(!isCollapsed)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleCollapse(!isCollapsed);
          }
        }}
        className="flex cursor-pointer items-center justify-between p-4 transition-colors duration-200 select-none hover:bg-stone-800/10"
      >
        <div className="flex items-center gap-2 text-stone-300 transition-colors hover:text-stone-100">
          <Users className="size-4 text-blue-400" />
          <span className="text-xs font-semibold tracking-wider text-stone-300 uppercase sm:text-sm">
            {t('inventoryScanner.accountsList', { count: accounts.length })}
          </span>
          {isCollapsed ? (
            <ChevronDown className="size-4 text-stone-500" />
          ) : (
            <ChevronUp className="size-4 text-stone-500" />
          )}
        </div>

        {!isCollapsed && isLoaded && (
          <div className="flex shrink-0 items-center justify-end gap-2 sm:w-auto">
            {(scanningAll || isAnyScanPending) && (
              <Button
                type="button"
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelScanAll();
                }}
                className="h-8 cursor-pointer px-4 text-xs font-semibold"
              >
                {t('inventoryScanner.stopScan')}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                scanAll(true);
              }}
              disabled={scanningAll || isAnyScanPending || !hasValidUrls}
              className="h-8 px-4 text-xs font-semibold"
            >
              {scanningAll ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> {t('inventoryScanner.scanning')}
                </>
              ) : (
                <>
                  <Search className="size-3.5" /> {t('inventoryScanner.scanAll')}
                </>
              )}
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
              {!isLoaded ? (
                <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                  <div className="flex animate-pulse flex-col space-y-4 rounded-lg border border-stone-800 bg-stone-950/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-stone-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 rounded bg-stone-800" />
                        <div className="h-3 w-48 rounded bg-stone-800" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 flex-1 rounded bg-stone-800" />
                      <div className="h-8 w-20 rounded bg-stone-800" />
                    </div>
                  </div>
                  <div className="flex animate-pulse flex-col space-y-4 rounded-lg border border-stone-800 bg-stone-950/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-stone-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-28 rounded bg-stone-800" />
                        <div className="h-3 w-40 rounded bg-stone-800" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 flex-1 rounded bg-stone-800" />
                      <div className="h-8 w-20 rounded bg-stone-800" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                    {accounts.map((acc, idx) => (
                      <AccountCard
                        key={acc.id}
                        acc={acc}
                        index={idx}
                        isExpandedAccId={expandedAccId === acc.id}
                        onToggleExpandAccId={() =>
                          setExpandedAccId(expandedAccId === acc.id ? null : acc.id)
                        }
                        isAnyScanPending={isAnyScanPending}
                        onScan={() => doScan(acc.id, true, accounts)}
                        onCancelScan={cancelScanAll}
                        onRemove={() => {
                          const hasUrl = Boolean(acc.url?.trim());
                          const hasCookie = Boolean(acc.steamCookie?.trim());
                          const hasSession = Boolean(acc.steamSessionId?.trim());
                          const hasResult = acc.result !== null;
                          if (!hasUrl && !hasCookie && !hasSession && !hasResult) {
                            removeAccount(acc.id);
                          } else {
                            setAccountToDelete({
                              id: acc.id,
                              name:
                                acc.result?.profile?.name ||
                                acc.url ||
                                t('inventoryScanner.accountNumber', { index: idx + 1 }),
                            });
                          }
                        }}
                        onUpdateUrl={updateAccountUrl}
                        onUpdateCookie={updateAccountCookie}
                        onUpdateSessionId={updateAccountSessionId}
                        onOpenGuide={() => setShowCookieGuide(true)}
                      />
                    ))}

                    {/* Card nét đứt thêm tài khoản trong lưới */}
                    <button
                      type="button"
                      onClick={addAccount}
                      className="group flex h-full min-h-[90px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-stone-800 bg-stone-950/20 p-4 transition-all duration-200 hover:border-blue-500/30 hover:bg-stone-900/10"
                    >
                      <Plus className="size-5 text-stone-500 transition-transform group-hover:scale-110 group-hover:text-blue-400" />
                      <span className="text-xs font-semibold text-stone-400 group-hover:text-stone-300">
                        {t('inventoryScanner.addAccount')}
                      </span>
                    </button>
                  </div>

                  {accounts
                    .filter((a) => a.error)
                    .map((a) => {
                      const showPrivacySettingsLink = isPrivateInventoryAccountError(a.error);

                      return (
                        <div
                          key={`err-${a.id}`}
                          className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow-sm dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200"
                        >
                          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-300" />
                          <div className="min-w-0 flex-1">
                            <p>
                              <span className="font-medium">
                                {t('inventoryScanner.accountLabel', {
                                  index: accounts.findIndex((x) => x.id === a.id) + 1,
                                })}
                              </span>{' '}
                              {translateAccountError(a.error, t)}
                            </p>
                            {showPrivacySettingsLink && (
                              <a
                                href={STEAM_PRIVACY_SETTINGS_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-red-800 underline underline-offset-2 transition-colors hover:text-red-950 dark:text-red-200 dark:hover:text-red-100"
                              >
                                {t(
                                  'inventoryScanner.openSteamPrivacySettings',
                                  'Open Steam Privacy Settings'
                                )}
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={accountToDelete !== null}
        onClose={() => setAccountToDelete(null)}
        title={t('inventoryScanner.confirmUnlinkTitle')}
        description={t('inventoryScanner.confirmUnlinkDesc', { name: accountToDelete?.name })}
        confirmText={t('inventoryScanner.unlink')}
        cancelText={t('inventoryScanner.goBack')}
        variant="danger"
        onConfirm={async () => {
          if (accountToDelete) {
            removeAccount(accountToDelete.id);
            setAccountToDelete(null);
          }
        }}
      />
    </div>
  );
}
