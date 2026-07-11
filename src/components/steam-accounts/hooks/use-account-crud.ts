'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores';
import { getErrorMessage } from '@/utils/error';
import { PORTFOLIO_QUERY_KEY } from '@/lib/api-client/portfolio-api';
import { translateAccountError } from '@/components/inventory-scanner/utils';
import {
  fetchSteamAccounts,
  addSteamAccount,
  deleteSteamAccount,
  triggerBackgroundSync,
  STEAM_ACCOUNTS_QUERY_KEY,
} from '@/lib/api-client/steam-accounts-api';

interface UseAccountCRUDProps {
  reportQuery: { refetch: () => Promise<unknown>; data?: unknown };
}

export function useAccountCRUD({ reportQuery }: UseAccountCRUDProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showCookieGuide, setShowCookieGuide] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(t('dashboard.cannotLoadAccounts')),
    staleTime: 5 * 60 * 1000,
  });

  // Đồng bộ nền im lặng mỗi 1 giờ
  const hasAccounts = (accountsQuery.data?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasAccounts) return;

    const interval = setInterval(
      () => {
        triggerBackgroundSync()
          .then(() => {
            accountsQuery.refetch();
            reportQuery.refetch();
          })
          .catch((err) => console.error('Silent background sync failed:', err));
      },
      60 * 60 * 1000
    ); // 1 hour

    return () => clearInterval(interval);
  }, [hasAccounts, accountsQuery, reportQuery]);

  const addAccountMutation = useMutation({
    mutationFn: (payload: { steamUrl: string; steamCookie?: string }) =>
      addSteamAccount(payload, t('dashboard.cannotAddAccount')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STEAM_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] });
      toast.success(t('dashboard.accountLinked'));
    },
    onError: (err) => {
      toast.error(t('dashboard.accountLinkError'), {
        description: translateAccountError(getErrorMessage(err), t),
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => deleteSteamAccount(id, t('dashboard.cannotDeleteAccount')),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: STEAM_ACCOUNTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-storage-units'] }),
        queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY }),
      ]);
      toast.success(t('dashboard.accountUnlinked'));
    },
    onError: (err) => {
      toast.error(t('dashboard.accountUnlinkError'), {
        description: translateAccountError(getErrorMessage(err), t),
      });
    },
  });

  return {
    accountsQuery,
    addAccountMutation,
    deleteAccountMutation,
    showCookieGuide,
    setShowCookieGuide,
    accountToDelete,
    setAccountToDelete,
  };
}
