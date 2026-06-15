import React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/actions";
import { CaseThumbnail } from "@/components/portfolio/case-thumbnail";
import { Table } from "@tanstack/react-table";
import { ScanResultItem } from "../types";
import { formatVND, formatPlainNumber, colorWithAlpha, getItemTypeColor, getSteamMarketListingUrl } from "../utils";

export interface ManualItemRowProps {
  item: ScanResultItem;
  table: Table<ScanResultItem>;
  updateManualItemQty: (id: string, qty: number) => void;
  removeItem: (marketHashName: string, isManual: boolean, id?: string) => void;
  fetchBuffPrice: (marketHashName: string) => void;
  updateBuffPriceCny: (marketHashName: string, rawValue: string) => void;
  buffPriceCny: number;
  buffPriceError?: string;
  isBuffLoading: boolean;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  steamPrice: number;
}

export function ManualItemRow({
  item,
  table,
  updateManualItemQty,
  removeItem,
  fetchBuffPrice,
  updateBuffPriceCny,
  buffPriceCny,
  buffPriceError,
  isBuffLoading,
  buffCnyToVndRate,
  rateAll,
  rateLe,
  steamPrice,
}: ManualItemRowProps) {
  return (
    <tr
      className="border-l-2 border-l-blue-500 bg-blue-500/[0.04] transition-colors hover:bg-blue-500/[0.08]"
    >
      {table.getColumn("case")?.getIsVisible() && (
        <td className="px-5 py-4">
          <div className="flex items-center gap-3.5">
            <a
              href={item.steamMarketUrl ?? getSteamMarketListingUrl(item.caseItem.marketHashName)}
              target="_blank"
              rel="noreferrer"
              className="group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-800 bg-stone-900 transition-all duration-300 hover:scale-[1.06] hover:border-blue-500/40 hover:shadow-lg active:scale-95"
              title="Mở trên Steam Market"
            >
              <CaseThumbnail imageUrl={item.caseItem.imageUrl ?? undefined} name={item.caseItem.name} size="lg" />
              <span
                className="absolute inset-x-0 bottom-0 h-1"
                style={{
                  backgroundColor:
                    item.type === "Capsule" || item.type === "Case"
                      ? "#b0c3d9"
                      : item.rarity?.color ?? getItemTypeColor(item.type),
                }}
              />
            </a>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <a
                    href={item.steamMarketUrl ?? getSteamMarketListingUrl(item.caseItem.marketHashName)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-[24rem] items-center gap-1.5 truncate font-medium font-semibold text-stone-200 hover:text-blue-300"
                  >
                    <span className="truncate">{item.caseItem.name}</span>
                  </a>
                  <CopyButton value={item.caseItem.marketHashName} />
                </div>
                <span className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-blue-400 uppercase">
                  Thủ công
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  style={{
                    backgroundColor: colorWithAlpha(
                      item.type === "Capsule" || item.type === "Case"
                        ? "#b0c3d9"
                        : item.rarity?.color ?? getItemTypeColor(item.type),
                      0.14
                    ),
                    color:
                      item.type === "Capsule" || item.type === "Case"
                        ? "#b0c3d9"
                        : item.rarity?.color ?? getItemTypeColor(item.type),
                  }}
                >
                  {item.type}
                </span>
                {item.rarity ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-300">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: item.rarity.color }} />
                    {item.rarity.name}
                  </span>
                ) : null}
              </div>

              {/* Display manual entry metadata */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                {item.buyPrice && (
                  <span className="font-medium text-blue-400/90">Giá mua: {formatVND(item.buyPrice)}</span>
                )}
                {item.buyDate && (
                  <span>· Ngày: {item.buyDate.split("-").reverse().join("/")}</span>
                )}
                {item.sourceAccounts && item.sourceAccounts.length > 0 && (
                  <span className="max-w-[12rem] truncate" title={item.sourceAccounts[0].name}>
                    · TK: {item.sourceAccounts[0].name}
                  </span>
                )}
                {item.storageUnitId && (
                  <span className="rounded border border-blue-500/25 bg-blue-500/10 px-1.5 text-[10px] font-medium tracking-wide text-stone-400 uppercase">
                    {item.storageUnitName || "Storage Unit"}
                  </span>
                )}
              </div>

              {item.type === "Skin" && !(Number.isFinite(buffPriceCny) && buffPriceCny > 0) && steamPrice > 5000 && (
                <Button
                  type="button"
                  onClick={() => fetchBuffPrice(item.caseItem.marketHashName)}
                  disabled={isBuffLoading}
                  className="mt-1.5 inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 text-[11px] font-semibold text-blue-200 hover:border-blue-400 hover:bg-blue-500/20 disabled:cursor-wait disabled:opacity-60"
                >
                  {isBuffLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                  Lấy giá BUFF163
                </Button>
              )}

              {item.type === "Skin" && Number.isFinite(buffPriceCny) && buffPriceCny > 0 && (
                <Button
                  type="button"
                  onClick={() => updateBuffPriceCny(item.caseItem.marketHashName, "")}
                  className="mt-1.5 inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-md border border-stone-700 bg-stone-850 px-2.5 text-[11px] font-semibold text-stone-300 hover:border-stone-600 hover:bg-stone-800"
                >
                  Lấy giá Steam
                </Button>
              )}
            </div>
          </div>
        </td>
      )}
      {table.getColumn("quantity")?.getIsVisible() && (
        <td className="px-5 py-4">
          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              onClick={() => updateManualItemQty(item.id || item.caseItem.marketHashName, item.quantity - 1)}
              className="inline-flex size-6 items-center justify-center rounded bg-stone-800 font-bold text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200"
            >
              -
            </Button>
            <span className="w-8 text-center font-bold text-blue-400">{item.quantity}</span>
            <Button
              type="button"
              onClick={() => updateManualItemQty(item.id || item.caseItem.marketHashName, item.quantity + 1)}
              className="inline-flex size-6 items-center justify-center rounded bg-stone-800 font-bold text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200"
            >
              +
            </Button>
          </div>
        </td>
      )}
      {table.getColumn("price")?.getIsVisible() && (
        <td className="px-5 py-4">
          {item.type !== "Skin" ? (
            <div className="flex min-h-[3rem] flex-col items-end justify-center text-right">
              <span className="text-[13px] font-medium text-stone-300">{formatVND(item.price)}</span>
              {item.buyPrice && item.buyPrice > 0 ? (
                <span className="mt-0.5 text-[10px] font-medium text-blue-400/90">
                  Mua: {formatVND(item.buyPrice)}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[3rem] w-full flex-col items-end justify-center gap-1">
              <span className="text-[13px] font-medium text-stone-300">
                {formatVND(steamPrice)}{" "}
                <span className="text-[10px] font-normal text-stone-500">Steam</span>
              </span>
              {buffPriceCny > 0 ? (
                <span className="text-xs font-semibold text-blue-300">
                  ¥{formatPlainNumber(buffPriceCny)} × {formatPlainNumber(buffCnyToVndRate)} ={" "}
                  {formatVND(Math.round(buffPriceCny * buffCnyToVndRate))}{" "}
                  <span className="text-[9px] font-normal text-blue-400/70">Buff</span>
                </span>
              ) : (
                <span className="text-xs text-stone-500">Buff: Chưa có giá</span>
              )}
              {item.buyPrice && item.buyPrice > 0 ? (
                <span className="text-[10px] font-medium text-blue-400/90">
                  Mua: {formatVND(item.buyPrice)}
                </span>
              ) : null}
              {buffPriceError ? (
                <span className="mt-1 max-w-44 text-right text-[11px] text-red-300">
                  {buffPriceError}
                </span>
              ) : null}
            </div>
          )}
        </td>
      )}
      {table.getColumn("total")?.getIsVisible() && (
        <td className="px-5 py-4 text-right font-medium text-emerald-400">{formatVND(item.total)}</td>
      )}
      {table.getColumn("rateAll")?.getIsVisible() && (
        <td className="px-5 py-4 text-right font-medium text-blue-300">
          {formatVND(item.priceSource === "buff163" ? item.total : (item.total * rateAll) / 100)}
        </td>
      )}
      {table.getColumn("rateLe")?.getIsVisible() && (
        <td className="px-5 py-4 text-right font-medium text-violet-300">
          {formatVND(item.priceSource === "buff163" ? item.total : (item.total * rateLe) / 100)}
        </td>
      )}
      {table.getColumn("actions")?.getIsVisible() && (
        <td className="px-5 py-4 text-center">
          <Button
            type="button"
            onClick={() => removeItem(item.caseItem.marketHashName, true, item.id)}
            className="inline-flex size-8 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-red-950/30 hover:text-red-400"
            title="Xóa khỏi danh sách"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </td>
      )}
    </tr>
  );
}
