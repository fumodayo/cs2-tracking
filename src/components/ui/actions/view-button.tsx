"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, Check } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";

const DEFAULT_COLUMN_LABELS: Record<string, string> = {
  // Common/Control columns
  select: "Chọn",
  actions: "Hành động",

  // Inventory Scanner columns
  case: "Vật phẩm",
  quantity: "Số lượng",
  price: "Đơn giá",
  total: "Tổng trị giá",
  rateAll: "Giá sỉ",
  rateLe: "Giá lẻ",

  // Portfolio Table columns
  buyPrice: "Giá mua",
  investedValue: "Tổng vốn",
  currentPrice: "Giá hiện tại",
  wholesaleValue: "Giá sỉ",
  retailValue: "Giá lẻ",
  profitAmount: "Lãi/lỗ",
  profitPercent: "% Lãi/lỗ",
  updatedAt: "Ngày cập nhật",
  buyDate: "Ngày mua",
  buffActualProfit: "Lợi nhuận (Buff)",
  steamActualProfit: "Lợi nhuận (Steam)",
};

interface ViewButtonProps<TData> {
  table: Table<TData>;
  columnLabels?: Record<string, string>;
  className?: string;
}

export function ViewButton<TData>({
  table,
  columnLabels = {},
  className,
}: ViewButtonProps<TData>) {
  const [open, setOpen] = React.useState(false);

  const labels = React.useMemo(() => {
    return { ...DEFAULT_COLUMN_LABELS, ...columnLabels };
  }, [columnLabels]);

  const hideableColumns = React.useMemo(() => {
    return table.getAllLeafColumns().filter((column) => column.getCanHide());
  }, [table]);

  if (hideableColumns.length === 0) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className={cn(
            "hover:bg-stone-850 h-8 cursor-pointer border-stone-800 bg-stone-900/40 px-3 text-xs font-semibold text-stone-300 shadow-sm transition-all hover:text-stone-100",
            className,
          )}
        >
          <SlidersHorizontal className="size-3.5 text-stone-500 transition-colors group-hover:text-stone-300" />
          <span>Hiển thị cột</span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="animate-fade-slide-in z-50 w-52 overflow-hidden rounded-xl border border-stone-800 bg-stone-950/95 p-0 text-stone-200 shadow-2xl backdrop-blur-md"
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            <h3 className="border-b border-stone-900 px-3.5 py-2.5 text-xs font-bold text-stone-400">
              Ẩn / Hiện các cột
            </h3>

            {/* Column toggles list */}
            <div
              className="hover:[&::-webkit-scrollbar-thumb]:bg-stone-750 max-h-60 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-track]:bg-transparent"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "var(--border) transparent",
              }}
            >
              {hideableColumns.map((column) => {
                const isVisible = column.getIsVisible();
                const label = labels[column.id] || column.id;

                return (
                  <Button
                    key={column.id}
                    variant="ghost"
                    onClick={() => column.toggleVisibility(!isVisible)}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-2 py-2 text-start text-xs font-semibold text-stone-300 transition-colors outline-none select-none hover:bg-stone-900 hover:text-stone-100",
                      isVisible &&
                        "bg-blue-500/[0.04] text-blue-400 hover:bg-blue-500/[0.08] hover:text-blue-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-4 items-center justify-center rounded border border-stone-800 bg-stone-950 transition-all",
                        isVisible && "border-blue-500/40 bg-blue-500/10",
                      )}
                    >
                      {isVisible && <Check className="size-3 text-blue-400" />}
                    </span>
                    <span className="truncate">{label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
