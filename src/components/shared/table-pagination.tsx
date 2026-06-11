import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui/select";

interface TablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

export function TablePagination<TData>({
  table,
  pageSizeOptions = [5, 10, 20, 50, 100],
}: TablePaginationProps<TData>) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/50 px-4 py-2.5 text-xs text-stone-400">
      <div className="flex items-center gap-2">
        <span className="font-medium text-stone-400">
          {t("common.rowsPerPage") || "Rows per page"}
        </span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <Select.Trigger className="h-7 w-[60px] bg-stone-900 border-stone-700 sm:w-[70px]">
            <Select.Value placeholder={table.getState().pagination.pageSize} />
          </Select.Trigger>
          <Select.Content>
            {pageSizeOptions.map((size) => (
              <Select.Item key={size} value={String(size)}>
                {size}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="font-medium text-stone-400">
        {table.getFilteredRowModel().rows.length} {t("common.rows") || "rows"} –{" "}
        {t("common.page") || "Page"} {table.getState().pagination.pageIndex + 1}{" "}
        {t("common.to") || "to"} {Math.max(table.getPageCount(), 1)}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200 disabled:pointer-events-none disabled:opacity-30"
          title={t("common.firstPage") || "First page"}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200 disabled:pointer-events-none disabled:opacity-30"
          title={t("common.prevPage") || "Previous page"}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {(() => {
          const pageCount = Math.max(table.getPageCount(), 1);
          const currentPage = table.getState().pagination.pageIndex;
          const pages: number[] = [];
          const maxVisible = 5;
          let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
          const end = Math.min(pageCount, start + maxVisible);
          if (end - start < maxVisible) {
            start = Math.max(0, end - maxVisible);
          }
          for (let i = start; i < end; i++) pages.push(i);
          return pages.map((pageIdx) => (
            <Button
              key={pageIdx}
              type="button"
              variant="ghost"
              onClick={() => table.setPageIndex(pageIdx)}
              className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-xs font-bold transition-all ${pageIdx === currentPage
                  ? "bg-accent/12 text-accent border border-accent/20 shadow-sm"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                }`}
            >
              {pageIdx + 1}
            </Button>
          ));
        })()}
        <Button
          type="button"
          variant="ghost"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200 disabled:pointer-events-none disabled:opacity-30"
          title={t("common.nextPage") || "Next page"}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200 disabled:pointer-events-none disabled:opacity-30"
          title={t("common.lastPage") || "Last page"}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
