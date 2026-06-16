import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";
import type { PortfolioSourceFilter } from "../portfolio-table-model";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface UsePortfolioTableStateProps {
  filteredDataCount: number;
  globalFilter: string;
  sourceFilters: PortfolioSourceFilter[];
  itemTypeFilters: string[];
  accountFilters: string[];
  statusFilters: string[];
  priceSourceFilters: string[];
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

  // Read page from searchParams, default to 1 (which is index 0)
  const pageParam = searchParams.get("page");
  const initialPageIndex = pageParam ? Math.max(0, parseInt(pageParam, 10) - 1) : 0;

  const [pagination, setPagination] = useState({
    pageIndex: initialPageIndex,
    pageSize: 5,
  });

  const [sorting, setSorting] = useState<SortingState>([{ id: "buyPrice", desc: true }]);

  // Persisted state using useLocalStorage hook
  const [rowSelection, setRowSelection] = useLocalStorage<Record<string, boolean>>(
    "cs2t_portfolio_rowSelection",
    {}
  );

  const [columnVisibility, setColumnVisibility] = useLocalStorage<Record<string, boolean>>(
    "cs2t_portfolio_columnVisibility",
    {
      wholesaleValue: false,
      retailValue: false,
      profitAmount: false,
      updatedAt: false,
      buyDate: false,
      investedValue: false,
    }
  );

  // Read page from URL
  useEffect(() => {
    const pageVal = searchParams.get("page");
    const pIndex = pageVal ? Math.max(0, parseInt(pageVal, 10) - 1) : 0;
    if (pIndex !== pagination.pageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: pIndex }));
    }
  }, [searchParams, pagination.pageIndex]);

  // Fallback to previous page if current page becomes empty after deletion
  useEffect(() => {
    const totalPages = Math.ceil(filteredDataCount / pagination.pageSize);
    if (filteredDataCount > 0 && pagination.pageIndex >= totalPages) {
      const newPageIndex = Math.max(0, totalPages - 1);
      setPagination((prev) => ({ ...prev, pageIndex: newPageIndex }));
    }
  }, [filteredDataCount, pagination.pageSize, pagination.pageIndex]);

  // Reset to first page when search filters change
  useEffect(() => {
    setPagination((prev) => {
      if (prev.pageIndex === 0) return prev;
      return { ...prev, pageIndex: 0 };
    });
  }, [globalFilter, sourceFilters, itemTypeFilters, accountFilters, statusFilters, priceSourceFilters]);

  // Sync pagination.pageIndex change to the URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentPageVal = params.get("page");
    const currentUrlPage = currentPageVal ? Math.max(0, parseInt(currentPageVal, 10) - 1) : 0;
    
    if (pagination.pageIndex !== currentUrlPage) {
      if (pagination.pageIndex > 0) {
        params.set("page", String(pagination.pageIndex + 1));
      } else {
        params.delete("page");
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
  };
}
