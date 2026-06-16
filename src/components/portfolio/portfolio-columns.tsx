/* eslint-disable react-refresh/only-export-components */
import { type ColumnDef, type HeaderContext } from "@tanstack/react-table";
import { FaSteam, FaCoins } from "react-icons/fa";
import { TbLock } from "react-icons/tb";
import { ArrowUpDown } from "lucide-react";
import type { PortfolioReportRowDto } from "@/types/report";
import { formatPercent } from "@/utils/format";
import { formatRelative as formatRelativeTime } from "@/utils/date";
import {
  type PortfolioTableMode,
  type PortfolioTableRow,
  mapTransactionRow,
} from "./portfolio-table-model";
import {
  getBuyDateSortValue,
  calculateRatedValue,
  toInputNumber,
} from "./portfolio-table-utils";
import { RatedValueCell } from "./portfolio-table-cells";

import { Button } from "@/components/ui/button";
export function sortableHeader(
  label: string,
  align: "left" | "right" = "left",
) {
  function SortableHeader({
    column,
  }: HeaderContext<PortfolioTableRow, unknown>) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting()}
        className={`h-8 px-2 -mx-2 font-medium hover:bg-stone-800/80 hover:text-white ${align === "right" ? "w-full justify-end" : "justify-start"}`}
      >
        <span>{label}</span>
        <ArrowUpDown className="ml-1 size-3 text-stone-500" />
      </Button>
    );
  }

  SortableHeader.displayName = `SortableHeader(${label})`;
  return SortableHeader;
}

export function RateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-input px-2.5 text-xs text-muted-foreground transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring hover:border-stone-700">
      <span className="font-semibold text-stone-400">{label}:</span>
      <input
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-8 [appearance:textfield] bg-transparent text-center text-xs font-bold text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="font-semibold opacity-70">%</span>
    </label>
  );
}

export function BuffRateInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-input px-2.5 text-xs text-muted-foreground transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring hover:border-stone-700">
      <span className="font-semibold text-stone-400">Tỷ giá BUFF:</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="h-7 w-12 [appearance:textfield] bg-transparent text-center text-xs font-bold text-accent outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="font-semibold opacity-70">đ</span>
    </label>
  );
}

// Forward declaration — ItemCell is in portfolio-item-cell.tsx
// This import is here for circular-dependency avoidance; caller passes ItemCell as a render prop.
export type BuildColumnsParams = {
  mode: PortfolioTableMode;
  deletingId: string | null;
  onDelete: (id: string) => void;
  updatingId?: string | null;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
  onUpdateNote?: (id: string, note: string) => Promise<void> | void;
  onUpdateLot?: (
    id: string,
    payload: {
      quantity?: number;
      buyPrice?: number;
      note?: string;
      sourceAccounts?: Array<{ steamId64: string; name: string }>;
      storageUnitId?: string;
      tradeHoldUntil?: string | null;
    },
  ) => Promise<void> | void;
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  fetchBuffPrice?: (marketHashName: string) => void;
  buffLoadingKeys?: Set<string>;
  allRows: PortfolioTableRow[];
  originalRows?: PortfolioReportRowDto[];
  wholesaleRatePercent: number;
  retailRatePercent: number;
  onUpdateBuffRate?: (rate: number) => void;
  formatCurrency: (value: number | null | undefined) => string;
  ItemCellComponent: React.ComponentType<{
    item: PortfolioTableRow;
    mode: PortfolioTableMode;
    relatedRows: PortfolioTableRow[];
    onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
    onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
    onUpdateNote?: (id: string, note: string) => Promise<void> | void;
    onUpdateLot?: BuildColumnsParams["onUpdateLot"];
    onUpdateBuffRate?: (rate: number) => void;
    fetchBuffPrice?: (marketHashName: string) => void;
    buffLoadingKeys?: Set<string>;
    buffCnyToVndRate?: number;
    buffPricesCny?: Record<string, number>;
    onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
    onDelete: (id: string) => void;
    deletingId: string | null;
  }>;
};

