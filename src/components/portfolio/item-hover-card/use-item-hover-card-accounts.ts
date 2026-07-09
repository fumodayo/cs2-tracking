import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  STEAM_ACCOUNTS_QUERY_KEY,
  STORAGE_UNITS_QUERY_KEY,
  fetchAccountStorageUnits,
  fetchSteamAccounts,
} from '@/lib/api-client/steam-accounts-api';
import type { PortfolioTableRow } from '../portfolio-table-model';
import type { ItemHoverCardAccountOption } from './lot-update-helpers';

export function useItemHoverCardAccounts({
  item,
  editAccountId,
}: {
  item: Pick<PortfolioTableRow, 'sourceAccounts'>;
  editAccountId: string;
}) {
  const accountsQuery = useQuery({
    queryKey: STEAM_ACCOUNTS_QUERY_KEY,
    queryFn: () => fetchSteamAccounts(),
    staleTime: 5 * 60 * 1000,
  });

  const storageUnitsQuery = useQuery({
    queryKey: STORAGE_UNITS_QUERY_KEY(editAccountId),
    queryFn: () => fetchAccountStorageUnits(editAccountId),
    enabled: !!editAccountId,
    staleTime: 5 * 60 * 1000,
  });

  const accountOptions = useMemo<ItemHoverCardAccountOption[]>(() => {
    const map = new Map<string, ItemHoverCardAccountOption>();

    for (const account of accountsQuery.data ?? []) {
      map.set(account.steamId64, {
        id: account.id,
        steamId64: account.steamId64,
        name: account.name,
      });
    }

    for (const account of item.sourceAccounts ?? []) {
      if (!account.steamId64 || map.has(account.steamId64)) continue;
      map.set(account.steamId64, {
        id: account.steamId64,
        steamId64: account.steamId64,
        name: account.name || account.steamId64,
      });
    }

    return Array.from(map.values());
  }, [accountsQuery.data, item.sourceAccounts]);

  return {
    accountOptions,
    storageUnits: storageUnitsQuery.data,
  };
}
