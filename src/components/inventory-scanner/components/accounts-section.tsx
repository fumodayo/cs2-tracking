'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, Plus, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AccountCard } from './account-card';
import { translateAccountError } from '../utils';
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

  return (
    <div className="mb-8 rounded-xl border border-stone-800 bg-stone-900/50 p-6">
      {!isLoaded ? (
        <div className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 animate-pulse text-stone-600" />
              <div className="h-4 w-36 animate-pulse rounded bg-stone-800" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded bg-stone-800" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col space-y-4 rounded-lg border border-stone-800 bg-stone-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-stone-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
                  <div className="h-3 w-48 animate-pulse rounded bg-stone-800" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded bg-stone-800" />
                <div className="h-8 w-20 animate-pulse rounded bg-stone-800" />
              </div>
            </div>
            <div className="flex flex-col space-y-4 rounded-lg border border-stone-800 bg-stone-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-stone-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-stone-800" />
                  <div className="h-3 w-40 animate-pulse rounded bg-stone-800" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded bg-stone-800" />
                <div className="h-8 w-20 animate-pulse rounded bg-stone-800" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-stone-300 uppercase">
              <Users className="size-4 text-blue-400" />
              {t('inventoryScanner.accountsList', { count: accounts.length })}
            </h2>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              {(scanningAll || isAnyScanPending) && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={cancelScanAll}
                  className="h-8 cursor-pointer px-4 text-xs font-semibold"
                >
                  {t('inventoryScanner.stopScan')}
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                onClick={() => scanAll(true)}
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
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

            {/* Add Account Dashed Card inside grid */}
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
            .map((a) => (
              <div
                key={`err-${a.id}`}
                className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm text-red-200"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-medium">
                    {t('inventoryScanner.accountLabel', {
                      index: accounts.findIndex((x) => x.id === a.id) + 1,
                    })}
                  </span>{' '}
                  {translateAccountError(a.error, t)}
                </p>
              </div>
            ))}
        </>
      )}

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
