import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Loader2, Trash2 } from "lucide-react";
import { FaSteam, FaCoins } from "react-icons/fa";
import * as HoverCard from "@radix-ui/react-hover-card";
import { motion } from "framer-motion";

import { Tooltip } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/ui/actions";
import { CaseThumbnail } from "@/components/portfolio";
import type { ScanResultItem } from "./types";
import { Button } from "@/components/ui/button";
import {
  getSteamMarketListingUrl,
  getItemTypeColor,
  colorWithAlpha,
  formatVND,
  formatPlainNumber,
} from "./utils";

export type BuildInventoryColumnsParams = {
  buffLoadingKeys: Set<string>;
  buffPricesCny: Record<string, number>;
  buffPriceErrors: Record<string, string>;
  fetchBuffPrice: (marketHashName: string) => void;
  updateBuffPriceCny: (marketHashName: string, rawValue: string) => void;
  buffCnyToVndRate: number;
  rateAll: number;
  rateLe: number;
  removeItem: (marketHashName: string) => void;
  mergedRawItems?: ScanResultItem[];
};

export function buildInventoryColumns({
  buffLoadingKeys,
  buffPricesCny,
  buffPriceErrors,
  fetchBuffPrice,
  updateBuffPriceCny,
  buffCnyToVndRate,
  rateAll,
  rateLe,
  removeItem,
  mergedRawItems,
}: BuildInventoryColumnsParams): ColumnDef<ScanResultItem>[] {
  return [
    {
      id: "case",
      header: "Item",
      accessorFn: (row) => row.caseItem.name,
      cell: ({ row }) => {
        const isSkin = row.original.type === "Skin";
        const marketHashName = row.original.caseItem.marketHashName;
        const isLoadingBuff = buffLoadingKeys.has(marketHashName);
        const buffPriceCny =
          row.original.buffPriceCny ?? buffPricesCny[marketHashName];
        const hasBuffPrice = Number.isFinite(buffPriceCny) && buffPriceCny > 0;
        const rawItem = mergedRawItems?.find(
          (i) => i.caseItem.marketHashName === marketHashName,
        );
        const steamPrice = rawItem?.price ?? row.original.price ?? 0;
        const steamMarketUrl =
          row.original.steamMarketUrl ??
          getSteamMarketListingUrl(marketHashName);

        const consolidated = {
          tradeable: 0,
          onMarket: 0,
          tradeProtected: 0,
          hold: 0,
          holdDetails: [] as Array<{ quantity: number; holdDays: number }>,
        };
        if (row.original.sourceAccounts) {
          for (const acc of row.original.sourceAccounts) {
            if (acc.breakdown) {
              consolidated.tradeable += acc.breakdown.tradeable ?? 0;
              consolidated.onMarket += acc.breakdown.onMarket ?? 0;
              consolidated.tradeProtected += acc.breakdown.tradeProtected ?? 0;
              consolidated.hold += acc.breakdown.hold ?? 0;
              if (acc.breakdown.holdDetails) {
                consolidated.holdDetails.push(...acc.breakdown.holdDetails);
              }
            }
          }
        }

        const content = (
          <div className="flex items-center gap-3.5">
            <a
              href={steamMarketUrl}
              target="_blank"
              rel="noreferrer"
              className="group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-800 bg-stone-900 transition-all duration-300 hover:scale-[1.06] hover:border-blue-500/40 hover:shadow-lg active:scale-95"
              title="Mở trên Steam Market"
            >
              <CaseThumbnail
                imageUrl={row.original.caseItem.imageUrl ?? undefined}
                name={row.original.caseItem.name}
                size="lg"
              />
              <span
                className="absolute inset-x-0 bottom-0 h-1"
                style={{
                  backgroundColor:
                    row.original.type === "Capsule" ||
                    row.original.type === "Case"
                      ? "#b0c3d9"
                      : (row.original.rarity?.color ??
                        getItemTypeColor(row.original.type)),
                }}
              />
            </a>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <a
                  href={steamMarketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-[24rem] items-center gap-1.5 truncate font-medium font-semibold text-stone-200 hover:text-blue-300"
                >
                  <span className="truncate">{row.original.caseItem.name}</span>
                </a>
                <CopyButton value={marketHashName} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                  style={{
                    backgroundColor: colorWithAlpha(
                      row.original.type === "Capsule" ||
                        row.original.type === "Case"
                        ? "#b0c3d9"
                        : (row.original.rarity?.color ??
                            getItemTypeColor(row.original.type)),
                      0.14,
                    ),
                    color:
                      row.original.type === "Capsule" ||
                      row.original.type === "Case"
                        ? "#b0c3d9"
                        : (row.original.rarity?.color ??
                          getItemTypeColor(row.original.type)),
                  }}
                >
                  {row.original.type}
                </span>
                {row.original.rarity ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-300">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: row.original.rarity.color }}
                    />
                    {row.original.rarity.name}
                  </span>
                ) : null}
                {row.original.onMarket ? (
                  <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                    Market
                  </span>
                ) : null}
                {row.original.tradeProtected ? (
                  <span className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                    Trade Protected
                  </span>
                ) : null}
                {row.original.holdDays && row.original.holdDays > 0 ? (
                  <span className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
                    Hold {row.original.holdDays} ngày
                  </span>
                ) : null}
              </div>
              {isSkin && !hasBuffPrice && steamPrice > 5000 && (
                <Button
                  type="button"
                  onClick={() => fetchBuffPrice(marketHashName)}
                  disabled={isLoadingBuff}
                  className="mt-2 inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 text-[11px] font-semibold text-blue-200 hover:border-blue-400 hover:bg-blue-500/20 disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoadingBuff ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                  Lấy giá BUFF163
                </Button>
              )}
              {isSkin && hasBuffPrice && (
                <Button
                  type="button"
                  onClick={() => updateBuffPriceCny(marketHashName, "")}
                  className="mt-2 inline-flex h-7 w-fit items-center justify-center gap-1.5 rounded-md border border-stone-700 bg-stone-850 px-2.5 text-[11px] font-semibold text-stone-300 hover:border-stone-600 hover:bg-stone-800"
                >
                  Lấy giá Steam
                </Button>
              )}
            </div>
          </div>
        );

        if (!row.original.sourceAccounts?.length) {
          return content;
        }

        return (
          <HoverCard.Root openDelay={100} closeDelay={150}>
            <HoverCard.Trigger asChild>
              <div className="cursor-help outline-none">{content}</div>
            </HoverCard.Trigger>
            <HoverCard.Portal>
              <HoverCard.Content
                side="right"
                align="start"
                sideOffset={12}
                className="z-[100] outline-none"
                asChild
              >
                <motion.div
                  initial={{ opacity: 0, x: -8, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.25, 0, 1] }}
                  className="w-80 rounded-xl border border-stone-800 bg-[#0e121a] p-4 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur-md"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-stone-800/80 pb-2.5">
                    <div className="max-w-[14rem] truncate text-xs font-bold text-sky-400">
                      {row.original.caseItem.name}
                    </div>
                    <span className="text-[10px] font-medium text-stone-500">
                      Tổng: {row.original.quantity} item
                    </span>
                  </div>

                  {/* Consolidated breakdown */}
                  <div className="mb-3 space-y-2 border-b border-stone-800/80 pb-3 text-xs">
                    <div className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                      Phân loại trạng thái
                    </div>
                    {consolidated.tradeable > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          <span>Trade được ngay</span>
                        </span>
                        <span className="font-bold text-emerald-400">
                          {consolidated.tradeable}
                        </span>
                      </div>
                    )}
                    {consolidated.onMarket > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          <span>Đang treo Market</span>
                        </span>
                        <span className="font-bold text-amber-400">
                          {consolidated.onMarket}
                        </span>
                      </div>
                    )}
                    {consolidated.tradeProtected > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-cyan-400" />
                          <span>Trade Protected</span>
                        </span>
                        <span className="font-bold text-cyan-400">
                          {consolidated.tradeProtected}
                        </span>
                      </div>
                    )}
                    {consolidated.hold > 0 && (
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                          <span>Hold trade</span>
                        </span>
                        <span className="font-bold text-red-400">
                          {consolidated.hold}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Per-account list breakdown */}
                  <div className="max-h-48 space-y-2.5 overflow-y-auto pr-1 text-xs">
                    <div className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                      Chi tiết theo tài khoản
                    </div>
                    {row.original.sourceAccounts.map((account) => {
                      const accHold = account.breakdown?.hold ?? 0;
                      const accMarket = account.breakdown?.onMarket ?? 0;
                      const accProtected =
                        account.breakdown?.tradeProtected ?? 0;
                      const accTradeable = account.breakdown?.tradeable ?? 0;

                      return (
                        <div
                          key={account.steamId64}
                          className="border-stone-850 rounded border bg-stone-900/40 p-2"
                        >
                          <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-sky-300">
                            <span className="max-w-[12rem] truncate">
                              {account.name}
                            </span>
                            <span>x{account.quantity}</span>
                          </div>
                          <div className="space-y-1 text-[10px] text-stone-300">
                            {accTradeable > 0 && (
                              <div className="flex justify-between">
                                <span>Trade được:</span>
                                <span className="font-semibold text-emerald-400">
                                  {accTradeable}
                                </span>
                              </div>
                            )}
                            {accMarket > 0 && (
                              <div className="flex justify-between">
                                <span>Treo Market:</span>
                                <span className="font-semibold text-amber-400">
                                  {accMarket}
                                </span>
                              </div>
                            )}
                            {accProtected > 0 && (
                              <div className="flex justify-between">
                                <span>Trade Protected:</span>
                                <span className="font-semibold text-cyan-400">
                                  {accProtected}
                                </span>
                              </div>
                            )}
                            {accHold > 0 && (
                              <div className="flex justify-between">
                                <span>Hold trade:</span>
                                <span className="font-semibold text-red-400">
                                  {accHold}
                                </span>
                              </div>
                            )}
                            {account.breakdown?.holdDetails &&
                              account.breakdown.holdDetails.length > 0 && (
                                <div className="border-stone-850 mt-1.5 space-y-0.5 border-t pt-1 text-[9px] text-stone-400">
                                  {account.breakdown.holdDetails.map(
                                    (detail, dIdx) => (
                                      <div
                                        key={dIdx}
                                        className="flex justify-between"
                                      >
                                        <span>• Qty: {detail.quantity}</span>
                                        <span>Hold {detail.holdDays} ngày</span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </HoverCard.Content>
            </HoverCard.Portal>
          </HoverCard.Root>
        );
      },
    },
    {
      id: "quantity",
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex w-full items-center justify-end gap-1 hover:text-stone-100 font-semibold cursor-pointer focus:outline-none"
        >
          SL <ArrowUpDown className="size-3" />
        </button>
      ),
      accessorFn: (row) => row.quantity,
      cell: ({ row }) => (
        <div className="text-right font-bold text-stone-100 font-mono">
          {new Intl.NumberFormat("vi-VN").format(row.original.quantity)}
        </div>
      ),
    },
    {
      id: "price",
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex w-full items-center justify-end gap-1 hover:text-stone-100 font-semibold cursor-pointer focus:outline-none"
        >
          Đơn giá / Buff CNY <ArrowUpDown className="size-3" />
        </button>
      ),
      accessorFn: (row) => row.price,
      cell: ({ row }) => {
        if (row.original.type !== "Skin") {
          return (
            <div className="text-right font-mono text-stone-300">
              {formatVND(row.original.price)}
            </div>
          );
        }

        const marketHashName = row.original.caseItem.marketHashName;
        const buffPriceCny =
          row.original.buffPriceCny ?? buffPricesCny[marketHashName];
        const rawItem = mergedRawItems?.find(
          (i) => i.caseItem.marketHashName === marketHashName,
        );
        const steamPrice = rawItem?.price ?? 0;
        const hasBuffPrice = Number.isFinite(buffPriceCny) && buffPriceCny > 0;
        const buffError = buffPriceErrors[marketHashName];

        return (
          <div className="flex min-h-[3rem] w-full flex-col items-end justify-center">
            <div className="flex items-center justify-end gap-3">
              {/* Steam Price */}
              <Tooltip content="Giá Steam">
                <div className="group relative flex cursor-help items-center gap-1.5">
                  <span className="text-[13px] font-medium text-stone-300 font-mono">
                    {formatVND(steamPrice)}
                  </span>
                  <FaSteam className="size-3.5 text-slate-400 transition-colors group-hover:text-sky-400" />
                </div>
              </Tooltip>

              {hasBuffPrice && (
                <span className="text-stone-700 select-none">|</span>
              )}

              {hasBuffPrice && (
                <Tooltip
                  content={
                    <>
                      Giá Buff (¥{formatPlainNumber(buffPriceCny)} ×{" "}
                      {formatPlainNumber(buffCnyToVndRate)})
                    </>
                  }
                >
                  <div className="group relative flex cursor-help items-center gap-1.5">
                    <span className="text-xs font-semibold text-blue-400 font-mono">
                      {formatVND(Math.round(buffPriceCny * buffCnyToVndRate))}
                    </span>
                    <FaCoins className="size-3.5 text-blue-400 opacity-80 transition-opacity group-hover:opacity-100" />
                  </div>
                </Tooltip>
              )}
            </div>
            {buffError ? (
              <span className="mt-1 max-w-44 text-right text-[11px] text-red-350">
                {buffError}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "total",
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex w-full items-center justify-end gap-1 hover:text-stone-100 font-semibold cursor-pointer focus:outline-none"
        >
          Tổng (100%) <ArrowUpDown className="size-3" />
        </button>
      ),
      accessorFn: (row) => row.total,
      cell: ({ row }) => (
        <div className="text-right font-bold text-emerald-450 font-mono">
          {formatVND(row.original.total)}
        </div>
      ),
    },
    {
      id: "rateAll",
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex w-full items-center justify-end gap-1 text-blue-400 hover:text-blue-300 font-semibold cursor-pointer focus:outline-none"
        >
          Sỉ ({rateAll}%) <ArrowUpDown className="size-3" />
        </button>
      ),
      accessorFn: (row) =>
        row.priceSource === "buff163" ? row.total : (row.total * rateAll) / 100,
      cell: ({ row }) => (
        <div className="text-right font-medium text-blue-300 font-mono">
          {formatVND(
            row.original.priceSource === "buff163"
              ? row.original.total
              : (row.original.total * rateAll) / 100,
          )}
        </div>
      ),
    },
    {
      id: "rateLe",
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex w-full items-center justify-end gap-1 text-violet-400 hover:text-violet-300 font-semibold cursor-pointer focus:outline-none"
        >
          Lẻ ({rateLe}%) <ArrowUpDown className="size-3" />
        </button>
      ),
      accessorFn: (row) =>
        row.priceSource === "buff163" ? row.total : (row.total * rateLe) / 100,
      cell: ({ row }) => (
        <div className="text-right font-medium text-violet-350 font-mono">
          {formatVND(
            row.original.priceSource === "buff163"
              ? row.original.total
              : (row.original.total * rateLe) / 100,
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Tooltip content="Xóa khỏi danh sách">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeItem(row.original.caseItem.marketHashName)}
            className="size-8 rounded-md text-stone-500 transition-colors hover:bg-red-950/35 hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </Tooltip>
      ),
      enableSorting: false,
    },
  ];
}
