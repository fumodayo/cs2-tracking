'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Loader2, Search, Trash2, AlertCircle, Plus, ExternalLink } from 'lucide-react';
import { proxySteamUrl } from '@/utils/url';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { AccountWallet } from './account-wallet';
import { AccountCookiePanel } from './account-cookie-panel';
import { AccountStorageUnits } from './account-storage-units';
import {
  STEAM_PRIVACY_SETTINGS_URL,
  isPrivateInventoryAccountError,
  translateAccountError,
} from '../../inventory-scanner/utils';
import type { SteamAccountDto } from '@/lib/api-client/steam-accounts-api';

const AccountListItemComponent = memo(
  function AccountListItemComponent({
    account,
    isCookieExpanded,
    setShowCookies,
    isSyncing,
    singleScanId,
    startSingleSync,
    setAccountToDelete,
    deleteAccountPending,
    updateCookieMutation,
    cookieStatuses,
    checkCooldowns,
    handleCheckCookie,
    cookieInputs,
    setCookieInputs,
    parentalInputs,
    setParentalInputs,
    sessionIdInputs,
    setSessionIdInputs,
    setShowCookieGuide,
    onSelectStorageUnit,
  }: {
    account: SteamAccountDto;
    isCookieExpanded: boolean;
    setShowCookies: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    isSyncing: boolean;
    singleScanId: string | null;
    startSingleSync: (id: string, name: string) => void;
    setAccountToDelete: (account: { id: string; name: string } | null) => void;
    deleteAccountPending: boolean;
    updateCookieMutation: AccountListProps['updateCookieMutation'];
    cookieStatuses: AccountListProps['cookieStatuses'];
    checkCooldowns: Record<string, number>;
    handleCheckCookie: (accountId: string) => void;
    cookieInputs: Record<string, string>;
    setCookieInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    parentalInputs: Record<string, string>;
    setParentalInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    sessionIdInputs: Record<string, string>;
    setSessionIdInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setShowCookieGuide: (show: boolean) => void;
    onSelectStorageUnit: AccountListProps['onSelectStorageUnit'];
  }) {
    const { t } = useTranslation();
    const cookieErrorMessage = translateAccountError(account.cookieError, t);
    const showPrivacySettingsLink = isPrivateInventoryAccountError(account.cookieError);

    return (
      <div className="group hover:border-accent/30 relative flex flex-col gap-3.5 overflow-hidden rounded-xl border border-stone-800/80 bg-gradient-to-b from-stone-950/90 via-stone-950/60 to-stone-950/30 p-4 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(59,130,246,0.03)]">
        <div
          className={cn(
            'absolute top-0 bottom-0 left-0 w-[3px] transition-colors duration-300',
            account.cookieError ? 'bg-red-500/80' : 'group-hover:bg-accent/40 bg-transparent'
          )}
        />

        <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
            {account.avatarUrl ? (
              <img
                src={proxySteamUrl(account.avatarUrl)}
                alt={t('steamAccounts.avatarAlt', "{{name}}'s Steam avatar", {
                  name: account.name,
                })}
                className="size-9 shrink-0 rounded-full border border-stone-800/80 object-cover shadow-sm sm:size-11"
              />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-stone-800/80 bg-stone-900/60 sm:size-11">
                <Users className="size-4 text-stone-500 sm:size-5" />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <div className="group-hover:text-foreground truncate text-sm font-bold text-stone-200 transition-colors">
                {account.name}
              </div>
              <a
                href={account.steamUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent mt-0.5 block truncate font-mono text-[10px] text-stone-500 transition-colors"
              >
                {account.steamId64}
              </a>
              <AccountWallet account={account} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => startSingleSync(account.id, account.name)}
              disabled={isSyncing || !!singleScanId}
              className="hover:border-accent/40 hover:bg-accent/10 hover:text-accent flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-[11px] font-bold transition-all disabled:cursor-wait disabled:opacity-40 sm:px-3"
              title={t('dashboard.scanSingle')}
            >
              {singleScanId === account.id ? (
                <Loader2 className="size-3.5 animate-spin sm:mr-1.5" />
              ) : (
                <Search className="size-3.5 sm:mr-1.5" />
              )}
              <span className="hidden sm:inline">
                {singleScanId === account.id
                  ? t('dashboard.scanningSingle')
                  : t('dashboard.scanSingle')}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setAccountToDelete({
                  id: account.id,
                  name: account.name,
                })
              }
              disabled={deleteAccountPending}
              className="size-8 cursor-pointer rounded-lg p-0 text-stone-500 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title={t('dashboard.unlink')}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {account.cookieError && (
          <div className="mt-1 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-[11px] leading-relaxed text-red-700 shadow-sm dark:border-red-900/30 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-900 dark:text-red-200">
                {t('dashboard.cookieErrorTitle', 'Cookie Configuration Required')}
              </p>
              <p className="mt-0.5 font-medium break-words whitespace-normal text-red-700 dark:text-red-300/95">
                {cookieErrorMessage}
              </p>
              {showPrivacySettingsLink && (
                <a
                  href={STEAM_PRIVACY_SETTINGS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-800 underline underline-offset-2 transition-colors hover:text-red-950 dark:text-red-200 dark:hover:text-red-100"
                >
                  {t('inventoryScanner.openSteamPrivacySettings', 'Open Steam Privacy Settings')}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        )}

        <AccountCookiePanel
          account={account}
          isCookieExpanded={isCookieExpanded}
          onToggleExpand={() =>
            setShowCookies((prev) => ({
              ...prev,
              [account.id]: !isCookieExpanded,
            }))
          }
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
        />

        <AccountStorageUnits
          steamId64={account.steamId64}
          onSelectStorageUnit={onSelectStorageUnit}
        />
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.account === next.account &&
      prev.isCookieExpanded === next.isCookieExpanded &&
      prev.isSyncing === next.isSyncing &&
      prev.singleScanId === next.singleScanId &&
      prev.deleteAccountPending === next.deleteAccountPending &&
      prev.cookieStatuses?.[prev.account.id] === next.cookieStatuses?.[next.account.id] &&
      prev.checkCooldowns?.[prev.account.id] === next.checkCooldowns?.[next.account.id] &&
      prev.cookieInputs?.[prev.account.id] === next.cookieInputs?.[next.account.id] &&
      prev.parentalInputs?.[prev.account.id] === next.parentalInputs?.[next.account.id] &&
      prev.sessionIdInputs?.[prev.account.id] === next.sessionIdInputs?.[next.account.id]
    );
  }
);

AccountListItemComponent.displayName = 'AccountListItemComponent';

interface AccountListProps {
  accounts: SteamAccountDto[];
  isLoading: boolean;
  isSyncing: boolean;
  singleScanId: string | null;
  startSingleSync: (id: string, name: string) => void;
  setAccountToDelete: (account: { id: string; name: string } | null) => void;
  deleteAccountPending: boolean;
  showCookies: Record<string, boolean>;
  setShowCookies: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  updateCookieMutation: {
    mutate: (payload: { id: string; steamCookie: string }) => void;
    isPending: boolean;
  };
  cookieStatuses: Record<
    string,
    {
      status: 'idle' | 'loading' | 'live' | 'expired' | 'error';
      message?: string;
    }
  >;
  checkCooldowns: Record<string, number>;
  handleCheckCookie: (accountId: string) => void;
  cookieInputs: Record<string, string>;
  setCookieInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  parentalInputs: Record<string, string>;
  setParentalInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sessionIdInputs: Record<string, string>;
  setSessionIdInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setShowCookieGuide: (show: boolean) => void;
  onAddAccountClick: () => void;
  onSelectStorageUnit: (su: {
    id: string;
    name: string;
    currentCount: number;
    maxCapacity: number;
    items: Array<{
      caseId: string;
      marketHashName: string;
      name: string;
      imageUrl?: string;
      rarity?: { name: string; color: string } | null;
      quantity: number;
    }>;
  }) => void;
}

export function AccountList({
  accounts,
  isLoading,
  isSyncing,
  singleScanId,
  startSingleSync,
  setAccountToDelete,
  deleteAccountPending,
  showCookies,
  setShowCookies,
  updateCookieMutation,
  cookieStatuses,
  checkCooldowns,
  handleCheckCookie,
  cookieInputs,
  setCookieInputs,
  parentalInputs,
  setParentalInputs,
  sessionIdInputs,
  setSessionIdInputs,
  setShowCookieGuide,
  onAddAccountClick,
  onSelectStorageUnit,
}: AccountListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-stone-900/60" />
        ))}
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-stone-800 bg-stone-950/20 p-8 text-center">
        <button
          type="button"
          onClick={onAddAccountClick}
          className="group flex cursor-pointer flex-col items-center justify-center gap-2"
        >
          <Plus className="size-6 text-stone-500 transition-colors group-hover:text-stone-300" />
          <span className="text-sm font-semibold text-stone-400 transition-colors group-hover:text-stone-200">
            {t('dashboard.addAccount', 'Add Account')}
          </span>
        </button>
        <p className="mt-2 max-w-sm text-[11px] text-stone-500">{t('dashboard.noAccountsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {accounts.map((account) => {
        const isCookieExpanded = showCookies[account.id] ?? false;

        return (
          <AccountListItemComponent
            key={account.id}
            account={account}
            isCookieExpanded={isCookieExpanded}
            setShowCookies={setShowCookies}
            isSyncing={isSyncing}
            singleScanId={singleScanId}
            startSingleSync={startSingleSync}
            setAccountToDelete={setAccountToDelete}
            deleteAccountPending={deleteAccountPending}
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
            onSelectStorageUnit={onSelectStorageUnit}
          />
        );
      })}

      {/* Card thêm tài khoản */}
      <button
        type="button"
        onClick={onAddAccountClick}
        className="border-stone-850 hover:bg-accent/[0.02] hover:border-accent/40 group flex min-h-[160px] w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed bg-stone-950/15 p-6 text-center transition-all duration-300 select-none hover:shadow-[0_4px_20px_rgba(59,130,246,0.03)]"
      >
        <div className="group-hover:border-accent/30 group-hover:bg-accent/10 flex size-10 items-center justify-center rounded-full border border-stone-800 bg-stone-900/50 transition-all duration-300">
          <Plus className="group-hover:text-accent size-5 text-stone-500 transition-all duration-300 group-hover:rotate-90" />
        </div>
        <span className="text-xs font-bold text-stone-400 transition-colors group-hover:text-stone-200">
          {t('dashboard.addAccount', 'Add Account')}
        </span>
      </button>
    </div>
  );
}
