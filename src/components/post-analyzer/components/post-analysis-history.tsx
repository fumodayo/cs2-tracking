/* eslint-disable react-refresh/only-export-components */
import { Clock3, Trash2 } from "lucide-react";
import { formatDateTimeVi as formatHistoryDate } from "@/utils/date";
import { useCurrency } from "@/components/currency-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { PostAnalysisHistoryItemDto } from "@/types/post-analysis";

export function getHistorySnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim() || "Không có nội dung";
}

export function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-stone-850 bg-stone-950/60 px-2.5 py-2 text-center shadow-sm">
      <div className="truncate text-[9px] tracking-wider text-stone-500 uppercase font-semibold">
        {label}
      </div>
      <div className="mt-1 truncate font-bold text-stone-100 text-xs">{value}</div>
    </div>
  );
}

export function HistoryRow({
  item,
  selected,
  onLoad,
  onDelete,
}: {
  item: PostAnalysisHistoryItemDto;
  selected: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const { formatCurrency } = useCurrency();
  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all duration-205 ${
        selected
          ? "border-accent/50 bg-accent/3 shadow-md shadow-accent/5"
          : "border-stone-800 bg-stone-900/20 hover:border-stone-700 hover:bg-stone-900/30"
      }`}
    >
      <button
        type="button"
        onClick={onLoad}
        className="block w-full text-left cursor-pointer focus:outline-none"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Clock3 className="size-3.5" />
            <span>{formatHistoryDate(item.updatedAt)}</span>
          </div>
          {selected && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              Đang xem
            </span>
          )}
        </div>
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-stone-300 group-hover:text-stone-200 font-medium">
          {getHistorySnippet(item.text)}
        </p>
        {item.imageFileName ? (
          <p className="mt-1.5 truncate text-xs text-stone-500 flex items-center gap-1">
            <span className="size-1 rounded-full bg-stone-700" />
            Ảnh: {item.imageFileName}
          </p>
        ) : null}
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
          <HistoryMetric
            label="Vật phẩm"
            value={new Intl.NumberFormat("vi-VN").format(
              item.analysis.totalQuantity,
            )}
          />
          <HistoryMetric
            label="Rate"
            value={item.analysis.allRate.toFixed(2)}
          />
          <HistoryMetric
            label="Tổng"
            value={formatCurrency(item.analysis.totalAllRateValue)}
          />
        </div>
      </button>
      <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Tooltip content="Xóa bài này">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="size-7 rounded-md border border-stone-800 bg-stone-950/80 text-stone-400 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
