"use client";

import { flexRender, type Table } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { FilterPopover, ResetButton, ViewButton } from "@/components/ui/actions";
import { ManualItemRow } from "./manual-item-row";
import { TablePagination } from "@/components/shared/table-pagination";
import type { ScanResultItem } from "../types";

interface ResultsTableProps {
  table: Table<ScanResultItem>;
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  selectedTypes: Set<string>;
  clearTypeFilters: () => void;
  toggleTypeFilter: (val: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (val: string[]) => void;
  selectedAccounts: string[];
  setSelectedAccounts: (val: string[]) => void;
  accountOptions: Array<{ steamId64: string; name: string }>;
  visibleManualItems: ScanResultItem[];
  updateManualItemQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  fetchBuffPrice: (marketHashName: string) => void;
  updateBuffPriceCny: (marketHashName: string, rawValue: string) => void;
  buffPricesCny: Record<string, number>;
  buffPriceErrors: Record<string, string>;
  buffLoadingKeys: Set<string>;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  manualItems: ScanResultItem[];
}

export function ResultsTable({
  table,
  globalFilter,
  setGlobalFilter,
  selectedTypes,
  clearTypeFilters,
  toggleTypeFilter,
  selectedStatuses,
  setSelectedStatuses,
  selectedAccounts,
  setSelectedAccounts,
  accountOptions,
  visibleManualItems,
  updateManualItemQty,
  removeItem,
  fetchBuffPrice,
  updateBuffPriceCny,
  buffPricesCny,
  buffPriceErrors,
  buffLoadingKeys,
  buffCnyToVndRate,
  rateAll,
  rateLe,
  manualItems,
}: ResultsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
      <div className="flex flex-col gap-3 border-b border-stone-800 bg-stone-900/60 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-64 items-center gap-2 rounded-md border border-input-border bg-input px-3 text-xs transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                aria-label="Tìm kiếm vật phẩm"
                placeholder="Tìm case, capsule, sticker, skin..."
                className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ResetButton
            isVisible={
              selectedTypes.size > 0 ||
              selectedStatuses.length > 0 ||
              selectedAccounts.length > 0
            }
            onReset={() => {
              clearTypeFilters();
              setSelectedStatuses([]);
              setSelectedAccounts([]);
            }}
          />

          <FilterPopover
            label="Loại vật phẩm"
            options={[
              { label: "Case", value: "Case" },
              { label: "Sticker Capsule", value: "Capsule" },
              { label: "Sticker", value: "Sticker" },
              { label: "Skin", value: "Skin" },
            ]}
            selectedValues={Array.from(selectedTypes)}
            onChange={(nextValues) => {
              clearTypeFilters();
              nextValues.forEach((val) => toggleTypeFilter(val));
              table.setPageIndex(0);
            }}
          />

          <FilterPopover
            label="Trạng thái"
            options={[
              { label: "🟢 Tradeable", value: "tradeable" },
              { label: "🟡 On Market", value: "market" },
              { label: "🔵 Trade Protected", value: "protected" },
              { label: "🔴 Hold", value: "hold" },
            ]}
            selectedValues={selectedStatuses}
            onChange={(nextValues) => {
              setSelectedStatuses(nextValues);
              table.setPageIndex(0);
            }}
          />

          <FilterPopover
            label="Tài khoản"
            options={accountOptions.map((account) => ({
              label: account.name,
              value: account.steamId64,
            }))}
            selectedValues={selectedAccounts}
            onChange={(nextValues) => {
              setSelectedAccounts(nextValues);
              table.setPageIndex(0);
            }}
            disabled={accountOptions.length === 0}
          />

          <ViewButton table={table} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-stone-300">
          <thead className="bg-stone-900/80 text-xs text-stone-400 uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-5 py-3 font-medium ${
                      header.column.id !== "case" ? "text-right" : ""
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-stone-800">
            {visibleManualItems.length > 0 &&
              visibleManualItems.map((item) => {
                const marketHashName = item.caseItem.marketHashName;
                return (
                  <ManualItemRow
                    key={`manual-${item.id || marketHashName}`}
                    item={item}
                    table={table}
                    updateManualItemQty={updateManualItemQty}
                    removeItem={removeItem}
                    fetchBuffPrice={fetchBuffPrice}
                    updateBuffPriceCny={updateBuffPriceCny}
                    buffPriceCny={item.buffPriceCny ?? buffPricesCny[marketHashName]}
                    buffPriceError={buffPriceErrors[marketHashName]}
                    isBuffLoading={buffLoadingKeys.has(marketHashName)}
                    buffCnyToVndRate={buffCnyToVndRate}
                    rateAll={rateAll}
                    rateLe={rateLe}
                    steamPrice={manualItems.find((x) => x.id === item.id)?.price ?? item.price}
                  />
                );
              })}

            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-stone-800/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              visibleManualItems.length === 0 && (
                <tr>
                  <td colSpan={table.getAllColumns().length} className="px-5 py-8 text-center text-stone-500">
                    Không tìm thấy kết quả nào phù hợp
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <TablePagination table={table} />
    </div>
  );
}
