"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type HeaderContext,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PRICE_RANGE_LABELS, PRICE_RANGES } from "@/domain/price";
import type { PortfolioReportDto } from "@/types/report";
import { formatCurrency, formatDateTime, formatPercent } from "@/utils/format";
import { CaseThumbnail } from "./case-thumbnail";
import { ChangePill } from "./change-pill";
import {
  buildPortfolioTableRows,
  type PortfolioTableMode,
  type PortfolioTableRow,
} from "./portfolio-table-model";

type PortfolioTableProps = {
  report: PortfolioReportDto;
  deletingId: string | null;
  onDelete: (id: string) => void;
};

const PAGE_SIZES = [10, 20, 50];

export function PortfolioTable({ report, deletingId, onDelete }: PortfolioTableProps) {
  const [mode, setMode] = useState<PortfolioTableMode>("transactions");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo(() => buildPortfolioTableRows(report, mode), [mode, report]);
  const columns = useMemo(() => buildColumns(mode, deletingId, onDelete), [deletingId, mode, onDelete]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) {
        return true;
      }

      const item = row.original;
      return [item.case.name, item.case.marketHashName, item.note, String(item.quantity), String(item.buyPrice)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-stone-800 bg-stone-950/45">
      <div className="flex flex-col gap-3 border-b border-stone-800 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("transactions")}
            className={`h-9 rounded-md px-3 text-sm font-medium ${
              mode === "transactions" ? "bg-amber-400 text-stone-950" : "border border-stone-700 text-stone-300 hover:bg-stone-800"
            }`}
          >
            Giao dịch
          </button>
          <button
            type="button"
            onClick={() => setMode("case-summary")}
            className={`h-9 rounded-md px-3 text-sm font-medium ${
              mode === "case-summary" ? "bg-amber-400 text-stone-950" : "border border-stone-700 text-stone-300 hover:bg-stone-800"
            }`}
          >
            Tổng hợp case
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm">
            <Search className="size-4 text-stone-500" />
            <input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Tìm case, market hash, ghi chú..."
              className="w-full bg-transparent text-stone-100 outline-none placeholder:text-stone-600"
            />
          </label>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-10 rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm text-stone-100 outline-none"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} dòng
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1260px] border-collapse text-left text-sm">
          <thead className="bg-stone-900/80 text-xs uppercase tracking-[0.12em] text-stone-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-semibold">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-stone-800">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="text-stone-200">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-stone-800 p-3 text-sm text-stone-400 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Trang {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} ·{" "}
          {table.getFilteredRowModel().rows.length} dòng
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-700 px-3 text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            Trước
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-700 px-3 text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildColumns(
  mode: PortfolioTableMode,
  deletingId: string | null,
  onDelete: (id: string) => void,
): ColumnDef<PortfolioTableRow>[] {
  return [
    {
      id: "case",
      header: "Case",
      accessorFn: (row) => row.case.name,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-3">
            <CaseThumbnail imageUrl={item.case.imageUrl} name={item.case.name} />
            <div className="min-w-0">
              <div className="font-semibold text-stone-50">{item.case.name}</div>
              <div className="mt-1 text-xs text-stone-500">
                {mode === "case-summary" ? `${item.lotCount} lần mua` : `Cập nhật: ${formatDateTime(item.currentPriceCapturedAt)}`}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "quantity",
      header: sortableHeader("SL"),
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => <span className="font-medium">{row.original.quantity}</span>,
    },
    {
      id: "buyPrice",
      header: sortableHeader(mode === "case-summary" ? "Giá mua TB" : "Giá mua"),
      accessorFn: (row) => row.buyPrice,
      cell: ({ row }) => formatCurrency(row.original.buyPrice),
    },
    {
      id: "buyDate",
      header: sortableHeader(mode === "case-summary" ? "Khoảng mua" : "Ngày mua"),
      accessorFn: (row) => getBuyDateSortValue(row.buyDate),
      cell: ({ row }) => formatBuyDate(row.original.buyDate),
    },
    {
      id: "investedValue",
      header: sortableHeader("Tổng vốn"),
      accessorFn: (row) => row.investedValue,
      cell: ({ row }) => formatCurrency(row.original.investedValue),
    },
    {
      id: "currentPrice",
      header: sortableHeader("Giá hiện tại"),
      accessorFn: (row) => row.currentPrice ?? -1,
      cell: ({ row }) => formatCurrency(row.original.currentPrice),
    },
    {
      id: "profitAmount",
      header: sortableHeader("Lãi/lỗ"),
      accessorFn: (row) => row.profitAmount ?? -Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => {
        const profitPositive = (row.original.profitAmount ?? 0) >= 0;
        return (
          <span className={`font-semibold ${profitPositive ? "text-emerald-300" : "text-red-300"}`}>
            {formatCurrency(row.original.profitAmount)}
          </span>
        );
      },
    },
    {
      id: "profitPercent",
      header: sortableHeader("%"),
      accessorFn: (row) => row.profitPercent ?? -Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => {
        const profitPositive = (row.original.profitPercent ?? 0) >= 0;
        return (
          <span className={`font-semibold ${profitPositive ? "text-emerald-300" : "text-red-300"}`}>
            {formatPercent(row.original.profitPercent)}
          </span>
        );
      },
    },
    ...PRICE_RANGES.map<ColumnDef<PortfolioTableRow>>((range) => ({
      id: range,
      header: PRICE_RANGE_LABELS[range],
      cell: ({ row }) => <ChangePill change={row.original.marketChanges[range]} />,
    })),
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        if (mode === "case-summary") {
          return <div className="text-right text-xs text-stone-500">Gộp {row.original.itemIds.length} dòng</div>;
        }

        return (
          <div className="text-right">
            <button
              type="button"
              onClick={() => onDelete(row.original.id)}
              disabled={deletingId === row.original.id}
              className="inline-grid size-9 place-items-center rounded-md border border-stone-700 text-stone-300 hover:border-red-500 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
              aria-label={`Xóa ${row.original.case.name}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      },
    },
  ];
}

function sortableHeader(label: string) {
  function SortableHeader({ column }: HeaderContext<PortfolioTableRow, unknown>) {
    return (
    <button type="button" onClick={() => column.toggleSorting()} className="inline-flex items-center gap-1 hover:text-stone-100">
      {label}
      <ArrowUpDown className="size-3.5" />
    </button>
    );
  }

  SortableHeader.displayName = `SortableHeader(${label})`;
  return SortableHeader;
}

function getBuyDateSortValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const firstValue = value.split("|")[0];
  const timestamp = new Date(firstValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatBuyDate(value: string | null): string {
  if (!value) {
    return "Chưa có";
  }

  const [from, to] = value.split("|");
  if (!to) {
    return formatDateTime(from).split(" ")[0];
  }

  return `${formatDateTime(from).split(" ")[0]} - ${formatDateTime(to).split(" ")[0]}`;
}
