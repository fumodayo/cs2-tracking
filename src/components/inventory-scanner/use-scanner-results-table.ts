import { useMemo } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { buildInventoryColumns } from './inventory-scanner-columns';
import { usePatternInspect } from './hooks/use-pattern-inspect';
import type { ScannerState } from './scanner-reducer';
import type { ScanResultItem } from './types';
import { getScanResultItemRowId } from './utils';
import { useScannerColumnVisibility } from './use-scanner-column-visibility';

export function useScannerResultsTable({
  t,
  tableData,
  debouncedGlobalFilter,
  pagination,
  setPagination,
  rowSelection,
  setRowSelection,
  setGlobalFilter,
  scannerState,
  fetchBuffPrice,
  updateBuffPriceCny,
  buffCnyToVndRate,
  rateAll,
  rateLe,
  updateManualItemQty,
  mergedRawItems,
  activeMode,
  onSelectItem,
  isMobile,
}: {
  t: TFunction;
  tableData: ScanResultItem[];
  debouncedGlobalFilter: string;
  pagination: PaginationState;
  setPagination: OnChangeFn<PaginationState>;
  rowSelection: RowSelectionState;
  setRowSelection: OnChangeFn<RowSelectionState>;
  setGlobalFilter: (filter: string) => void;
  scannerState: Pick<ScannerState, 'buffLoadingKeys' | 'buffPricesCny' | 'buffPriceErrors'>;
  fetchBuffPrice: (marketHashName: string) => void;
  updateBuffPriceCny: (marketHashName: string, rawValue: string) => void;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  updateManualItemQty?: (id: string, qty: number) => void;
  mergedRawItems?: ScanResultItem[];
  activeMode: 'case-summary' | 'transactions';
  onSelectItem: (item: ScanResultItem | null) => void;
  isMobile: boolean;
}) {
  const { inspectingKeys, patternResults, inspectPattern } = usePatternInspect();
  const { columnVisibility, setColumnVisibility } = useScannerColumnVisibility();

  const columns = useMemo(
    () =>
      buildInventoryColumns({
        t,
        buffLoadingKeys: scannerState.buffLoadingKeys,
        buffPricesCny: scannerState.buffPricesCny,
        buffPriceErrors: scannerState.buffPriceErrors,
        fetchBuffPrice,
        updateBuffPriceCny,
        buffCnyToVndRate,
        rateAll,
        rateLe,
        updateManualItemQty,
        mergedRawItems,
        inspectingKeys,
        patternResults,
        inspectPattern,
        mode: activeMode,
        onSelectItem,
        isMobile,
      }),
    [
      t,
      buffCnyToVndRate,
      scannerState.buffLoadingKeys,
      scannerState.buffPriceErrors,
      scannerState.buffPricesCny,
      fetchBuffPrice,
      updateBuffPriceCny,
      rateAll,
      rateLe,
      updateManualItemQty,
      mergedRawItems,
      inspectingKeys,
      patternResults,
      inspectPattern,
      activeMode,
      onSelectItem,
      isMobile,
    ]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  return useReactTable({
    data: tableData,
    columns,
    state: {
      globalFilter: debouncedGlobalFilter,
      columnVisibility,
      pagination,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getRowId: getScanResultItemRowId,
    enableRowSelection: true,
    initialState: {
      sorting: [{ id: 'total', desc: true }],
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;
      return [
        row.original.caseItem.name,
        row.original.caseItem.marketHashName,
        row.original.type,
        ...(row.original.sourceAccounts ?? []).map((account) => account.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
}
