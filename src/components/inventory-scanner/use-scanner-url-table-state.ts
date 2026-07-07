import { useCallback, useEffect, useMemo } from 'react';
import type { OnChangeFn, PaginationState } from '@tanstack/react-table';

import type { ScannerQuerySetters, ScannerQueryState } from './use-inventory-scanner';

export function useScannerUrlTableState({
  urlState,
  setters,
}: {
  urlState: ScannerQueryState;
  setters: ScannerQuerySetters;
}) {
  const selectedAccounts = urlState.accounts;
  const selectedStatuses = urlState.status;
  const selectedSourceFilters = useMemo(() => urlState.source ?? [], [urlState.source]);
  const selectedPriceSourceFilters = useMemo(
    () => urlState.priceSource ?? [],
    [urlState.priceSource]
  );

  const pagination = useMemo(
    () => ({
      pageIndex: urlState.page - 1,
      pageSize: urlState.pageSize,
    }),
    [urlState.page, urlState.pageSize]
  );

  const setPagination = useCallback<OnChangeFn<PaginationState>>(
    (value) => {
      if (typeof value === 'function') {
        const next = value({
          pageIndex: urlState.page - 1,
          pageSize: urlState.pageSize,
        });
        setters.page(next.pageIndex + 1);
        setters.pageSize(next.pageSize);
      } else {
        setters.page(value.pageIndex + 1);
        setters.pageSize(value.pageSize);
      }
    },
    [urlState.page, urlState.pageSize, setters]
  );

  useEffect(() => {
    setters.page((page) => (page === 1 ? page : 1));
  }, [
    urlState.q,
    urlState.type,
    urlState.status,
    urlState.accounts,
    urlState.source,
    urlState.priceSource,
    setters,
  ]);

  return {
    selectedAccounts,
    setSelectedAccounts: setters.accounts,
    selectedStatuses,
    setSelectedStatuses: setters.status,
    selectedSourceFilters,
    setSelectedSourceFilters: setters.source,
    selectedPriceSourceFilters,
    setSelectedPriceSourceFilters: setters.priceSource,
    pagination,
    setPagination,
  };
}
