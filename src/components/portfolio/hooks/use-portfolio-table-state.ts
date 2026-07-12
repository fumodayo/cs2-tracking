import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  functionalUpdate,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import type { PortfolioSourceFilter } from '../portfolio-table-model';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface UsePortfolioTableStateProps {
  filteredDataCount: number;
  globalFilter: string;
  sourceFilters: PortfolioSourceFilter[];
  itemTypeFilters: string[];
  accountFilters: string[];
  statusFilters: string[];
  priceSourceFilters: string[];
}

export function applyPortfolioPaginationUpdate(
  current: PaginationState,
  updater: Updater<PaginationState>
): PaginationState {
  const next = functionalUpdate(updater, current);
  if (next.pageSize !== current.pageSize) {
    return { ...next, pageIndex: 0 };
  }

  return next;
}

export function usePortfolioTableState({
  filteredDataCount,
  globalFilter,
  sourceFilters,
  itemTypeFilters,
  accountFilters,
  statusFilters,
  priceSourceFilters,
}: UsePortfolioTableStateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const didMountRef = useRef(false);
  const filterResetPendingRef = useRef(false);

  // Đọc trang từ searchParams, mặc định là 1 (tương ứng index 0)
  const pageParam = searchParams.get('page');
  const initialPageIndex = pageParam ? Math.max(0, parseInt(pageParam, 10) - 1) : 0;

  const [pagination, setPaginationState] = useState<PaginationState>({
    pageIndex: initialPageIndex,
    pageSize: 10,
  });

  const setPagination = useCallback<OnChangeFn<PaginationState>>((updater) => {
    setPaginationState((current) => applyPortfolioPaginationUpdate(current, updater));
  }, []);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'buyPrice', desc: true }]);

  const [visibleCount, setVisibleCount] = useState(10);

  // State lưu bền bằng hook useLocalStorage
  const [rowSelection, setRowSelection] = useLocalStorage<Record<string, boolean>>(
    'cs2t_portfolio_rowSelection',
    {}
  );

  const [columnVisibility, setColumnVisibility] = useLocalStorage<Record<string, boolean>>(
    'cs2t_portfolio_columnVisibility',
    {
      wholesaleValue: false,
      retailValue: false,
      profitAmount: false,
      updatedAt: false,
      buyDate: false,
      investedValue: false,
    }
  );

  // Đọc trang từ URL
  useEffect(() => {
    const pageVal = new URLSearchParams(searchParamsString).get('page');
    const pIndex = pageVal ? Math.max(0, parseInt(pageVal, 10) - 1) : 0;
    if (filterResetPendingRef.current) {
      if (pIndex === 0) {
        filterResetPendingRef.current = false;
      }
      return;
    }
    setPaginationState((prev) => {
      if (pIndex === prev.pageIndex) return prev;
      return { ...prev, pageIndex: pIndex };
    });
  }, [searchParamsString]);

  // Lùi về trang trước nếu trang hiện tại rỗng sau khi xóa
  useEffect(() => {
    const totalPages = Math.ceil(filteredDataCount / pagination.pageSize);
    if (filteredDataCount > 0 && pagination.pageIndex >= totalPages) {
      const newPageIndex = Math.max(0, totalPages - 1);
      setPaginationState((prev) => {
        if (prev.pageIndex === newPageIndex) return prev;
        return { ...prev, pageIndex: newPageIndex };
      });
    }
  }, [filteredDataCount, pagination.pageSize, pagination.pageIndex]);

  // Reset về trang đầu khi bộ lọc tìm kiếm thay đổi
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    filterResetPendingRef.current = new URLSearchParams(window.location.search).has('page');
    setPaginationState((prev) => {
      if (prev.pageIndex === 0) return prev;
      return { ...prev, pageIndex: 0 };
    });
    setVisibleCount(10);
  }, [
    globalFilter,
    sourceFilters,
    itemTypeFilters,
    accountFilters,
    statusFilters,
    priceSourceFilters,
  ]);

  // Đồng bộ thay đổi pagination.pageIndex lên query parameter URL
  useEffect(() => {
    if (filterResetPendingRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const currentPageVal = params.get('page');
    const currentUrlPage = currentPageVal ? Math.max(0, parseInt(currentPageVal, 10) - 1) : 0;

    if (pagination.pageIndex !== currentUrlPage) {
      if (pagination.pageIndex > 0) {
        params.set('page', String(pagination.pageIndex + 1));
      } else {
        params.delete('page');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pagination.pageIndex, pathname, router]);

  return {
    pagination,
    setPagination,
    sorting,
    setSorting,
    rowSelection,
    setRowSelection,
    columnVisibility,
    setColumnVisibility,
    visibleCount,
    setVisibleCount,
  };
}
