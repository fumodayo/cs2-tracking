import { useCallback, useEffect, useRef, useState } from 'react';
import type { Row, Table } from '@tanstack/react-table';

import type { ScanResultItem } from '../types';

export function useResultsTableState({
  table,
  globalFilter,
  setGlobalFilter,
  selectedTypes,
  selectedStatuses,
  selectedAccounts,
  selectedSourceFilters,
  selectedPriceSourceFilters,
  setRowSelection,
  isMobile,
}: {
  table: Table<ScanResultItem>;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  selectedTypes: Set<string>;
  selectedStatuses: string[];
  selectedAccounts: string[];
  selectedSourceFilters: string[];
  selectedPriceSourceFilters: string[];
  setRowSelection: (value: Record<string, boolean>) => void;
  isMobile: boolean;
}) {
  const [localQuery, setLocalQuery] = useState(globalFilter);
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalQuery(globalFilter);
  }, [globalFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== globalFilter) {
        setGlobalFilter(localQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, globalFilter, setGlobalFilter]);

  useEffect(() => {
    setVisibleCount(10);
  }, [
    globalFilter,
    selectedTypes,
    selectedStatuses,
    selectedAccounts,
    selectedSourceFilters,
    selectedPriceSourceFilters,
  ]);

  const allFilteredRows = table.getSortedRowModel().rows;
  const hasMore = visibleCount < allFilteredRows.length;

  const displayRows: Row<ScanResultItem>[] = isMobile
    ? allFilteredRows.slice(0, visibleCount)
    : table.getRowModel().rows;

  const displayRowsCount = displayRows.length;
  const selectedDisplayCount = displayRows.filter((row) => row.getIsSelected()).length;
  const hasSelectableRows = displayRowsCount > 0;
  const canSelectMoreFiltered = hasSelectableRows && selectedDisplayCount < displayRowsCount;

  const handleSelectAllFiltered = useCallback(() => {
    const nextSelection: Record<string, boolean> = {};
    for (const row of displayRows) {
      nextSelection[row.id] = true;
    }
    setRowSelection(nextSelection);
  }, [displayRows, setRowSelection]);

  useEffect(() => {
    if (!isMobile || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + 10, allFilteredRows.length));
            setIsLoadingMore(false);
          }, 500);
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [isMobile, hasMore, isLoadingMore, allFilteredRows.length]);

  const hasActiveFilters =
    selectedSourceFilters.length > 0 ||
    selectedTypes.size > 0 ||
    selectedAccounts.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedPriceSourceFilters.length > 0;

  return {
    localQuery,
    setLocalQuery,
    displayRows,
    sentinelRef,
    isLoadingMore,
    hasSelectableRows,
    canSelectMoreFiltered,
    hasMore,
    hasActiveFilters,
    handleSelectAllFiltered,
  };
}
