"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { parseSteamCookies, buildSteamCookie } from "@/utils/steam-cookies";
import type { SteamAccountDto } from "@/lib/api-client/steam-accounts-api";

interface AccountCookiePanelProps {
  account: SteamAccountDto;
  isCookieExpanded: boolean;
  onToggleExpand: () => void;
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
}

export function AccountCookiePanel({
  account,
  isCookieExpanded,
  onToggleExpand,
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
}: AccountCookiePanelProps) {
  const { t } = useTranslation();

  const [showSecureCookie, setShowSecureCookie] = useState(false);
  const [showSecureParental, setShowSecureParental] = useState(false);
  const [showSecureSessionId, setShowSecureSessionId] = useState(false);

  const [useFamilyView, setUseFamilyView] = useState<boolean | null>(null);

  const hasCookieSet =
    typeof account.steamCookie === "string" &&
    account.steamCookie.trim().length > 0;

  const parsed = parseSteamCookies(account.steamCookie || "");
  const parsedLoginSecure = parsed.steamLoginSecure;
  const parsedParental = parsed.steamparental || "";
  const parsedSessionId = parsed.sessionid || "";

  // If local override state is not set yet, derive from active cookie data presence
  const isFamilyViewEnabled =
    useFamilyView !== null
      ? useFamilyView
      : !!parsedParental || !!parsedSessionId;

  const hasUnsavedCookieChange =
    (cookieInputs[account.id] !== undefined &&
      cookieInputs[account.id] !== parsedLoginSecure) ||
    (parentalInputs[account.id] !== undefined &&
      parentalInputs[account.id] !== parsedParental) ||
    (sessionIdInputs[account.id] !== undefined &&
      sessionIdInputs[account.id] !== parsedSessionId);

  const isSavedCookieCheckable = hasCookieSet && !hasUnsavedCookieChange;

  const handleToggleFamilyView = () => {
    setUseFamilyView(!isFamilyViewEnabled);
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-300 relative z-10",
        isCookieExpanded
          ? "border-stone-800/80 bg-stone-950/70 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]"
          : "border-stone-800 bg-stone-950/20"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between rounded-t px-3 py-2 text-[11px] font-bold text-stone-400 transition-colors hover:bg-stone-900/15 hover:text-stone-200 cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              hasCookieSet
                ? "bg-accent shadow-[0_0_6px_var(--accent)]"
                : "bg-stone-600"
            )}
          />
          <span>{t("inventoryScanner.cookieConfig")}</span>
        </span>
        {isCookieExpanded ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
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
            <div className="mt-1 space-y-2 border-t border-stone-800/30 p-3 pt-0">
              <div className="pt-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`cookie-secure-input-${account.id}`}
                      className="block text-[9px] font-extrabold tracking-wider text-stone-500"
                    >
                      <span className="opacity-75">steamLoginSecure</span>
                      <span className="text-red-500 font-bold ml-1">*</span>
                    </label>
                    {cookieStatuses[account.id] && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-extrabold tracking-wide uppercase ${cookieStatuses[account.id].status === "live"
                          ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.06)]"
                          : cookieStatuses[account.id].status === "expired"
                            ? "border border-red-500/25 bg-red-500/10 text-red-400 shadow-[0_0_6px_rgba(239,68,68,0.06)]"
                            : cookieStatuses[account.id].status === "error"
                              ? "border border-amber-500/25 bg-amber-500/10 text-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.06)]"
                              : "bg-stone-500/10 text-stone-400"
                          }`}
                      >
                        <span
                          className={`size-1 rounded-full ${cookieStatuses[account.id].status === "live"
                            ? "bg-emerald-400"
                            : cookieStatuses[account.id].status === "expired"
                              ? "bg-red-400"
                              : cookieStatuses[account.id].status === "error"
                                ? "bg-amber-400"
                                : "bg-stone-400"
                            }`}
                        />
                        {cookieStatuses[account.id].status === "live" && t("inventoryScanner.live")}
                        {cookieStatuses[account.id].status === "expired" &&
                          t("inventoryScanner.expired")}
                        {cookieStatuses[account.id].status === "error" &&
                          (cookieStatuses[account.id].message || t("inventoryScanner.error"))}
                      </span>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip
                      content={
                        <button
                          type="button"
                          onClick={() => setShowCookieGuide(true)}
                          className="text-blue-450 hover:text-blue-400 underline cursor-pointer text-[10px] font-semibold"
                        >
                          {t("inventoryScanner.howToGetCookie", "Hướng dẫn lấy mã")}
                        </button>
                      }
                      side="top"
                      align="end"
                    >
                      <button
                        type="button"
                        onClick={() => setShowCookieGuide(true)}
                        className="text-stone-500 hover:text-blue-400 hover:bg-stone-900/30 p-1 rounded transition-colors cursor-pointer"
                        aria-label={t("inventoryScanner.howToGetCookie", "Hướng dẫn lấy mã")}
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="relative w-full">
                    <input
                      id={`cookie-secure-input-${account.id}`}
                      type={showSecureCookie ? "text" : "password"}
                      placeholder={t("inventoryScanner.enterSecurePlaceholder")}
                      value={cookieInputs[account.id] ?? parsedLoginSecure}
                      onChange={(e) =>
                        setCookieInputs((prev) => ({
                          ...prev,
                          [account.id]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-stone-800/80 bg-stone-950/70 pl-2.5 pr-8 py-1.5 text-xs text-stone-200 placeholder-stone-700 transition-all focus:border-accent/40 focus:ring-1 focus:ring-accent/10 focus:bg-stone-950 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecureCookie(!showSecureCookie)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    >
                      {showSecureCookie ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleToggleFamilyView}
                    className="flex w-full items-center justify-between h-7 px-2.5 text-[10px] font-bold text-stone-400 hover:bg-stone-900/20 hover:text-stone-300 cursor-pointer rounded-md transition-colors"
                  >
                    <span>{t("inventoryScanner.familyView")}</span>
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
                        <div className="space-y-3 mt-2 pb-1">
                          <div>
                            <label
                              htmlFor={`parental-input-${account.id}`}
                              className="block text-[9px] font-extrabold tracking-wider text-stone-500 mb-1.5"
                            >
                              <span className="opacity-75">{t("inventoryScanner.steamparentalLabel", "Mã steamparental")}</span>
                            </label>
                            <div className="relative w-full">
                              <input
                                id={`parental-input-${account.id}`}
                                type={showSecureParental ? "text" : "password"}
                                placeholder={t("inventoryScanner.enterParentalPlaceholder")}
                                value={
                                  parentalInputs[account.id] ?? parsedParental
                                }
                                onChange={(e) =>
                                  setParentalInputs((prev) => ({
                                    ...prev,
                                    [account.id]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-stone-800/80 bg-stone-950/70 pl-2.5 pr-8 py-1.5 text-xs text-stone-200 placeholder-stone-700 transition-all focus:border-accent/40 focus:ring-1 focus:ring-accent/10 focus:bg-stone-950 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowSecureParental(!showSecureParental)
                                }
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                              >
                                {showSecureParental ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor={`session-input-${account.id}`}
                              className="block text-[9px] font-extrabold tracking-wider text-stone-500 mb-1.5"
                            >
                              <span className="opacity-75">{t("inventoryScanner.sessionidLabel", "Mã sessionid")}</span>
                            </label>
                            <div className="relative w-full">
                              <input
                                id={`session-input-${account.id}`}
                                type={
                                  showSecureSessionId ? "text" : "password"
                                }
                                placeholder={t("inventoryScanner.enterSessionPlaceholder")}
                                value={
                                  sessionIdInputs[account.id] ?? parsedSessionId
                                }
                                onChange={(e) =>
                                  setSessionIdInputs((prev) => ({
                                    ...prev,
                                    [account.id]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-stone-800/80 bg-stone-950/70 pl-2.5 pr-8 py-1.5 text-xs text-stone-200 placeholder-stone-700 transition-all focus:border-accent/40 focus:ring-1 focus:ring-accent/10 focus:bg-stone-950 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowSecureSessionId(!showSecureSessionId)
                                }
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                              >
                                {showSecureSessionId ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-3 flex items-center justify-end gap-2 pt-2.5 border-t border-stone-850/20">
                {isSavedCookieCheckable && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      cookieStatuses[account.id]?.status === "loading" ||
                      checkCooldowns[account.id] > 0
                    }
                    onClick={() => handleCheckCookie(account.id)}
                    className="flex h-7 min-w-[64px] cursor-pointer items-center justify-center rounded px-2.5 py-1 text-[10px] font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-900/30 disabled:opacity-50"
                    title={t("inventoryScanner.checkCookieTooltip")}
                  >
                    {cookieStatuses[account.id]?.status === "loading" ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                    ) : checkCooldowns[account.id] > 0 ? (
                      <span>{checkCooldowns[account.id]}s</span>
                    ) : (
                      <span>{t("inventoryScanner.check")}</span>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateCookieMutation.isPending}
                  onClick={() => {
                    const sLogin =
                      cookieInputs[account.id] ?? parsedLoginSecure;
                    const sParental = isFamilyViewEnabled
                      ? parentalInputs[account.id] ?? parsedParental
                      : "";
                    const sSessionId = isFamilyViewEnabled
                      ? sessionIdInputs[account.id] ?? parsedSessionId
                      : "";
                    const combined = buildSteamCookie(
                      sLogin,
                      sSessionId,
                      sParental
                    );
                    updateCookieMutation.mutate({
                      id: account.id,
                      steamCookie: combined,
                    });
                  }}
                  className="h-7 cursor-pointer px-4 text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/30 transition-all rounded disabled:opacity-50"
                >
                  {updateCookieMutation.isPending
                    ? t("common.saving")
                    : t("common.save")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
