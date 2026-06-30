"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Key,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  Info,
  ExternalLink,
  Award,
  Zap,
  Lock,
  Trash2,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, toastStore } from "@/stores";
import { cn } from "@/utils/cn";
import { useSession } from "./use-session";
import {
  getLocalApiKey,
  saveLocalApiKey,
  removeLocalApiKey,
} from "@/components/inventory-scanner/utils";

import { formatDateVi } from "@/utils/date";

interface TierInfo {
  code: string;
  display_name: string;
  quota_requests_per_month: number;
  rate_requests_per_minute: number;
}

interface UsageInfo {
  requests_this_month: number;
  requests_limit: number;
  requests_remaining: number;
  percentage_used: number;
  reset_date: string;
}

interface AccountData {
  user_id: string;
  email: string;
  display_name: string;
  tier_info: TierInfo;
  usage: UsageInfo;
}

interface CS2CapKey {
  prefix: string;
  isActive: boolean;
}

interface CS2CapData {
  hasCustomKey: boolean;
  keyPrefix: string | null;
  keys: CS2CapKey[];
  account: AccountData | null;
}

interface CS2CapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "member" | "guest" | "auto";
}

export function CS2CapModal({
  open,
  onOpenChange,
  mode = "auto",
}: CS2CapModalProps) {
  const { t, i18n } = useTranslation();
  const { user, loading: sessionLoading } = useSession();

  // Logged-in Data State
  const [data, setData] = useState<CS2CapData | null>(null);

  // Guest Data State
  const [guestKeyPrefix, setGuestKeyPrefix] = useState<string | null>(null);
  const [guestAccount, setGuestAccount] = useState<AccountData | null>(null);
  const [hasDefaultKey, setHasDefaultKey] = useState<boolean | null>(null);
  const [defaultAccount, setDefaultAccount] = useState<AccountData | null>(null);

  // Form & Loader States
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete Confirmation Dialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  // Compute mode
  const isMember = mode === "member" || (mode === "auto" && !!user);

  // Fetch for Guest Mode
  const fetchGuestAccountData = useCallback(
    async (key: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/user/cs2cap/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey: key }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.message ? t(`cs2cap.errors.${json.message}`, t("cs2cap.failedToGetAccountInfo", "Failed to get account info from CS2Cap.")) : t("cs2cap.failedToGetAccountInfo", "Failed to get account info from CS2Cap."),
          );
        }
        setGuestAccount(json.account);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : t("cs2cap.connectionOrKeyError", "Connection error or API Key is inactive.");
        setError(msg ? t(`cs2cap.errors.${msg}`, msg) : msg);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [],
  );

  // Fetch for Logged-in Mode
  const fetchInfo = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/user/cs2cap");
        if (!res.ok) {
          throw new Error(t("cs2cap.failedToLoadInfo", "Failed to load info"));
        }
        const json = await res.json();
        setData(json);
        setApiKey("");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg ? t(`cs2cap.errors.${msg}`, msg) : t("cs2cap.failedToLoadInfo", "Failed to load info"));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [t],
  );

  // Load appropriate data on mount / open
  useEffect(() => {
    if (!open || (mode === "auto" && sessionLoading)) return;

    if (isMember) {
      fetchInfo();
    } else {
      // Check if server has a default key + fetch its account data
      fetch("/api/user/cs2cap/status")
        .then((r) => r.json())
        .then((d) => {
          setHasDefaultKey(Boolean(d?.hasDefaultKey));
          setDefaultAccount(d?.account ?? null);
        })
        .catch(() => {
          setHasDefaultKey(false);
          setDefaultAccount(null);
        });

      const saved = getLocalApiKey();
      if (saved) {
        setGuestKeyPrefix(saved.slice(0, 12) + "•".repeat(24));
        fetchGuestAccountData(saved);
      } else {
        setGuestKeyPrefix(null);
        setGuestAccount(null);
        setLoading(false);
      }
      setApiKey("");
    }
  }, [
    open,
    isMember,
    sessionLoading,
    mode,
    fetchInfo,
    fetchGuestAccountData,
  ]);

  // Handle Save (Add new key)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setSaving(true);
    const toastId = toast.loading(t("common.saving", "Saving..."));
    try {
      if (isMember) {
        const res = await fetch("/api/user/cs2cap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.message ? t(`cs2cap.errors.${json.message}`, t("cs2cap.invalidKey", "Invalid API Key")) : t("cs2cap.invalidKey", "Invalid API Key"),
          );
        }

        toastStore.update(toastId, {
          type: "success",
          title: t("cs2cap.saveSuccess", "Saved API Key successfully!"),
          duration: 3000,
        });

        setData({
          hasCustomKey: json.hasCustomKey,
          keyPrefix: json.keyPrefix,
          keys: json.keys,
          account: json.account,
        });
        setApiKey("");
      } else {
        const res = await fetch("/api/user/cs2cap/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.message ? t(`cs2cap.errors.${json.message}`, t("cs2cap.invalidKeyCheck", "Invalid API Key. Please verify it.")) : t("cs2cap.invalidKeyCheck", "Invalid API Key. Please verify it."),
          );
        }

        saveLocalApiKey(apiKey.trim());
        setGuestKeyPrefix(apiKey.trim().slice(0, 12) + "•".repeat(24));
        setGuestAccount(json.account);
        setApiKey("");

        toastStore.update(toastId, {
          type: "success",
          title: t("cs2cap.configureSuccess", "Configured API Key successfully!"),
          description:
            t("cs2cap.keyEncryptedLocal", "Your key has been encrypted and stored on this browser."),
          duration: 4000,
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t("cs2cap.invalidKey", "Invalid API Key");
      toastStore.update(toastId, {
        type: "error",
        title: t("cs2cap.invalidKey", "Invalid API Key"),
        description: msg ? t(`cs2cap.errors.${msg}`, msg) : msg,
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Switch Active Key (Logged-in only)
  const handleSelect = async (keyPrefix: string) => {
    setSaving(true);
    const toastId = toast.loading(t("cs2cap.switchingKey", "Switching active API key..."));
    try {
      const res = await fetch("/api/user/cs2cap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "select", keyPrefix }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message);
      }

      toastStore.update(toastId, {
        type: "success",
        title: t("cs2cap.switchedKeySuccess", "Switched active API Key."),
        duration: 3000,
      });

      setData({
        hasCustomKey: json.hasCustomKey,
        keyPrefix: json.keyPrefix,
        keys: json.keys,
        account: json.account,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("cs2cap.switchKeyError", "Failed to switch active API Key");
      toastStore.update(toastId, {
        type: "error",
        title: t("cs2cap.switchKeyError", "Failed to switch active API Key"),
        description: msg ? t(`cs2cap.errors.${msg}`, msg) : msg,
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Open confirmation modal for deleting key
  const confirmDelete = (keyPrefix?: string) => {
    if (isMember) {
      if (keyPrefix) {
        setKeyToDelete(keyPrefix);
        setConfirmOpen(true);
      }
    } else {
      setConfirmOpen(true);
    }
  };

  // Handle Delete Confirmed
  const handleDeleteConfirm = async () => {
    setConfirmOpen(false);
    if (isMember) {
      if (!keyToDelete) return;
      setSaving(true);
      const toastId = toast.loading(t("cs2cap.deletingKey", "Deleting..."));
      try {
        const res = await fetch("/api/user/cs2cap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "delete", keyPrefix: keyToDelete }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message);
        }

        toastStore.update(toastId, {
          type: "success",
          title: t("cs2cap.deleteKeySuccess", "Deleted API Key successfully."),
          duration: 3000,
        });

        setData({
          hasCustomKey: json.hasCustomKey,
          keyPrefix: json.keyPrefix,
          keys: json.keys,
          account: json.account,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("cs2cap.deleteKeyError", "Failed to delete API Key");
        toastStore.update(toastId, {
          type: "error",
          title: t("cs2cap.deleteKeyError", "Failed to delete API Key"),
          description: msg ? t(`cs2cap.errors.${msg}`, msg) : msg,
          duration: 4000,
        });
      } finally {
        setSaving(false);
        setKeyToDelete(null);
      }
    } else {
      removeLocalApiKey();
      setGuestKeyPrefix(null);
      setGuestAccount(null);
      toast.success(t("cs2cap.deleteLocalKeySuccess", "Deleted custom API Key."));
    }
  };

  const account = isMember ? data?.account : guestAccount;
  const usage = account?.usage;
  const tier = account?.tier_info;

  // For guest using default system key (no local key)
  const defaultUsage = !isMember && !guestKeyPrefix ? defaultAccount?.usage : null;
  const defaultTier = !isMember && !guestKeyPrefix ? defaultAccount?.tier_info : null;

  // Format Date Helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return formatDateVi(dateStr);
  };

  // Format Number Helper
  const formatNumber = (num: number) => {
    return num.toLocaleString(i18n.language === "vi" ? "vi-VN" : "en-US");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <Shield className="size-5.5 text-accent" />
              {isMember
                ? t("cs2cap.modalTitle", "Configure API Key (Member)")
                : t("cs2cap.modalTitleGuest", "Configure API Key (Guest)")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {isMember
                ? t(
                    "cs2cap.modalDesc",
                    "Configure your API Key to use CS2Cap services.",
                  )
                : t("cs2cap.modalDescGuest", "Since you are not logged in, this key will be encrypted and stored locally on your browser to fetch direct prices from BUFF163.")}
            </DialogDescription>
          </DialogHeader>

          {sessionLoading || loading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-accent" />
              <span className="text-sm text-stone-400">
                {t("common.loading", "Loading...")}
              </span>
            </div>
          ) : error ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 px-4 text-center">
              <AlertCircle className="size-10 text-danger" />
              <p className="text-sm font-semibold text-stone-300">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isMember
                    ? fetchInfo(true)
                    : guestKeyPrefix &&
                      fetchGuestAccountData(guestKeyPrefix, true)
                }
                className="mt-2 border-stone-850 bg-stone-900/40 cursor-pointer"
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Info/Warning notice for Guest */}
              {!isMember && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3.5 py-3 transition hover:bg-amber-500/8">
                  <Info className="size-4.5 shrink-0 mt-0.5 animate-pulse text-amber-600 dark:text-amber-500" />
                  <p className="text-[11px] leading-relaxed font-semibold text-amber-800 dark:text-amber-400/90">
                    {t("cs2cap.guestLocalNotice", "Locally saved API key only works on the current browser. Sign in with Google to sync keys across all devices.")}
                  </p>
                </div>
              )}

              {/* Info notice for Member */}
              {isMember && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3.5 py-3 transition hover:bg-amber-500/8">
                  <Info className="size-4.5 shrink-0 mt-0.5 animate-pulse text-amber-600 dark:text-amber-500" />
                  <p className="text-[11px] leading-relaxed font-semibold text-amber-800 dark:text-amber-400/90">
                    {data?.hasCustomKey
                      ? t(
                          "cs2cap.customKeyActive",
                          "The system is using your personal API Key to update prices.",
                        )
                      : t(
                          "cs2cap.sharedKeyWarning",
                          "You are using the shared default system key. Quota limit may apply.",
                        )}
                  </p>
                </div>
              )}

              {/* Default System Key badge for Guest (no local key, but server has default) */}
              {!isMember && !guestKeyPrefix && hasDefaultKey && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Lock className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-stone-500">
                        {t("cs2cap.defaultSystemKey", "System default key")}
                        {defaultTier && (
                          <span className="ml-1.5 rounded bg-stone-800 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-stone-300">
                            {defaultTier.display_name}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 font-mono text-xs font-black tracking-wide text-emerald-600 dark:text-emerald-400">
                        {t("cs2cap.defaultSystemKeyActive", "Active — shared quota")}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {t("cs2cap.statusActive", "Active")}
                  </span>
                </div>
              )}

              {/* 1. Plan Overview Cards */}
              {((isMember && data) || (!isMember && guestKeyPrefix) || (!isMember && !guestKeyPrefix && defaultTier)) && (
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex items-center gap-3 rounded-xl border border-stone-800/80 bg-stone-950/45 p-3.5 shadow-sm transition hover:border-stone-700/60">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                      <Award className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-mono text-[10px] font-bold uppercase leading-none tracking-wider text-stone-500">
                        {t("cs2cap.currentPlan", "Current plan")}
                      </span>
                      <span className="mt-1 block font-sans text-sm font-black uppercase leading-none tracking-wide text-foreground truncate">
                        {(tier ?? defaultTier)?.display_name || "FREE"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-stone-800/80 bg-stone-950/45 p-3.5 shadow-sm transition hover:border-stone-700/60">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
                      <Zap className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-mono text-[10px] font-bold uppercase leading-none tracking-wider text-stone-500">
                        {t("cs2cap.requestsPerMin", "Reqs/min")}
                      </span>
                      <span className="mt-1 block font-sans text-sm font-black leading-none tracking-wide text-foreground truncate">
                        {(tier ?? defaultTier)?.rate_requests_per_minute || 20} {t("cs2cap.reqMinSuffix", "req/m")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Usage Stats — personal key (member or guest with local key) */}
              {usage && (
                <div className="rounded-xl border border-stone-800/80 bg-stone-950/20 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-stone-400">
                      <TrendingUp className="size-4 text-accent" />
                      {t("cs2cap.reqUsed", "Used")}:{" "}
                      {formatNumber(usage.requests_this_month)} /{" "}
                      {formatNumber(usage.requests_limit)} {t("cs2cap.reqSuffix", "req")}
                    </span>
                    <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-black text-accent">
                      {usage.percentage_used.toFixed(1)}%
                    </span>
                  </div>

                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-stone-950 border border-stone-850/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                      style={{
                        width: `${Math.min(usage.percentage_used, 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-0.5 text-[11px] text-stone-500">
                    <span className="font-medium">
                      {t("cs2cap.reqRemaining", "Remaining")}:{" "}
                      {formatNumber(usage.requests_remaining)}
                    </span>
                    <span className="font-medium">
                      {t("cs2cap.resetDate", "Reset date")}:{" "}
                      {formatDate(usage.reset_date)}
                    </span>
                  </div>
                </div>
              )}

              {/* 2b. Usage Stats — default system key (guest, no local key) */}
              {!isMember && !guestKeyPrefix && defaultUsage && (
                <div className="rounded-xl border border-stone-800/80 bg-stone-950/20 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-stone-400">
                      <TrendingUp className="size-4 text-accent" />
                      {t("cs2cap.reqUsed", "Used")}:{" "}
                      {formatNumber(defaultUsage.requests_this_month)} /{" "}
                      {formatNumber(defaultUsage.requests_limit)} {t("cs2cap.reqSuffix", "req")}
                    </span>
                    <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-black text-accent">
                      {defaultUsage.percentage_used.toFixed(1)}%
                    </span>
                  </div>

                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-stone-950 border border-stone-850/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                      style={{
                        width: `${Math.min(defaultUsage.percentage_used, 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-0.5 text-[11px] text-stone-500">
                    <span className="font-medium">
                      {t("cs2cap.reqRemaining", "Remaining")}:{" "}
                      {formatNumber(defaultUsage.requests_remaining)}
                    </span>
                    <span className="font-medium">
                      {t("cs2cap.resetDate", "Reset date")}:{" "}
                      {formatDate(defaultUsage.reset_date)}
                    </span>
                  </div>
                </div>
              )}

              {/* 3. API Key List and Input Form */}
              <div className="space-y-3.5 pt-2">
                {/* Active Key Display for Guest */}
                {!isMember && guestKeyPrefix && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Lock className="size-4" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-stone-500">
                          {t("cs2cap.activeGuestKey", "Active guest key")}
                        </span>
                        <span className="mt-0.5 font-mono text-xs font-black tracking-wide text-emerald-600 dark:text-emerald-400 truncate">
                          {guestKeyPrefix}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmDelete()}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-bold text-rose-500 transition duration-150 hover:bg-rose-500/10 hover:border-rose-500/30 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t("common.delete", "Delete")}</span>
                    </button>
                  </div>
                )}

                {/* Saved API Keys List for Member */}
                {isMember && data?.keys && data.keys.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-stone-400">
                      {t("cs2cap.myPersonalApiKeys", "Your personal API Keys ({{count}})", { count: data.keys.length })}
                    </span>
                    <div className="custom-scrollbar max-h-48 overflow-y-auto space-y-2 pr-1">
                      {data.keys.map((k) => (
                        <div
                          key={k.prefix}
                          className={cn(
                            "flex items-center justify-between rounded-xl border p-3.5 shadow-sm transition-all duration-250",
                            k.isActive
                              ? "border-emerald-500/25 bg-emerald-500/5"
                              : "border-stone-800 bg-stone-950/20 hover:border-stone-700/60",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                                k.isActive
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : "bg-stone-900 border-stone-850 text-stone-400",
                              )}
                            >
                              <Lock className="size-4" />
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-stone-500">
                                {k.isActive ? t("cs2cap.statusActive", "Active") : t("cs2cap.statusArchive", "Archived")}
                              </span>
                              <span className="mt-0.5 font-mono text-xs font-black tracking-wide text-stone-300 truncate">
                                {k.prefix}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {!k.isActive && (
                              <button
                                type="button"
                                onClick={() => handleSelect(k.prefix)}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/15 text-xs font-bold text-accent transition duration-150 cursor-pointer disabled:opacity-50"
                              >
                                {t("cs2cap.useButton", "Use")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => confirmDelete(k.prefix)}
                              disabled={saving}
                              className="flex size-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-500 transition duration-150 hover:bg-rose-500/15 hover:border-rose-500/30 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new key form */}
                <form onSubmit={handleSave} className="space-y-3 pt-1">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="cs2cap-api-key" className="flex items-center gap-1.5 text-xs font-bold text-stone-400">
                        <Key className="size-3.5 text-accent" />
                        {t("cs2cap.apiKeyLabel", "CS2Cap API Key")}
                      </label>
                      <a
                        href="https://cs2cap.com/account/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 cursor-pointer transition-colors text-xs font-bold text-accent hover:text-accent-hover hover:underline"
                      >
                        {t("cs2cap.createKeyLink", "Get API Key at CS2Cap")}
                        <ExternalLink className="size-3" />
                      </a>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1 flex items-center">
                        <Input
                          id="cs2cap-api-key"
                          type={showKey ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder={
                            t(
                              "cs2cap.apiKeyPlaceholder",
                              "Enter your cs2cap API key (sk_live_...)",
                            )
                          }
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          disabled={saving}
                          className="w-full font-mono text-xs pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 text-stone-500 hover:text-stone-300 transition-colors focus:outline-none cursor-pointer"
                        >
                          {showKey ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={saving || !apiKey.trim()}
                        className="h-10 shrink-0 px-4 text-xs font-semibold cursor-pointer"
                      >
                        {saving ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          t("common.save", "Save")
                        )}
                      </Button>
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed font-normal text-stone-500">
                      {t(
                        "cs2cap.buff163PriceNotice",
                        "Usually you don't need a personal API Key. This is only necessary if you want to fetch prices directly from BUFF163 or need more call quota.",
                      )}
                    </p>
                  </div>
                </form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for deleting Key */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <AlertCircle className="size-5 text-rose-500" />
              {t("cs2cap.confirmDeleteTitle", "Confirm API Key Deletion?")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {t("cs2cap.confirmDeleteDesc", "Are you sure you want to delete this API Key? The system will revert to the default shared key or other key in the list (if any). This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="cursor-pointer"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteConfirm}
              className="font-bold cursor-pointer"
            >
              {t("common.confirmDelete", "Confirm Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
