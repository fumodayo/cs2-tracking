import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TbPackage } from "react-icons/tb";
import {
  Users,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCcw,
  Plus,
  Eye,
  EyeOff,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { UseQueryResult } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SlidePanel, SlidePanelContent } from "@/components/ui/slide-panel";
import { FadeIn } from "@/components/ui/animation";

import { CookieGuideModal } from "@/components/shared/cookie-guide-modal";
import { MissingItemsDialog, StorageUnitInspectPanel } from "@/components/portfolio";
import { useSteamAccounts } from "../use-steam-accounts";
import { parseSteamCookies, buildSteamCookie } from "@/infrastructure/steam";
import { toast } from "@/stores";
import type { PortfolioReportDto } from "@/types/report";
import { AccountStorageUnits } from "./account-storage-units";
import { AddAccountDialog } from "./add-account-dialog";

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
  const [selectedStorageUnit, setSelectedStorageUnit] = useState<{
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
  } | null>(null);

  const {
    accountsQuery,
    addAccountMutation,
    deleteAccountMutation,
    updateCookieMutation,
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

  const [showSecureCookie, setShowSecureCookie] = useState<Record<string, boolean>>({});
  const [showSecureParental, setShowSecureParental] = useState<Record<string, boolean>>({});
  const [showSecureSessionId, setShowSecureSessionId] = useState<Record<string, boolean>>({});

  const [useFamilyViewMap, setUseFamilyViewMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleShowGuide = () => setShowCookieGuide(true);
    window.addEventListener("show-cookie-guide", handleShowGuide);
    return () => window.removeEventListener("show-cookie-guide", handleShowGuide);
  }, [setShowCookieGuide]);

  return (
    <>
      <FadeIn delay={0.26} direction="up">
        <div className="space-y-4 rounded-lg border border-stone-800 bg-stone-900/20 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-200">
              <Users className="size-4 text-blue-400" />
              {t("dashboard.steamAccounts")} ({accountsQuery.data?.length ?? 0})
            </h3>
            <div className="flex items-center gap-2">
              {accountsQuery.data && accountsQuery.data.length > 0 && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={startSync}
                  disabled={isSyncing || !!singleScanId}
                  className="h-8 text-xs font-semibold"
                >
                  <RefreshCcw
                    className={`size-3 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  {t("dashboard.scanAll")}
                </Button>
              )}
            </div>
          </div>



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
                        acc.status === "done"
                          ? "border-emerald-500/20 bg-emerald-950/20"
                          : acc.status === "error"
                            ? "border-red-500/20 bg-red-950/20"
                            : "border-stone-700 bg-stone-950/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {acc.avatarUrl ? (
                          <img
                            src={acc.avatarUrl}
                            alt=""
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
                              {acc.status === "scanning" && (
                                <Loader2 className="size-3.5 animate-spin text-blue-400" />
                              )}
                              {acc.status === "done" && (
                                <CheckCircle2 className="size-3.5 text-emerald-400" />
                              )}
                              {acc.status === "error" && (
                                <AlertCircle className="size-3.5 text-red-400" />
                              )}
                              <span
                                className={`text-xs font-medium ${
                                  acc.status === "done"
                                    ? "text-emerald-400"
                                    : acc.status === "error"
                                      ? "text-red-400"
                                      : "text-blue-300"
                                }`}
                              >
                                {acc.status === "done"
                                  ? t("dashboard.done")
                                  : acc.status === "error"
                                    ? t("dashboard.error")
                                    : `${Math.round(acc.percent)}%`}
                              </span>
                            </div>
                          </div>
                          {acc.status === "scanning" && acc.scanProgress && (
                            <>
                              <p className="mt-1 truncate text-[11px] text-stone-400">
                                {acc.scanProgress.message}
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
                                    .join(" · ")}
                                </p>
                              )}
                            </>
                          )}
                          {acc.status === "error" && (
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

          {accountsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-md bg-stone-900/60"
                />
              ))}
            </div>
          ) : accountsQuery.data && accountsQuery.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {accountsQuery.data.map((account) => {
                const isCookieExpanded = showCookies[account.id] ?? false;
                const hasCookieSet =
                  typeof account.steamCookie === "string" &&
                  account.steamCookie.trim().length > 0;

                const parsed = parseSteamCookies(account.steamCookie || "");
                const parsedLoginSecure = parsed.steamLoginSecure;
                const parsedParental = parsed.steamparental || "";
                const parsedSessionId = parsed.sessionid || "";
                const isFamilyViewEnabled = useFamilyViewMap[account.id] ?? (!!parsedParental || !!parsedSessionId);

                const hasUnsavedCookieChange =
                  (cookieInputs[account.id] !== undefined &&
                    cookieInputs[account.id] !== parsedLoginSecure) ||
                  (parentalInputs[account.id] !== undefined &&
                    parentalInputs[account.id] !== parsedParental) ||
                  (sessionIdInputs[account.id] !== undefined &&
                    sessionIdInputs[account.id] !== parsedSessionId);

                const isSavedCookieCheckable =
                  hasCookieSet && !hasUnsavedCookieChange;

                return (
                  <div
                    key={account.id}
                    className="group flex flex-col gap-3 rounded-md border border-stone-800 bg-stone-950/40 p-3.5 transition-all duration-200 hover:border-stone-700"
                  >
                    <div className="flex min-w-0 items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {account.avatarUrl ? (
                          <img
                            src={account.avatarUrl}
                            alt={account.name}
                            className="size-9 rounded-full border border-stone-800 object-cover"
                          />
                        ) : (
                          <div className="bg-stone-850 flex size-9 items-center justify-center rounded-full border border-stone-800">
                            <Users className="size-4 text-stone-500" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-col items-start">
                          <div className="w-full truncate text-sm font-semibold text-stone-200">
                            {account.name}
                          </div>
                          <a
                            href={account.steamUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block truncate text-[11px] text-stone-500 transition-colors hover:text-blue-400"
                          >
                            {account.steamId64}
                          </a>
                          {account.cookieError && (
                            <div
                              className="mt-1 flex items-center gap-1.5 rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400 shadow-sm"
                              title={account.cookieError}
                            >
                              <AlertCircle className="size-3 shrink-0" />
                              <span className="whitespace-normal">
                                {account.cookieError}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            startSingleSync(account.id, account.name)
                          }
                          disabled={isSyncing || !!singleScanId}
                          className="h-7 px-2 text-[10px] font-semibold hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:cursor-wait disabled:opacity-40"
                          title={t("dashboard.scanSingle")}
                        >
                          {singleScanId === account.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Search className="size-3" />
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
                          disabled={deleteAccountMutation.isPending}
                          className="size-7 p-0 text-stone-500 transition-all hover:text-red-450 hover:bg-red-500/10 disabled:opacity-50"
                          title={t("dashboard.unlink")}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="rounded border border-stone-800 bg-stone-950/20">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setShowCookies((prev) => ({
                            ...prev,
                            [account.id]: !isCookieExpanded,
                          }))
                        }
                        className="flex w-full items-center justify-between rounded-t px-2.5 py-1.5 text-[11px] font-medium text-stone-400 transition-colors hover:bg-stone-900/20 hover:text-stone-300"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`size-1.5 rounded-full ${hasCookieSet ? "animate-pulse bg-blue-400" : "bg-stone-600"}`}
                          />
                          <span>Cookie Config (Held Items)</span>
                        </span>
                        {isCookieExpanded ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                      </Button>

                      <AnimatePresence initial={false}>
                        {isCookieExpanded && (
                          <motion.div
                            key="cookie-config-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1 space-y-2 border-t border-stone-800/40 p-2.5 pt-0">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <label className="block text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                                  steamLoginSecure (Cookie)
                                </label>
                                {cookieStatuses[account.id] && (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold ${
                                      cookieStatuses[account.id].status ===
                                      "live"
                                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                        : cookieStatuses[account.id].status ===
                                            "expired"
                                          ? "border border-red-500/20 bg-red-500/10 text-red-400"
                                          : cookieStatuses[account.id]
                                                .status === "error"
                                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                                            : "bg-stone-500/10 text-stone-400"
                                    }`}
                                  >
                                    <span
                                      className={`size-1 rounded-full ${
                                        cookieStatuses[account.id].status ===
                                        "live"
                                          ? "animate-pulse bg-emerald-400"
                                          : cookieStatuses[account.id]
                                                .status === "expired"
                                            ? "bg-red-400"
                                            : cookieStatuses[account.id]
                                                  .status === "error"
                                              ? "bg-amber-400"
                                              : "bg-stone-400"
                                      }`}
                                    />
                                    {cookieStatuses[account.id].status ===
                                      "live" && "Live"}
                                    {cookieStatuses[account.id].status ===
                                      "expired" && "Hết hạn"}
                                    {cookieStatuses[account.id].status ===
                                      "error" &&
                                      (cookieStatuses[account.id].message ||
                                        "Lỗi")}
                                  </span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowCookieGuide(true)}
                                className="h-auto p-0 text-[9px] font-semibold text-blue-400 hover:text-blue-300 hover:underline hover:bg-transparent"
                              >
                                <HelpCircle className="size-2.5" />
                                {t("dashboard.howToGetCookie")}
                              </Button>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex-grow">
                                  <input
                                    type={showSecureCookie[account.id] ? "text" : "password"}
                                    placeholder="Nhập steamLoginSecure..."
                                    value={
                                      cookieInputs[account.id] ??
                                      parsedLoginSecure
                                    }
                                    onChange={(e) =>
                                      setCookieInputs((prev) => ({
                                        ...prev,
                                        [account.id]: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded border border-stone-800 bg-stone-950 pl-2 pr-7 py-1 text-xs text-stone-300 placeholder-stone-700 transition-colors focus:border-stone-700 focus:ring-1 focus:ring-stone-800 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowSecureCookie((prev) => ({
                                        ...prev,
                                        [account.id]: !prev[account.id],
                                      }))
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                                  >
                                    {showSecureCookie[account.id] ? (
                                      <EyeOff className="size-3.5" />
                                    ) : (
                                      <Eye className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={updateCookieMutation.isPending}
                                    onClick={() => {
                                      const sLogin =
                                        cookieInputs[account.id] ??
                                        parsedLoginSecure;
                                      const sParental = isFamilyViewEnabled
                                        ? (parentalInputs[account.id] ?? parsedParental)
                                        : "";
                                      const sSessionId = isFamilyViewEnabled
                                        ? (sessionIdInputs[account.id] ?? parsedSessionId)
                                        : "";
                                      const combined = buildSteamCookie(
                                        sLogin,
                                        sSessionId,
                                        sParental,
                                      );
                                      updateCookieMutation.mutate({
                                        id: account.id,
                                        steamCookie: combined,
                                      });
                                    }}
                                    className="h-[26px] cursor-pointer px-2.5 py-1 text-[10px] font-semibold text-stone-300 transition-colors hover:text-stone-100 disabled:opacity-50"
                                  >
                                    {updateCookieMutation.isPending
                                      ? t("common.saving")
                                      : t("common.save")}
                                  </Button>
                                  {isSavedCookieCheckable && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={
                                        cookieStatuses[account.id]?.status ===
                                          "loading" ||
                                        checkCooldowns[account.id] > 0
                                      }
                                      onClick={() =>
                                        handleCheckCookie(account.id)
                                      }
                                      className="flex h-[26px] min-w-[64px] cursor-pointer items-center justify-center px-2.5 py-1 text-[10px] font-semibold text-stone-300 transition-colors hover:text-stone-100 disabled:opacity-50"
                                      title="Kiểm tra xem cookie còn hoạt động không"
                                    >
                                      {cookieStatuses[account.id]?.status ===
                                      "loading" ? (
                                        <span className="size-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                                      ) : checkCooldowns[account.id] > 0 ? (
                                        <span>{checkCooldowns[account.id]}s</span>
                                      ) : (
                                        <span>Kiểm tra</span>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setUseFamilyViewMap((prev) => ({
                                    ...prev,
                                    [account.id]: !isFamilyViewEnabled,
                                  }))
                                }
                                className="flex w-full items-center justify-between h-7 px-2 text-[10px] font-semibold text-stone-400 hover:bg-stone-900/30 hover:text-stone-300"
                              >
                                <span>Tài khoản sử dụng Family View</span>
                                {isFamilyViewEnabled ? (
                                  <ChevronUp className="size-3" />
                                ) : (
                                  <ChevronDown className="size-3" />
                                )}
                              </Button>

                              <AnimatePresence initial={false}>
                                {isFamilyViewEnabled && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex flex-col gap-1.5 border-l border-stone-800 pl-2 mt-1 space-y-1.5 pb-1">
                                      <div className="relative w-full">
                                        <input
                                          type={showSecureParental[account.id] ? "text" : "password"}
                                          placeholder="Nhập steamparental (Nếu có bật Family View)..."
                                          value={
                                            parentalInputs[account.id] ?? parsedParental
                                          }
                                          onChange={(e) =>
                                            setParentalInputs((prev) => ({
                                              ...prev,
                                              [account.id]: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded border border-stone-800 bg-stone-950 pl-2 pr-7 py-1 text-xs text-stone-300 placeholder-stone-700 transition-colors focus:border-stone-700 focus:ring-1 focus:ring-stone-800 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setShowSecureParental((prev) => ({
                                              ...prev,
                                              [account.id]: !prev[account.id],
                                            }))
                                          }
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                                        >
                                          {showSecureParental[account.id] ? (
                                            <EyeOff className="size-3.5" />
                                          ) : (
                                            <Eye className="size-3.5" />
                                          )}
                                        </button>
                                      </div>
                                      <div className="relative w-full">
                                        <input
                                          type={showSecureSessionId[account.id] ? "text" : "password"}
                                          placeholder="Nhập sessionid (Cần thiết khi có bật Family View)..."
                                          value={
                                            sessionIdInputs[account.id] ??
                                            parsedSessionId
                                          }
                                          onChange={(e) =>
                                            setSessionIdInputs((prev) => ({
                                              ...prev,
                                              [account.id]: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded border border-stone-800 bg-stone-950 pl-2 pr-7 py-1 text-xs text-stone-300 placeholder-stone-700 transition-colors focus:border-stone-700 focus:ring-1 focus:ring-stone-800 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setShowSecureSessionId((prev) => ({
                                              ...prev,
                                              [account.id]: !prev[account.id],
                                            }))
                                          }
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                                        >
                                          {showSecureSessionId[account.id] ? (
                                            <EyeOff className="size-3.5" />
                                          ) : (
                                            <Eye className="size-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <AccountStorageUnits
                      steamId64={account.steamId64}
                      onSelectStorageUnit={setSelectedStorageUnit}
                    />
                  </div>
                );
              })}

              {/* Add Account Card */}
              <button
                type="button"
                onClick={() => setShowAddAccountModal(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-stone-800 bg-stone-950/20 hover:bg-stone-900/10 hover:border-stone-700 p-6 min-h-[160px] w-full transition-all duration-200 group text-center cursor-pointer select-none"
              >
                <Plus className="size-5 text-stone-500 group-hover:text-stone-300 transition-colors" />
                <span className="text-xs font-semibold text-stone-400 group-hover:text-stone-200 transition-colors">
                  {t("dashboard.addAccount") || "Thêm tài khoản"}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-stone-800 bg-stone-950/20 p-8 min-h-[160px] text-center w-full">
              <button
                type="button"
                onClick={() => setShowAddAccountModal(true)}
                className="flex flex-col items-center justify-center gap-2 group cursor-pointer"
              >
                <Plus className="size-6 text-stone-500 group-hover:text-stone-300 transition-colors" />
                <span className="text-sm font-semibold text-stone-400 group-hover:text-stone-200 transition-colors">
                  {t("dashboard.addAccount") || "Thêm tài khoản"}
                </span>
              </button>
              <p className="mt-2 text-[11px] text-stone-500 max-w-sm">
                {t("dashboard.noAccountsDesc")}
              </p>
            </div>
          )}
        </div>
      </FadeIn>

      <CookieGuideModal
        open={showCookieGuide}
        onClose={() => setShowCookieGuide(false)}
      />

      <AddAccountDialog
        open={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSubmit={(payload) => addAccountMutation.mutate(payload)}
        isPending={addAccountMutation.isPending}
      />

      <ConfirmDialog
        open={accountToDelete !== null}
        onClose={() => setAccountToDelete(null)}
        title="Xác nhận hủy liên kết tài khoản"
        description={`Bạn có chắc chắn muốn hủy liên kết tài khoản Steam "${accountToDelete?.name}"? Thao tác này sẽ xóa toàn bộ các vật phẩm đã đồng bộ từ tài khoản này khỏi portfolio.`}
        confirmText="Hủy liên kết"
        cancelText="Quay lại"
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
            const res = await fetch(
              "/api/portfolio/storage-units/resolve-missing",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resolutions }),
              },
            );
            if (res.ok) {
              toast.success("Đã xử lý items biến mất thành công.");
            } else {
              const data = await res.json().catch(() => ({}));
              toast.error(
                (data as { message?: string }).message ??
                  "Không thể xử lý items biến mất.",
              );
            }
          } catch {
            toast.error("Không thể kết nối đến máy chủ.");
          }
        }}
      />

      <SlidePanel
        open={!!selectedStorageUnit}
        onOpenChange={(open) => !open && setSelectedStorageUnit(null)}
      >
        {selectedStorageUnit && report && (
          <SlidePanelContent
            title={
              <span className="flex items-center gap-2">
                <TbPackage className="size-5 text-amber-400" />
                <span>{selectedStorageUnit.name}</span>
              </span>
            }
            description="Chi tiết hòm và vật phẩm bên trong Storage Unit"
          >
            <StorageUnitInspectPanel
              storageUnit={selectedStorageUnit}
              report={report}
              buffPricesCny={buffPricesCny}
              buffCnyToVndRate={buffCnyToVndRate}
            />
          </SlidePanelContent>
        )}
      </SlidePanel>
    </>
  );
}
