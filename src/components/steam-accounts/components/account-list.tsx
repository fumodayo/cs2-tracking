"use client";

import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Users, Loader2, Search, Trash2, AlertCircle, Plus } from "lucide-react";
import { proxySteamUrl } from "@/utils/url";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { AccountWallet } from "./account-wallet";
import { AccountCookiePanel } from "./account-cookie-panel";
import { AccountStorageUnits } from "./account-storage-units";
import type { SteamAccountDto } from "@/lib/api-client/steam-accounts-api";

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
    updateCookieMutation: AccountListProps["updateCookieMutation"];
    cookieStatuses: AccountListProps["cookieStatuses"];
    checkCooldowns: Record<string, number>;
    handleCheckCookie: (accountId: string) => void;
    cookieInputs: Record<string, string>;
    setCookieInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    parentalInputs: Record<string, string>;
    setParentalInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    sessionIdInputs: Record<string, string>;
    setSessionIdInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setShowCookieGuide: (show: boolean) => void;
    onSelectStorageUnit: AccountListProps["onSelectStorageUnit"];
  }) {
    const { t } = useTranslation();
    return (
      <div
        className="group relative flex flex-col gap-3.5 rounded-xl border border-stone-800/80 bg-gradient-to-b from-stone-950/90 via-stone-950/60 to-stone-950/30 p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-[0_4px_20px_rgba(59,130,246,0.03)] overflow-hidden"
      >
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300",
            account.cookieError ? "bg-red-500/80" : "bg-transparent group-hover:bg-accent/40"
          )}
        />
        
        <div className="flex items-center justify-between gap-3 min-w-0 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            {account.avatarUrl ? (
              <img
                src={proxySteamUrl(account.avatarUrl)}
                alt={t("steamAccounts.avatarAlt", "{{name}}'s Steam avatar", { name: account.name })}
                className="size-11 rounded-full border border-stone-800/80 object-cover shrink-0 shadow-sm"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-full border border-stone-800/80 bg-stone-900/60 shrink-0">
                <Users className="size-5 text-stone-500" />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <div className="truncate text-sm font-bold text-stone-200 group-hover:text-foreground transition-colors">
                {account.name}
              </div>
              <a
                href={account.steamUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block truncate text-[10px] text-stone-500 transition-colors hover:text-accent font-mono"
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
              className="h-8 px-3 rounded-lg text-[11px] font-bold hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:cursor-wait disabled:opacity-40 transition-all cursor-pointer"
              title={t("dashboard.scanSingle")}
            >
              {singleScanId === account.id ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Search className="size-3.5 mr-1.5" />
              )}
              {singleScanId === account.id
                ? t("dashboard.scanningSingle")
                : t("dashboard.scanSingle")}
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
              className="size-8 p-0 rounded-lg text-stone-500 transition-all hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
              title={t("dashboard.unlink")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {account.cookieError && (
          <div className="mt-1 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/30 p-2.5 text-[11px] text-red-700 dark:text-red-300 shadow-sm leading-relaxed">
            <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-900 dark:text-red-200">
                {t("dashboard.cookieErrorTitle", "Cookie Configuration Required")}
              </p>
              <p className="mt-0.5 text-red-700 dark:text-red-300/95 font-medium whitespace-normal break-words">
                {account.cookieError}
              </p>
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

AccountListItemComponent.displayName = "AccountListItemComponent";

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
      status: "idle" | "loading" | "live" | "expired" | "error";
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
      <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-stone-800 bg-stone-950/20 p-8 min-h-[160px] text-center w-full">
        <button
          type="button"
          onClick={onAddAccountClick}
          className="flex flex-col items-center justify-center gap-2 group cursor-pointer"
        >
          <Plus className="size-6 text-stone-500 group-hover:text-stone-300 transition-colors" />
          <span className="text-sm font-semibold text-stone-400 group-hover:text-stone-200 transition-colors">
            {t("dashboard.addAccount", "Add Account")}
          </span>
        </button>
        <p className="mt-2 text-[11px] text-stone-500 max-w-sm">
          {t("dashboard.noAccountsDesc")}
        </p>
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

      {/* Add Account Card */}
      <button
        type="button"
        onClick={onAddAccountClick}
        className="flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-stone-850 bg-stone-950/15 hover:bg-accent/[0.02] hover:border-accent/40 p-6 min-h-[160px] w-full transition-all duration-300 group text-center cursor-pointer select-none hover:shadow-[0_4px_20px_rgba(59,130,246,0.03)]"
      >
        <div className="flex size-10 items-center justify-center rounded-full border border-stone-800 bg-stone-900/50 group-hover:border-accent/30 group-hover:bg-accent/10 transition-all duration-300">
          <Plus className="size-5 text-stone-500 group-hover:text-accent group-hover:rotate-90 transition-all duration-300" />
        </div>
        <span className="text-xs font-bold text-stone-400 group-hover:text-stone-200 transition-colors">
          {t("dashboard.addAccount", "Add Account")}
        </span>
      </button>
    </div>
  );
}
