import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { cn } from '@/utils/cn';

interface TablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  className?: string;
  unit?: string;
}

export function TablePagination<TData>({
  table,
  pageSizeOptions = [5, 10, 20, 50, 100],
  className,
  unit,
}: TablePaginationProps<TData>) {
  const { t } = useTranslation();
  const unitLabel = unit || t('common.rows') || 'rows';

  return (
    <div
      className={cn(
        'border-stone-850 relative flex w-full flex-col items-center gap-4 border-t bg-stone-900/50 px-4 py-4 text-xs text-stone-400 sm:flex-row sm:justify-between sm:py-3.5',
        className
      )}
    >
      {/* CHỌN TRANG - bên trái */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs font-medium text-stone-400">
          {t('common.rowsPerPage') || 'Rows per page'}
        </span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <Select.Trigger className="h-8 w-[60px] border-stone-700 bg-stone-900 sm:w-[70px]">
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

      {/* THÔNG TIN TRANG HIỆN TẠI - căn giữa tuyệt đối trên desktop */}
      <span className="text-xs font-medium text-stone-400 select-none sm:absolute sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:text-sm">
        {table.getFilteredRowModel().rows.length} {unitLabel} • {t('common.page') || 'Page'}{' '}
        {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
      </span>

      {/* NÚT MŨI TÊN VÀ SỐ - bên phải */}
      <nav className="flex w-full items-center gap-1 sm:w-auto">
        <Button
          type="button"
          variant="outline"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="hover:bg-accent/8 hover:border-accent/30 hover:text-accent h-10 flex-grow rounded-md border border-stone-800 bg-stone-950/40 p-0 text-stone-400 transition-all disabled:pointer-events-none disabled:opacity-20 sm:w-10 sm:flex-grow-0"
          title={t('common.firstPage') || 'First page'}
        >
          <ChevronsLeft className="size-[18px]" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="hover:bg-accent/8 hover:border-accent/30 hover:text-accent h-10 flex-grow rounded-md border border-stone-800 bg-stone-950/40 p-0 text-stone-400 transition-all disabled:pointer-events-none disabled:opacity-20 sm:w-10 sm:flex-grow-0"
          title={t('common.prevPage') || 'Previous page'}
        >
          <ChevronLeft className="size-[18px]" />
        </Button>
        {(() => {
          const pageCount = Math.max(table.getPageCount(), 1);
          const currentPage = table.getState().pagination.pageIndex;
          const pages: number[] = [];
          const maxVisible = 3;
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
              variant={pageIdx === currentPage ? 'primary' : 'outline'}
              onClick={() => table.setPageIndex(pageIdx)}
              className={`h-10 flex-grow rounded-md text-xs font-bold transition-all sm:w-10 sm:flex-grow-0 ${
                pageIdx === currentPage
                  ? 'bg-accent text-accent-foreground border-accent/20 shadow-accent/10 border shadow-md'
                  : 'hover:bg-accent/8 hover:border-accent/30 hover:text-accent border border-stone-800 bg-stone-950/40 text-stone-400'
              }`}
            >
              {pageIdx + 1}
            </Button>
          ));
        })()}
        <Button
          type="button"
          variant="outline"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="hover:bg-accent/8 hover:border-accent/30 hover:text-accent h-10 flex-grow rounded-md border border-stone-800 bg-stone-950/40 p-0 text-stone-400 transition-all disabled:pointer-events-none disabled:opacity-20 sm:w-10 sm:flex-grow-0"
          title={t('common.nextPage') || 'Next page'}
        >
          <ChevronRight className="size-[18px]" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="hover:bg-accent/8 hover:border-accent/30 hover:text-accent h-10 flex-grow rounded-md border border-stone-800 bg-stone-950/40 p-0 text-stone-400 transition-all disabled:pointer-events-none disabled:opacity-20 sm:w-10 sm:flex-grow-0"
          title={t('common.lastPage') || 'Last page'}
        >
          <ChevronsRight className="size-[18px]" />
        </Button>
      </nav>
    </div>
  );
}
