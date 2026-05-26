"use client";

import { Trash2 } from "lucide-react";
import { PRICE_RANGE_LABELS, PRICE_RANGES } from "@/domain/price";
import type { PortfolioReportRowDto } from "@/types/report";
import { formatCurrency, formatDateTime, formatPercent } from "@/utils/format";
import { CaseThumbnail } from "./case-thumbnail";
import { ChangePill } from "./change-pill";

type PortfolioTableProps = {
  rows: PortfolioReportRowDto[];
  deletingId: string | null;
  onDelete: (id: string) => void;
};

export function PortfolioTable({ rows, deletingId, onDelete }: PortfolioTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-800 bg-stone-950/45">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-stone-900/80 text-xs uppercase tracking-[0.12em] text-stone-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Case</th>
              <th className="px-4 py-3 font-semibold">SL</th>
              <th className="px-4 py-3 font-semibold">Giá mua</th>
              <th className="px-4 py-3 font-semibold">Giá hiện tại</th>
              <th className="px-4 py-3 font-semibold">Lãi/lỗ</th>
              <th className="px-4 py-3 font-semibold">%</th>
              {PRICE_RANGES.map((range) => (
                <th key={range} className="px-4 py-3 font-semibold">
                  {PRICE_RANGE_LABELS[range]}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800">
            {rows.map((row) => {
              const profitPositive = (row.profitAmount ?? 0) >= 0;

              return (
                <tr key={row.item.id} className="text-stone-200">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <CaseThumbnail imageUrl={row.case.imageUrl} name={row.case.name} />
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-50">{row.case.name}</div>
                        <div className="mt-1 text-xs text-stone-500">
                      Cập nhật: {formatDateTime(row.currentPriceCapturedAt)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium">{row.item.quantity}</td>
                  <td className="px-4 py-4">{formatCurrency(row.item.buyPrice)}</td>
                  <td className="px-4 py-4">{formatCurrency(row.currentPrice)}</td>
                  <td className={`px-4 py-4 font-semibold ${profitPositive ? "text-emerald-300" : "text-red-300"}`}>
                    {formatCurrency(row.profitAmount)}
                  </td>
                  <td className={`px-4 py-4 font-semibold ${profitPositive ? "text-emerald-300" : "text-red-300"}`}>
                    {formatPercent(row.profitPercent)}
                  </td>
                  {PRICE_RANGES.map((range) => (
                    <td key={range} className="px-4 py-4">
                      <ChangePill change={row.marketChanges[range]} />
                    </td>
                  ))}
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(row.item.id)}
                      disabled={deletingId === row.item.id}
                      className="inline-grid size-9 place-items-center rounded-md border border-stone-700 text-stone-300 hover:border-red-500 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
                      aria-label={`Xóa ${row.case.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
