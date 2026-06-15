"use client";

import { AlertCircle, Loader2, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountCard } from "./account-card";
import type { AccountEntry } from "../types";

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
  return (
    <div className="mb-8 rounded-xl border border-stone-800 bg-stone-900/50 p-6">
      {!isLoaded ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-stone-500" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wider text-stone-300 uppercase flex items-center gap-2">
              <Users className="size-4 text-blue-400" />
              Danh sách tài khoản ({accounts.length})
            </h2>
            <div className="flex items-center gap-2">
              {(scanningAll || isAnyScanPending) && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={cancelScanAll}
                  className="h-8 px-4 text-xs font-semibold cursor-pointer"
                >
                  Dừng quét
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
                    <Loader2 className="size-3.5 animate-spin" /> Đang quét...
                  </>
                ) : (
                  <>
                    <Search className="size-3.5" /> Quét tất cả
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
                onRemove={removeAccount}
                onUpdateUrl={updateAccountUrl}
                onUpdateCookie={updateAccountCookie}
                onUpdateSessionId={updateAccountSessionId}
                onOpenGuide={() => setShowCookieGuide(true)}
                accountsLength={accounts.length}
              />
            ))}

            {/* Add Account Dashed Card inside grid */}
            <button
              type="button"
              onClick={addAccount}
              className="border-stone-800 hover:border-blue-500/30 hover:bg-stone-900/10 group flex h-full min-h-[90px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-stone-950/20 p-4 transition-all duration-200"
            >
              <Plus className="size-5 text-stone-500 transition-transform group-hover:scale-110 group-hover:text-blue-450" />
              <span className="text-xs font-semibold text-stone-400 group-hover:text-stone-300">
                Thêm tài khoản
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
                    TK {accounts.findIndex((x) => x.id === a.id) + 1}:
                  </span>{" "}
                  {a.error}
                </p>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