export function buildColumns({
  mode,
  deletingId,
  onDelete,
  onUpdateBuyPrice,
  onUpdateQuantity,
  onUpdateNote,
  onUpdateLot,
  onUpdateBuffRate,
  buffPricesCny,
  buffCnyToVndRate,
  onUpdateBuffPrice,
  fetchBuffPrice,
  buffLoadingKeys,
  originalRows,
  wholesaleRatePercent,
  retailRatePercent,
  formatCurrency,
  ItemCellComponent,
}: BuildColumnsParams): ColumnDef<PortfolioTableRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="border-stone-750 size-4 cursor-pointer rounded bg-stone-900 text-blue-500 accent-blue-500"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            aria-label="Chọn tất cả"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="border-stone-750 size-4 cursor-pointer rounded bg-stone-900 text-blue-500 accent-blue-500"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
            aria-label="Chọn dòng"
          />
        </div>
      ),
    },

    {
      id: "case",
      header: "Item",
      accessorFn: (row) => row.case.name,
      cell: ({ row }) => {
        const item = row.original;
        const relatedRows =
          mode === "case-summary" && originalRows
            ? originalRows
                .filter((candidate) => candidate.case.id === item.case.id)
                .map((candidate) =>
                  mapTransactionRow(candidate, buffPricesCny, buffCnyToVndRate),
                )
            : [item];
        return (
          <ItemCellComponent
            item={item}
            mode={mode}
            relatedRows={relatedRows}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateBuyPrice={onUpdateBuyPrice}
            onUpdateNote={onUpdateNote}
            onUpdateLot={onUpdateLot}
            onUpdateBuffRate={onUpdateBuffRate}
            fetchBuffPrice={fetchBuffPrice}
            buffLoadingKeys={buffLoadingKeys}
            buffCnyToVndRate={buffCnyToVndRate}
            buffPricesCny={buffPricesCny}
            onUpdateBuffPrice={onUpdateBuffPrice}
            onDelete={onDelete}
            deletingId={deletingId}
          />
        );
      },
    },
    {
      id: "quantity",
      header: sortableHeader("SL", "right"),
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => {
        const item = row.original;
        const total = item.quantity;
        const suQty = item.storageUnitQuantity ?? 0;
        const invQty = total - suQty;
        return (
          <div className="flex flex-col items-end">
            <span className="font-medium text-foreground">
              {total}
            </span>
            {suQty > 0 && (
              <span
                className="mt-0.5 inline-flex cursor-help items-center gap-0.5 rounded border border-amber-500/20 bg-amber-500/10 px-1 text-[9px] font-bold text-amber-400 select-none"
                title={`Kho thường: ${invQty} | Storage Unit: ${suQty}`}
              >
                <TbLock className="size-2.5 shrink-0" /> {suQty}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "buyPrice",
      header: sortableHeader(
        mode === "case-summary" ? "Giá mua TB" : "Giá mua",
        "right",
      ),
      accessorFn: (row) => row.buyPrice,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="flex items-center justify-end gap-1 font-medium text-foreground">
              {formatCurrency(item.buyPrice)}
              {item.isTemporaryPrice && (
                <span
                  className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500"
                  title="Giá mua tạm tính theo Steam Market (Tự động sync)."
                />
              )}
            </span>
            {item.isTemporaryPrice && (
              <span className="text-[8px] leading-none font-semibold text-amber-500 select-none">
                Tạm tính
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "investedValue",
      header: sortableHeader("Tổng vốn", "right"),
      accessorFn: (row) => row.investedValue,
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.original.investedValue)}
        </span>
      ),
    },
    {
      id: "currentPrice",
      header: sortableHeader("Giá hiện tại", "right"),
      accessorFn: (row) => row.currentPrice ?? -1,
      cell: ({ row }) => {
        const item = row.original;
        const marketHashName = item.case.marketHashName;
        const buffPriceCny = buffPricesCny
          ? buffPricesCny[marketHashName]
          : undefined;
        const rate = buffCnyToVndRate || 3600;
        const steamVal = item.steamPrice ?? item.currentPrice;
        const hasBuffPrice = buffPriceCny !== undefined && buffPriceCny > 0;

        return (
          <div className="flex flex-col items-end justify-center py-1 gap-1 min-h-[3rem]">
            {/* Steam Price */}
            <div className="group relative flex cursor-help items-center gap-1.5">
              <span className="text-[13px] font-medium text-foreground">
                {formatCurrency(steamVal)}
              </span>
              <FaSteam className="size-3.5 text-slate-400 transition-colors group-hover:text-sky-400" />

              {/* Premium Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded border border-slate-800/80 bg-slate-950 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-slate-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:opacity-100">
                Giá Steam
              </div>
            </div>

            {/* Buff Price */}
            {hasBuffPrice && (
              <div className="group relative flex cursor-help items-center gap-1.5">
                <span className="text-[13px] font-medium text-accent">
                  {formatCurrency(Math.round(buffPriceCny * rate))}{" "}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({new Intl.NumberFormat("vi-VN").format(buffPriceCny)} x {new Intl.NumberFormat("vi-VN").format(rate)})
                  </span>
                </span>
                <FaCoins className="size-3.5 text-accent" />

                {/* Premium Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded border border-slate-800/80 bg-slate-950 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-slate-200 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:opacity-100">
                  Giá Buff (¥{new Intl.NumberFormat("vi-VN").format(buffPriceCny)} × {new Intl.NumberFormat("vi-VN").format(rate)})
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "wholesaleValue",
      header: sortableHeader(
        `Sỉ ${toInputNumber(wholesaleRatePercent)}%`,
        "right",
      ),
      accessorFn: (row) => calculateRatedValue(row, wholesaleRatePercent) ?? -1,
      cell: ({ row }) => (
        <RatedValueCell
          item={row.original}
          ratePercent={wholesaleRatePercent}
          label="Sỉ"
        />
      ),
    },
    {
      id: "retailValue",
      header: sortableHeader(
        `Lẻ ${toInputNumber(retailRatePercent)}%`,
        "right",
      ),
      accessorFn: (row) => calculateRatedValue(row, retailRatePercent) ?? -1,
      cell: ({ row }) => (
        <RatedValueCell
          item={row.original}
          ratePercent={retailRatePercent}
          label="Lẻ"
        />
      ),
    },
    {
      id: "profitAmount",
      header: sortableHeader("Lãi/lỗ", "right"),
      accessorFn: (row) => row.profitAmount ?? -Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => {
        const item = row.original;
        const profitPositive = (item.profitAmount ?? 0) >= 0;
        const marketHashName = item.case.marketHashName;
        const buffPriceCny = buffPricesCny
          ? buffPricesCny[marketHashName]
          : undefined;
        const hasBuffPrice =
          buffPriceCny !== undefined &&
          buffPriceCny > 0 &&
          item.itemType === "skin";

        return (
          <div className="flex flex-col items-end gap-1">
            <span
              className={`font-semibold ${profitPositive ? "text-emerald-400" : "text-red-400"}`}
            >
              {formatCurrency(item.profitAmount)}
            </span>
            {hasBuffPrice ? (
              <span className="inline-flex rounded bg-accent/10 px-1 py-0.5 text-[8.5px] font-semibold tracking-wider text-accent uppercase">
                Định giá BUFF
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "profitPercent",
      header: sortableHeader("%", "right"),
      accessorFn: (row) => row.profitPercent ?? -Number.MAX_SAFE_INTEGER,
      cell: ({ row }) => {
        const item = row.original;
        const profitPositive = (item.profitPercent ?? 0) >= 0;
        return (
          <span
            className={`font-semibold ${profitPositive ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatPercent(item.profitPercent)}
          </span>
        );
      },
    },
    {
      id: "updatedAt",
      header: sortableHeader("Ngày cập nhật", "right"),
      accessorFn: (row) =>
        row.currentPriceCapturedAt
          ? new Date(row.currentPriceCapturedAt).getTime()
          : 0,
      cell: ({ row }) => {
        const dateVal = row.original.currentPriceCapturedAt;
        return (
          <span className="text-right text-[13px] font-medium text-muted-foreground">
            {formatRelativeTime(dateVal)}
          </span>
        );
      },
    },
    {
      id: "buyDate",
      header: sortableHeader(
        mode === "case-summary" ? "Khoảng mua" : "Ngày mua",
        "right",
      ),
      accessorFn: (row) => getBuyDateSortValue(row.buyDate),
      cell: ({ row }) => (
        <span className="text-right text-[13px] font-medium text-muted-foreground">
          {formatRelativeTime(row.original.buyDate)}
        </span>
      ),
    },
  ];
}
