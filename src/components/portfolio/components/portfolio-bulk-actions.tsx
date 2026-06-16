"use client";

import { Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PortfolioBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onSellSelected: () => void;
  onDeleteSelected: () => void;
  isDeletingMany?: boolean;
}

export function PortfolioBulkActions({
  selectedCount,
  onClearSelection,
  onSellSelected,
  onDeleteSelected,
  isDeletingMany = false,
}: PortfolioBulkActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between border-b border-red-500/20 bg-red-950/10 px-4 py-2.5 animate-fade-slide-in">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-400">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-stone-300">
          {t("portfolio.selected", "đã chọn")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex h-8 items-center justify-center rounded-md border border-stone-850 bg-stone-900/60 hover:bg-stone-900 px-3 text-xs font-semibold text-stone-400 hover:text-stone-200 transition-all cursor-pointer"
        >
          {t("portfolio.deselectAll", "Hủy chọn")}
        </button>
        <button
          type="button"
          onClick={onSellSelected}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent hover:bg-accent-hover px-3.5 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-md shadow-accent/20"
        >
          <ShoppingBag className="size-3 text-slate-950" />
          <span>{t("portfolio.sellSelected", "Bán đã chọn")}</span>
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={isDeletingMany}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-red-650 hover:bg-red-750 px-3.5 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-red-950/20"
        >
          {isDeletingMany ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3 text-red-200" />
          )}
          <span>{t("portfolio.deleteSelected", "Xóa đã chọn")}</span>
        </button>
      </div>
    </div>
  );
}
