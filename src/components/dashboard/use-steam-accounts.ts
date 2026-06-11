import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSyncStore, syncStore } from "@/utils/sync-store";
import { toast, toastStore } from "@/utils/toast-store";
import { useTranslation } from "react-i18next";
import { MissingItem, SyncStorageUnit } from "./missing-items-dialog";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Có lỗi xảy ra.";
}

export function useSteamAccounts({
  reportQuery,
  setError,
}: {
  reportQuery: any;
  setError: (err: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  type SyncAccountProgress = {
    accountName: string;
    steamId64: string;
    avatarUrl: string | null;
    status: "scanning" | "done" | "error";
    message: string;
    percent: number;
    scanProgress?: {
      stage: string;
      message: string;
      percent: number;
      detail?: Record<string, number | string>;
    };
  };

  const {
    isSyncing,
    syncOverallPercent,
    syncOverallMessage,
    syncAccountProgresses,
    singleScanId,
  } = useSyncStore();
  const syncAbortRef = useRef<AbortController | null>(null);
  const singleScanAbortRef = useRef<AbortController | null>(null);

  const [showCookies, setShowCookies] = useState<Record<string, boolean>>({});
  const [showCookieGuide, setShowCookieGuide] = useState(false);
  const [cookieInputs, setCookieInputs] = useState<Record<string, string>>({});
  const [parentalInputs, setParentalInputs] = useState<Record<string, string>>(
    {},
  );
  const [sessionIdInputs, setSessionIdInputs] = useState<
    Record<string, string>
  >({});

  const [cookieStatuses, setCookieStatuses] = useState<
    Record<
      string,
      {
        status: "idle" | "loading" | "live" | "expired" | "error";
        message?: string;
      }
    >
  >({});
  const [checkCooldowns, setCheckCooldowns] = useState<Record<string, number>>(
    {},
  );
  const checkCooldownsRef = useRef(checkCooldowns);

  // Missing items from sync
  const [missingItemsDialogOpen, setMissingItemsDialogOpen] = useState(false);
  const [syncMissingItems, setSyncMissingItems] = useState<MissingItem[]>([]);
  const [syncStorageUnits, setSyncStorageUnits] = useState<SyncStorageUnit[]>(
    [],
  );
  const [accountToDelete, setAccountToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    checkCooldownsRef.current = checkCooldowns;
  }, [checkCooldowns]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCheckCooldowns((prev) => {
        const next = { ...prev };
        let updated = false;
        for (const key of Object.keys(next)) {
          if (next[key] > 0) {
            next[key] -= 1;
            updated = true;
          } else {
            delete next[key];
            updated = true;
          }
        }
        return updated ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const accountsQuery = useQuery({
    queryKey: ["portfolio-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/accounts");
      if (!res.ok) throw new Error(t("dashboard.cannotLoadAccounts"));
      return res.json() as Promise<
        Array<{
          id: string;
          steamId64: string;
          steamUrl: string;
          name: string;
          avatarUrl: string | null;
          steamCookie?: string | null;
          cookieError?: string | null;
        }>
      >;
    },
  });

  // Silent periodic background sync every 1 hour
  const hasAccounts = (accountsQuery.data?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasAccounts) return;

    const interval = setInterval(() => {
      fetch("/api/portfolio/accounts/sync?bypassCooldown=true", {
        method: "POST",
      })
        .then(() => {
          accountsQuery.refetch();
          reportQuery.refetch();
        })
        .catch((err) => console.error("Silent background sync failed:", err));
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [hasAccounts, accountsQuery, reportQuery]);

  const handleCheckCookie = useCallback(
    async (accountId: string) => {
      if (checkCooldownsRef.current[accountId] > 0) return;

      setCookieStatuses((prev) => ({
        ...prev,
        [accountId]: { status: "loading" },
      }));

      try {
        const res = await fetch("/api/portfolio/accounts/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });

        const data = await res.json();
        if (res.ok && data.isValid) {
          setCookieStatuses((prev) => ({
            ...prev,
            [accountId]: { status: "live" },
          }));
          accountsQuery.refetch();
          toast.success("Cookie hoạt động tốt!");
        } else if (data.isExpired) {
          setCookieStatuses((prev) => ({
            ...prev,
            [accountId]: {
              status: "expired",
              message: data.message || "Cookie hết hạn",
            },
          }));
          accountsQuery.refetch();
          toast.error("Cookie đã hết hạn!");
        } else {
          setCookieStatuses((prev) => ({
            ...prev,
            [accountId]: {
              status: "error",
              message: data.message || "Lỗi kiểm tra",
            },
          }));
          accountsQuery.refetch();
          toast.error(data.message || "Lỗi kiểm tra cookie.");
        }
      } catch {
        setCookieStatuses((prev) => ({
          ...prev,
          [accountId]: { status: "error", message: "Lỗi kết nối mạng" },
        }));
        accountsQuery.refetch();
        toast.error("Không thể kết nối đến máy chủ.");
      } finally {
        setCheckCooldowns((prev) => ({ ...prev, [accountId]: 15 }));
      }
    },
    [accountsQuery],
  );

  // Find first available steam cookie for trade sync
  const activeSteamCookie = useMemo(() => {
    if (!accountsQuery.data) return null;
    for (const acc of accountsQuery.data) {
      if (acc.steamCookie?.trim()) return acc.steamCookie;
    }
    return null;
  }, [accountsQuery.data]);

  const updateCookieMutation = useMutation({
    mutationFn: async ({
      id,
      steamCookie,
    }: {
      id: string;
      steamCookie: string;
    }) => {
      const res = await fetch("/api/portfolio/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, steamCookie }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? t("dashboard.cannotUpdateCookie"));
      return data;
    },
    onSuccess: (data, variables) => {
      const accountId = variables.id;
      setCookieInputs((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      setParentalInputs((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      setSessionIdInputs((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      accountsQuery.refetch();
      toast.success(t("dashboard.cookieSaved"));
    },
    onError: (err) => {
      toast.error(t("dashboard.cookieError"), {
        description: getErrorMessage(err),
      });
    },
  });

  const getUnsavedCookie = useCallback(
    (account: { id: string; steamCookie?: string | null }) => {
      const getVal = (raw: string, key: string) => {
        if (raw.includes(";")) {
          const match = raw.split(";").find((p) =>
            p
              .trim()
              .toLowerCase()
              .startsWith(key + "="),
          );
          return match ? match.split("=").slice(1).join("=").trim() : "";
        }
        if (key === "steamloginsecure") {
          return raw.toLowerCase().startsWith("steamloginsecure=")
            ? raw.substring(17).trim()
            : raw.trim();
        }
        return "";
      };

      const parsedLoginSecure = account.steamCookie
        ? getVal(account.steamCookie, "steamloginsecure")
        : "";
      const parsedParental = account.steamCookie
        ? getVal(account.steamCookie, "steamparental")
        : "";
      const parsedSessionId = account.steamCookie
        ? getVal(account.steamCookie, "sessionid")
        : "";

      const hasUnsavedCookieChange =
        cookieInputs[account.id] !== undefined &&
        cookieInputs[account.id] !== parsedLoginSecure;
      const hasUnsavedParentalChange =
        parentalInputs[account.id] !== undefined &&
        parentalInputs[account.id] !== parsedParental;
      const hasUnsavedSessionIdChange =
        sessionIdInputs[account.id] !== undefined &&
        sessionIdInputs[account.id] !== parsedSessionId;

      if (
        !hasUnsavedCookieChange &&
        !hasUnsavedParentalChange &&
        !hasUnsavedSessionIdChange
      ) {
        return null;
      }

      const sLogin = cookieInputs[account.id] ?? parsedLoginSecure;
      const sParental = parentalInputs[account.id] ?? parsedParental;
      const sSessionId = sessionIdInputs[account.id] ?? parsedSessionId;
      const combined =
        `steamLoginSecure=${sLogin}` +
        (sParental ? `; steamparental=${sParental}` : "") +
        (sSessionId ? `; sessionid=${sSessionId}` : "");
      return combined;
    },
    [cookieInputs, parentalInputs, sessionIdInputs],
  );

  const addAccountMutation = useMutation({
    mutationFn: async (payload: { steamUrl: string; steamCookie?: string }) => {
      const res = await fetch("/api/portfolio/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? t("dashboard.cannotAddAccount"));
      return data;
    },
    onSuccess: () => {
      accountsQuery.refetch();
      toast.success(t("dashboard.accountLinked"));
    },
    onError: (err) => {
      toast.error(t("dashboard.accountLinkError"), {
        description: getErrorMessage(err),
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/portfolio/accounts?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? t("dashboard.cannotDeleteAccount"));
      return data;
    },
    onSuccess: () => {
      accountsQuery.refetch();
      reportQuery.refetch();
      toast.success(t("dashboard.accountUnlinked"));
    },
    onError: (err) => {
      toast.error(t("dashboard.accountUnlinkError"), {
        description: getErrorMessage(err),
      });
    },
  });

  function handleSingleSyncEvent(
    event: {
      type: string;
      accountName?: string;
      steamId64?: string;
      avatarUrl?: string | null;
      message: string;
      percent: number;
      scanProgress?: {
        stage: string;
        message: string;
        percent: number;
        detail?: Record<string, number | string>;
      };
      summary?: {
        scannedAccountsCount: number;
        totalAccountsCount: number;
        importedCount: number;
      };
    },
    scanToastId: string | null,
    accountName: string,
  ) {
    syncStore.setState((prev) => {
      const nextMap = new Map(prev.syncAccountProgresses);
      if (
        event.steamId64 &&
        (event.type === "account_start" ||
          event.type === "account_progress" ||
          event.type === "account_done" ||
          event.type === "account_error")
      ) {
        nextMap.set(event.steamId64!, {
          accountName: event.accountName ?? "Unknown",
          steamId64: event.steamId64!,
          avatarUrl: event.avatarUrl ?? null,
          status:
            event.type === "account_done"
              ? "done"
              : event.type === "account_error"
                ? "error"
                : "scanning",
          message: event.message,
          percent:
            event.scanProgress?.percent ??
            (event.type === "account_done" ? 100 : 0),
          scanProgress: event.scanProgress,
        });
      }
      return {
        syncOverallPercent: event.percent,
        syncOverallMessage: event.message,
        syncAccountProgresses: nextMap,
      };
    });

    if (event.type === "complete" && event.summary) {
      reportQuery.refetch();
      if (scanToastId) {
        toastStore.update(scanToastId, {
          type: "success",
          title: t("dashboard.scanSingleComplete", { name: accountName }),
          description: t("dashboard.scanSingleCompleteDesc", {
            imported: event.summary.importedCount,
          }),
          duration: 5000,
        });
      }
    }

    if (event.type === "error") {
      setError(event.message);
      if (scanToastId) {
        toastStore.update(scanToastId, {
          type: "error",
          title: t("dashboard.scanSingleError"),
          description: event.message,
          duration: 5000,
        });
      }
    }
  }

  function handleSyncEvent(
    event: {
      type: string;
      accountName?: string;
      steamId64?: string;
      avatarUrl?: string | null;
      message: string;
      percent: number;
      scanProgress?: {
        stage: string;
        message: string;
        percent: number;
        detail?: Record<string, number | string>;
      };
      summary?: {
        scannedAccountsCount: number;
        totalAccountsCount: number;
        importedCount: number;
        skippedAccounts: string[];
        missingItems?: MissingItem[];
        storageUnits?: SyncStorageUnit[];
      };
    },
    syncToastId: string | null,
  ) {
    syncStore.setState((prev) => {
      const nextMap = new Map(prev.syncAccountProgresses);
      if (
        event.steamId64 &&
        (event.type === "account_start" ||
          event.type === "account_progress" ||
          event.type === "account_done" ||
          event.type === "account_error")
      ) {
        nextMap.set(event.steamId64!, {
          accountName: event.accountName ?? "Unknown",
          steamId64: event.steamId64!,
          avatarUrl: event.avatarUrl ?? null,
          status:
            event.type === "account_done"
              ? "done"
              : event.type === "account_error"
                ? "error"
                : "scanning",
          message: event.message,
          percent:
            event.scanProgress?.percent ??
            (event.type === "account_done" ? 100 : 0),
          scanProgress: event.scanProgress,
        });
      }
      return {
        syncOverallPercent: event.percent,
        syncOverallMessage: event.message,
        syncAccountProgresses: nextMap,
      };
    });

    if (event.type === "complete" && event.summary) {
      reportQuery.refetch();
      if (syncToastId) {
        toastStore.update(syncToastId, {
          type: "success",
          title: t("dashboard.syncComplete"),
          description: t("dashboard.syncCompleteDesc", {
            scanned: event.summary.scannedAccountsCount,
            total: event.summary.totalAccountsCount,
            imported: event.summary.importedCount,
          }),
          duration: 5000,
        });
      }

      // Show missing items dialog if any
      if (event.summary.missingItems && event.summary.missingItems.length > 0) {
        setSyncMissingItems(event.summary.missingItems);
        setSyncStorageUnits(event.summary.storageUnits ?? []);
        setMissingItemsDialogOpen(true);
      }
    }

    if (event.type === "error") {
      setError(event.message);
      if (syncToastId) {
        toastStore.update(syncToastId, {
          type: "error",
          title: t("dashboard.syncError"),
          description: event.message,
          duration: 5000,
        });
      }
    }
  }

  const startSync = useCallback(async () => {
    if (isSyncing) return;
    syncStore.setState({
      isSyncing: true,
      syncOverallPercent: 0,
      syncOverallMessage: t("dashboard.syncStarting"),
      syncAccountProgresses: new Map(),
    });
    setError(null);

    const abortController = new AbortController();
    syncAbortRef.current = abortController;
    const syncToastId: string | null = toast.loading(
      t("dashboard.syncingAccounts"),
    );

    try {
      // Save any unsaved cookies first
      if (accountsQuery.data) {
        for (const account of accountsQuery.data) {
          const unsavedCookie = getUnsavedCookie(account);
          if (unsavedCookie !== null) {
            try {
              await updateCookieMutation.mutateAsync({
                id: account.id,
                steamCookie: unsavedCookie,
              });
            } catch {
              // Ignore individual account save failures and continue
            }
          }
        }
      }

      const res = await fetch("/api/portfolio/accounts/sync", {
        method: "POST",
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { message?: string }).message ??
            t("dashboard.syncFailed"),
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error(t("dashboard.cannotReadStream"));

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            // eslint-disable-next-line react-hooks/immutability
            handleSyncEvent(event, syncToastId);
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith("data: ")) {
        try {
          const event = JSON.parse(buffer.slice(6));
          handleSyncEvent(event, syncToastId);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg =
          err instanceof Error ? err.message : t("dashboard.syncFailed");
        setError(msg);
        if (syncToastId)
          toastStore.update(syncToastId, {
            type: "error",
            title: t("dashboard.syncError"),
            description: msg,
            duration: 5000,
          });
      } else {
        if (syncToastId) toastStore.dismiss(syncToastId);
      }
    } finally {
      syncStore.setState({ isSyncing: false });
      syncAbortRef.current = null;
      accountsQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, accountsQuery.data, getUnsavedCookie, updateCookieMutation]);

  const startSingleSync = useCallback(
    async (accountId: string, accountName: string) => {
      if (isSyncing || singleScanId) return;
      syncStore.setState({
        singleScanId: accountId,
        syncOverallPercent: 0,
        syncOverallMessage: t("dashboard.scanSingleStarting", {
          name: accountName,
        }),
        syncAccountProgresses: new Map(),
      });
      setError(null);

      const abortController = new AbortController();
      singleScanAbortRef.current = abortController;
      const scanToastId: string | null = toast.loading(
        t("dashboard.scanSingleStarting", { name: accountName }),
      );

      try {
        // Save any unsaved cookie for this account first
        const account = accountsQuery.data?.find((a) => a.id === accountId);
        if (account) {
          const unsavedCookie = getUnsavedCookie(account);
          if (unsavedCookie !== null) {
            await updateCookieMutation.mutateAsync({
              id: accountId,
              steamCookie: unsavedCookie,
            });
          }
        }

        const res = await fetch("/api/portfolio/accounts/sync/single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            (errData as { message?: string }).message ??
              t("dashboard.syncFailed"),
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error(t("dashboard.cannotReadStream"));

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              handleSingleSyncEvent(event, scanToastId, accountName);
            } catch {
              /* ignore parse errors */
            }
          }
        }

        if (buffer.startsWith("data: ")) {
          try {
            const event = JSON.parse(buffer.slice(6));
            handleSingleSyncEvent(event, scanToastId, accountName);
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const msg =
            err instanceof Error ? err.message : t("dashboard.syncFailed");
          setError(msg);
          if (scanToastId)
            toastStore.update(scanToastId, {
              type: "error",
              title: t("dashboard.scanSingleError"),
              description: msg,
              duration: 5000,
            });
        } else {
          if (scanToastId) toastStore.dismiss(scanToastId);
        }
      } finally {
        syncStore.setState({ singleScanId: null });
        singleScanAbortRef.current = null;
        accountsQuery.refetch();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      isSyncing,
      singleScanId,
      accountsQuery.data,
      getUnsavedCookie,
      updateCookieMutation,
    ],
  );

  const report = reportQuery.data ?? null;
  return {
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
    setCookieStatuses,
    checkCooldowns,
    setCheckCooldowns,
    handleCheckCookie,
    getUnsavedCookie,
    missingItemsDialogOpen,
    setMissingItemsDialogOpen,
    syncMissingItems,
    setSyncMissingItems,
    syncStorageUnits,
    setSyncStorageUnits,
    accountToDelete,
    setAccountToDelete,
  };
}
