"use client";

import { useAccountCRUD } from "./hooks/use-account-crud";
import { useAccountCookie } from "./hooks/use-account-cookie";
import { useAccountSync } from "./hooks/use-account-sync";

export function useSteamAccounts({
  reportQuery,
  setError,
}: {
  reportQuery: { refetch: () => Promise<unknown>; data?: unknown };
  setError: (err: string | null) => void;
}) {
  const {
    accountsQuery,
    addAccountMutation,
    deleteAccountMutation,
    showCookieGuide,
    setShowCookieGuide,
    accountToDelete,
    setAccountToDelete,
  } = useAccountCRUD({ reportQuery });

  const {
    showCookies,
    setShowCookies,
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
    updateCookieMutation,
    getUnsavedCookie,
  } = useAccountCookie({ accountsQuery });

  const {
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
  } = useAccountSync({
    accountsQuery,
    getUnsavedCookie,
    updateCookieMutation,
    reportQuery,
    setError,
  });

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
    syncExtraItems,
    setSyncExtraItems,
    syncStorageUnits,
    setSyncStorageUnits,
    accountToDelete,
    setAccountToDelete,
  };
}
