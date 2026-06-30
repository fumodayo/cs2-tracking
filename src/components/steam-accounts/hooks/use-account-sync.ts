"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSyncStore, syncStore, toast, toastStore } from "@/stores";
import type { MissingItem, SyncStorageUnit, ExtraItem } from "@/components/portfolio";

import type { SteamAccountDto } from "@/lib/api-client/steam-accounts-api";
import { PORTFOLIO_QUERY_KEY } from "@/lib/api-client/portfolio-api";
import { translateSyncMessage } from "@/components/inventory-scanner/utils";

interface UseAccountSyncProps {
  accountsQuery: UseQueryResult<SteamAccountDto[], unknown>;
  getUnsavedCookie: (account: { id: string; steamCookie?: string | null }) => string | null;
  updateCookieMutation: UseMutationResult<{ success: boolean }, Error, { id: string; steamCookie: string }>;
  reportQuery: { refetch: () => Promise<unknown>; data?: unknown };
  setError: (err: string | null) => void;
}

export function useAccountSync({
  accountsQuery,
  getUnsavedCookie,
  updateCookieMutation,
  reportQuery,
  setError,
}: UseAccountSyncProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    isSyncing,
    syncOverallPercent,
    syncOverallMessage,
    syncAccountProgresses,
    singleScanId,
  } = useSyncStore();

  const syncAbortRef = useRef<AbortController | null>(null);
  const singleScanAbortRef = useRef<AbortController | null>(null);

  const [missingItemsDialogOpen, setMissingItemsDialogOpen] = useState(false);
  const [syncMissingItems, setSyncMissingItems] = useState<MissingItem[]>([]);
  const [syncExtraItems, setSyncExtraItems] = useState<ExtraItem[]>([]);
  const [syncStorageUnits, setSyncStorageUnits] = useState<SyncStorageUnit[]>([]);

  const handleSingleSyncEvent = useCallback(
    (
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
          skippedAccounts?: string[];
          missingItems?: MissingItem[];
          extraItems?: ExtraItem[];
          storageUnits?: SyncStorageUnit[];
        };
      },
      scanToastId: string | null,
      accountName: string,
    ) => {
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
            message: translateSyncMessage(event.message, t, event.scanProgress?.detail),
            percent:
              event.scanProgress?.percent ??
              (event.type === "account_done" ? 100 : 0),
            scanProgress: event.scanProgress,
          });
        }
        return {
          syncOverallPercent: event.percent,
          syncOverallMessage: translateSyncMessage(event.message, t, event.scanProgress?.detail),
          syncAccountProgresses: nextMap,
        };
      });

      if (event.type === "complete" && event.summary) {
        void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
        reportQuery.refetch();
        if (scanToastId) {
          toastStore.update(scanToastId, {
            type: "success",
            title: t("dashboard.scanSingleComplete", { name: accountName }),
            description: t("dashboard.scanSingleCompleteDesc", {
              imported: event.summary.importedCount,
            }),
            duration: 5000,
            path: "/portfolio",
          });
        }

        // Show missing/extra items dialog if any
        const anyMissing = event.summary.missingItems && event.summary.missingItems.length > 0;
        const anyExtra = event.summary.extraItems && event.summary.extraItems.length > 0;
        if (anyMissing || anyExtra) {
          setSyncMissingItems(event.summary.missingItems ?? []);
          setSyncExtraItems(event.summary.extraItems ?? []);
          setSyncStorageUnits(event.summary.storageUnits ?? []);
          setMissingItemsDialogOpen(true);
        }
      }

      if (event.type === "error") {
        setError(translateSyncMessage(event.message, t));
        if (scanToastId) {
          toastStore.update(scanToastId, {
            type: "error",
            title: t("dashboard.scanSingleError"),
            description: translateSyncMessage(event.message, t),
            duration: 5000,
            path: "/portfolio",
          });
        }
      }
    },
    [queryClient, reportQuery, t, setError],
  );

  const handleSyncEvent = useCallback(
    (
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
          extraItems?: ExtraItem[];
          storageUnits?: SyncStorageUnit[];
        };
      },
      syncToastId: string | null,
    ) => {
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
            message: translateSyncMessage(event.message, t, event.scanProgress?.detail),
            percent:
              event.scanProgress?.percent ??
              (event.type === "account_done" ? 100 : 0),
            scanProgress: event.scanProgress,
          });
        }
        return {
          syncOverallPercent: event.percent,
          syncOverallMessage: translateSyncMessage(event.message, t, event.scanProgress?.detail),
          syncAccountProgresses: nextMap,
        };
      });

      if (event.type === "complete" && event.summary) {
        void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
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
            path: "/portfolio",
          });
        }

        // Show missing/extra items dialog if any
        const anyMissing = event.summary.missingItems && event.summary.missingItems.length > 0;
        const anyExtra = event.summary.extraItems && event.summary.extraItems.length > 0;
        if (anyMissing || anyExtra) {
          setSyncMissingItems(event.summary.missingItems ?? []);
          setSyncExtraItems(event.summary.extraItems ?? []);
          setSyncStorageUnits(event.summary.storageUnits ?? []);
          setMissingItemsDialogOpen(true);
        }
      }

      if (event.type === "error") {
        setError(translateSyncMessage(event.message, t));
        if (syncToastId) {
          toastStore.update(syncToastId, {
            type: "error",
            title: t("dashboard.syncError"),
            description: translateSyncMessage(event.message, t),
            duration: 5000,
            path: "/portfolio",
          });
        }
      }
    },
    [queryClient, reportQuery, t, setError],
  );

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
      t("dashboard.syncingAccounts"), { path: "/portfolio" }
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
        const rawMsg = (errData as { message?: string }).message;
        throw new Error(
          rawMsg ? translateSyncMessage(rawMsg, t) : t("dashboard.syncFailed"),
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
          err instanceof Error ? translateSyncMessage(err.message, t) : t("dashboard.syncFailed");
        setError(msg);
        if (syncToastId)
          toastStore.update(syncToastId, {
            type: "error",
            title: t("dashboard.syncError"),
            description: msg,
            duration: 5000,
            path: "/portfolio",
          });
      } else {
        if (syncToastId) toastStore.dismiss(syncToastId);
      }
    } finally {
      syncStore.setState({ isSyncing: false });
      syncAbortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["portfolio-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-storage-units"] });
    }
  }, [
    isSyncing,
    accountsQuery,
    getUnsavedCookie,
    updateCookieMutation,
    setError,
    t,
    handleSyncEvent,
    queryClient,
  ]);

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
        t("dashboard.scanSingleStarting", { name: accountName }), { path: "/portfolio" }
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
          const rawMsg = (errData as { message?: string }).message;
          throw new Error(
            rawMsg ? translateSyncMessage(rawMsg, t) : t("dashboard.syncFailed"),
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
            err instanceof Error ? translateSyncMessage(err.message, t) : t("dashboard.syncFailed");
          setError(msg);
          if (scanToastId)
            toastStore.update(scanToastId, {
              type: "error",
              title: t("dashboard.scanSingleError"),
              description: msg,
              duration: 5000,
              path: "/portfolio",
            });
        } else {
          if (scanToastId) toastStore.dismiss(scanToastId);
        }
      } finally {
        syncStore.setState({ singleScanId: null });
        singleScanAbortRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["portfolio-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-storage-units"] });
      }
    },
    [
      isSyncing,
      singleScanId,
      accountsQuery,
      getUnsavedCookie,
      updateCookieMutation,
      t,
      setError,
      handleSingleSyncEvent,
      queryClient,
    ],
  );

  return {
    isSyncing,
    syncOverallPercent,
    syncOverallMessage,
    syncAccountProgresses,
    singleScanId,
    startSync,
    startSingleSync,
    missingItemsDialogOpen,
    setMissingItemsDialogOpen,
    syncMissingItems,
    setSyncMissingItems,
    syncExtraItems,
    setSyncExtraItems,
    syncStorageUnits,
    setSyncStorageUnits,
  };
}
