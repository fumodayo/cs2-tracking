"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbUser,
  TbPackage,
  TbTag,
  TbCalendar,
  TbShield,
  TbCircleCheck,
} from "react-icons/tb";
import { ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useCurrency } from "@/components/currency-provider";
import { formatDateVi, calculateTradeHoldUntil } from "@/utils/date";
import { PortfolioTableRow } from "../portfolio-table-model";
import { TradeHoldBadge } from "./trade-hold-badge";

interface ItemLotsListProps {
  relatedRows: PortfolioTableRow[];
  onUpdateQuantity?: (id: string, quantity: number) => Promise<void> | void;
  onUpdateBuyPrice?: (id: string, buyPrice: number) => Promise<void> | void;
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
  onDelete?: (id: string) => void;
  embedded?: boolean;
  onSelectOpenChange?: (open: boolean) => void;
}

export function ItemLotsList({
  relatedRows,
  onUpdateQuantity,
  onUpdateBuyPrice,
  onUpdateNote,
  onUpdateLot,
  onDelete,
  embedded = false,
  onSelectOpenChange,
}: ItemLotsListProps) {
  const { formatCurrency } = useCurrency();
  const [showDetails, setShowDetails] = useState(embedded);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);

  // Active lot editing form states
  const [editQty, setEditQty] = useState("");
  const [editPriceVnd, setEditPriceVnd] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editStorageUnitId, setEditStorageUnitId] = useState("");
  const [editState, setEditState] = useState<"tradeable" | "hold" | "protected">("tradeable");
  const [editHoldDays, setEditHoldDays] = useState("");
  const [savingLot, setSavingLot] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ["portfolio-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      return data as Array<{ id: string; steamId64: string; name: string }>;
    },
  });

  const storageUnitsQuery = useQuery({
    queryKey: ["portfolio-storage-units", editAccountId],
    queryFn: async () => {
      if (!editAccountId) return [];
      const res = await fetch(
        `/api/portfolio/storage-units?steamId64=${editAccountId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch storage units");
      const data = await res.json();
      return data.storageUnits as Array<{
        id: string;
        name: string;
        currentCount: number;
      }>;
    },
    enabled: !!editAccountId,
  });

  const startEditingLot = (lot: PortfolioTableRow) => {
    setEditingLotId(lot.id);
    setEditQty(String(lot.quantity));
    setEditPriceVnd(String(lot.buyPrice));
    setEditNote(lot.note ?? "");

    const steamId = lot.sourceAccounts?.[0]?.steamId64 ?? "";
    setEditAccountId(steamId);
    setEditStorageUnitId(lot.storageUnitId ?? "");

    const lotHoldDays = (() => {
      if (!lot.tradeHoldUntil) return 0;
      const parsedHoldUntil = new Date(lot.tradeHoldUntil);
      if (isNaN(parsedHoldUntil.getTime())) return 0;
      const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    })();

    const isProtected = Boolean(
      lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
      lot.sourceAccounts[0].breakdown.tradeProtected > 0
    );

    if (isProtected) {
      setEditState("protected");
      setEditHoldDays(lotHoldDays > 0 ? String(lotHoldDays) : "");
    } else if (lotHoldDays > 0) {
      setEditState("hold");
      setEditHoldDays(String(lotHoldDays));
    } else {
      setEditState("tradeable");
      setEditHoldDays("");
    }
  };

  const saveLot = async (lotId: string) => {
    const nextQuantity = Math.round(Number(editQty));
    const nextBuyPrice = Math.round(Number(editPriceVnd));
    if (
      !Number.isFinite(nextQuantity) ||
      nextQuantity <= 0 ||
      !Number.isFinite(nextBuyPrice) ||
      nextBuyPrice <= 0
    )
      return;

    setSavingLot(true);
    try {
      if (onUpdateLot) {
        let sourceAccounts = undefined;
        if (editAccountId) {
          const selectedAccount = accountsQuery.data?.find(
            (acc) => acc.steamId64 === editAccountId
          );
          if (selectedAccount) {
            const breakdown = {
              tradeable: editState === "tradeable" ? nextQuantity : 0,
              onMarket: 0,
              tradeProtected: editState === "protected" ? nextQuantity : 0,
              hold: editState === "hold" ? nextQuantity : 0,
              holdDetails:
                editState === "hold" || editState === "protected"
                  ? [
                      {
                        quantity: nextQuantity,
                        holdDays: Number(editHoldDays) || 0,
                      },
                    ]
                  : [],
            };
            sourceAccounts = [
              {
                steamId64: editAccountId,
                name: selectedAccount.name,
                breakdown,
              },
            ];
          }
        } else {
          sourceAccounts = [];
        }

        let tradeHoldUntil = null;
        if (
          (editState === "hold" || editState === "protected") &&
          editHoldDays
        ) {
          const days = Number(editHoldDays) || 0;
          if (days > 0) {
            const targetLot = relatedRows.find((r) => r.id === lotId);
            const baseDate = (targetLot && targetLot.buyDate) ? new Date(targetLot.buyDate) : new Date();
            const holdDate = calculateTradeHoldUntil(baseDate, days);
            tradeHoldUntil = holdDate.toISOString();
          }
        }

        await onUpdateLot(lotId, {
          quantity: nextQuantity,
          buyPrice: nextBuyPrice,
          note: editNote,
          sourceAccounts,
          storageUnitId: editStorageUnitId || "",
          tradeHoldUntil,
        });
      } else {
        if (onUpdateQuantity) await onUpdateQuantity(lotId, nextQuantity);
        if (onUpdateBuyPrice) await onUpdateBuyPrice(lotId, nextBuyPrice);
        if (onUpdateNote) await onUpdateNote(lotId, editNote);
      }
      setEditingLotId(null);
    } finally {
      setSavingLot(false);
    }
  };

  return (
    <div className="space-y-3 pr-1">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="group flex w-full cursor-pointer items-center justify-between py-2 text-left text-[10px] font-bold tracking-wider text-slate-400 uppercase transition-colors hover:text-slate-200 focus:outline-none"
      >
        <span className="flex items-center gap-1.5">
          <TbTag className="size-3.5 text-slate-400" />
          Chi tiết các đợt scan / mua ({relatedRows.length} đợt)
        </span>
        <span className="text-slate-400 transition-transform duration-200 group-hover:text-slate-200">
          {showDetails ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.25, 0, 1] }}
            className="overflow-hidden"
          >
            <div
              className={`mt-2 space-y-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-700/80 ${
                embedded ? "max-h-[32rem] overflow-y-auto" : "max-h-[18rem] overflow-y-auto"
              }`}
            >
              {relatedRows.map((lot) => {
                const isEditing = editingLotId === lot.id;
                const formattedDate = lot.buyDate
                  ? formatDateVi(lot.buyDate)
                  : "Chưa rõ ngày";
                const accountName = lot.sourceAccounts?.[0]?.name;

                const isProtected = Boolean(
                  lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
                  lot.sourceAccounts[0].breakdown.tradeProtected > 0
                );
                const suDetail = lot.storageUnitDetails?.find(
                  (d) => d.storageUnitId === lot.storageUnitId
                );
                const suName =
                  suDetail?.storageUnitName ||
                  storageUnitsQuery.data?.find((su) => su.id === lot.storageUnitId)?.name;

                return (
                  <div
                    key={lot.id}
                    className={`group relative space-y-2.5 rounded-xl border transition duration-200 ${
                      isEditing
                        ? "border-slate-750 bg-slate-900/20 p-4 shadow-lg shadow-black/35"
                        : "border-slate-800/40 bg-slate-950/20 p-3 hover:border-slate-800 hover:bg-slate-900/10"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        {lot.sourceType === "existing" && (
                          <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-[10px] font-bold text-cyan-400 select-none">
                            <span className="flex items-center gap-1.5">
                              <TbShield className="size-3.5" />
                              ĐÃ SCAN TỪ INVENTORY
                            </span>
                            <span className="text-[9px] font-medium text-cyan-400/80">
                              Chỉ cho phép sửa đơn giá & ghi chú
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              Số lượng
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                disabled={lot.sourceType === "existing"}
                                className="h-10 w-full [appearance:textfield] rounded-lg border border-slate-800 bg-slate-950/40 pr-3 pl-12 text-right text-sm font-semibold text-slate-100 placeholder-slate-600 transition duration-200 hover:border-slate-750/80 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none disabled:opacity-50 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <span className="pointer-events-none absolute left-2.5 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                                QTY
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              Giá mua VND
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                value={editPriceVnd}
                                onChange={(e) => setEditPriceVnd(e.target.value)}
                                className="h-10 w-full [appearance:textfield] rounded-lg border border-slate-800 bg-slate-950/40 pr-3 pl-12 text-right text-sm font-semibold text-slate-100 placeholder-slate-600 transition duration-200 hover:border-slate-750/80 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <span className="pointer-events-none absolute left-2.5 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                                VND
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              Tài khoản sở hữu
                            </label>
                            <Select
                              value={editAccountId || "__manual__"}
                              onValueChange={(val) => {
                                setEditAccountId(val === "__manual__" ? "" : val);
                                setEditStorageUnitId("");
                              }}
                              disabled={lot.sourceType === "existing"}
                              onOpenChange={onSelectOpenChange}
                            >
                              <Select.Trigger className="h-10 rounded-lg border-slate-800 bg-slate-950/40 text-sm text-slate-200 hover:border-slate-750/80 focus:border-sky-500/60 transition disabled:opacity-50 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-500">
                                <Select.Value placeholder="Thủ công (Không liên kết)" />
                              </Select.Trigger>
                              <Select.Content className="border-slate-850 bg-[#0e121a]">
                                <Select.Item value="__manual__">
                                  Thủ công (Không liên kết)
                                </Select.Item>
                                {accountsQuery.data?.map((acc) => (
                                  <Select.Item key={acc.steamId64} value={acc.steamId64}>
                                    {acc.name}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              Lưu trữ ở
                            </label>
                            <Select
                              value={editStorageUnitId || "__inventory__"}
                              onValueChange={(val) =>
                                setEditStorageUnitId(val === "__inventory__" ? "" : val)
                              }
                              disabled={lot.sourceType === "existing" || !editAccountId}
                              onOpenChange={onSelectOpenChange}
                            >
                              <Select.Trigger className="h-10 rounded-lg border-slate-800 bg-slate-950/40 text-sm text-slate-200 hover:border-slate-750/80 focus:border-sky-500/60 transition disabled:opacity-50 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-500">
                                <Select.Value
                                  placeholder={
                                    !editAccountId
                                      ? "Chọn tài khoản trước"
                                      : "Hòm đồ cá nhân (Inventory)"
                                  }
                                />
                              </Select.Trigger>
                              <Select.Content className="border-slate-850 bg-[#0e121a]">
                                <Select.Item value="__inventory__">
                                  Hòm đồ cá nhân (Inventory)
                                </Select.Item>
                                {storageUnitsQuery.data?.map((su) => (
                                  <Select.Item key={su.id} value={su.id}>
                                    {su.name} ({su.currentCount} items)
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className={editState === "hold" || editState === "protected" ? "flex flex-col gap-1.5" : "col-span-2 flex flex-col gap-1.5"}>
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                              Trạng thái
                            </label>
                            <Select
                              value={editState}
                              onValueChange={(val) =>
                                setEditState(val as "tradeable" | "hold" | "protected")
                              }
                              disabled={lot.sourceType === "existing"}
                              onOpenChange={onSelectOpenChange}
                            >
                              <Select.Trigger className="h-10 rounded-lg border-slate-800 bg-slate-950/40 text-sm text-slate-200 hover:border-slate-750/80 focus:border-sky-500/60 transition disabled:opacity-50 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-500">
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content className="border-slate-850 bg-[#0e121a]">
                                <Select.Item value="tradeable">Trade được ngay</Select.Item>
                                <Select.Item value="hold">Hold trade</Select.Item>
                                <Select.Item value="protected">Trade Protected</Select.Item>
                              </Select.Content>
                            </Select>
                          </div>
                          {(editState === "hold" || editState === "protected") && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                                Số ngày hold
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  value={editHoldDays}
                                  onChange={(e) => setEditHoldDays(e.target.value)}
                                  placeholder="Ví dụ: 7"
                                  disabled={lot.sourceType === "existing"}
                                  className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/40 pr-3 pl-14 text-sm font-semibold text-slate-100 placeholder-slate-600 transition duration-200 hover:border-slate-750/80 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none disabled:opacity-50 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed"
                                />
                                <span className="pointer-events-none absolute left-2.5 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                                  HOLD
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Ghi chú
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/40 pr-3 pl-14 text-sm font-medium text-slate-100 placeholder-slate-650 transition duration-200 hover:border-slate-750/80 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none"
                            />
                            <span className="pointer-events-none absolute left-2.5 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                              NOTE
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            onClick={() => setEditingLotId(null)}
                            className="h-10 cursor-pointer rounded-lg border border-slate-800 bg-slate-900/10 px-4 text-sm font-bold text-slate-300 shadow-sm transition hover:border-slate-750 hover:bg-slate-900/35 hover:text-slate-100 active:scale-[0.98]"
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            disabled={savingLot}
                            onClick={() => saveLot(lot.id)}
                            className="h-10 cursor-pointer rounded-lg bg-rose-600 px-5 text-sm font-bold text-white shadow-[0_0_12px_rgba(225,29,72,0.2)] transition hover:bg-rose-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-900/50 disabled:text-stone-600 disabled:border disabled:border-stone-850/50 disabled:shadow-none"
                          >
                            {savingLot ? "Đang lưu..." : "Lưu"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="text-sm font-extrabold text-slate-100">
                              {lot.quantity}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 mr-1.5">
                              vật phẩm
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">@</span>
                            <span className="text-sm font-extrabold text-emerald-400">
                              {formatCurrency(lot.buyPrice)}
                            </span>
                            <span className="mx-1 text-slate-700">•</span>
                            {isProtected ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400">
                                <TbShield className="size-2.5" />
                                Protected
                              </span>
                            ) : lot.tradeHoldUntil ? (
                              <TradeHoldBadge tradeHoldUntil={lot.tradeHoldUntil} size="sm" />
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                <TbCircleCheck className="size-2.5" />
                                Trade được ngay
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 border border-slate-800/30">
                              <TbCalendar className="size-3 text-slate-500" />{" "}
                              {formattedDate}
                            </span>
                            {accountName && (
                              <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded bg-sky-500/5 border border-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400">
                                <TbUser className="size-2.5 text-sky-400" /> {accountName}
                              </span>
                            )}
                            {suName && (
                              <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                <TbPackage className="size-2.5 text-amber-400" /> {suName}
                              </span>
                            )}
                            {lot.note && !lot.note.toLowerCase().includes("scanner") && (
                              <span
                                className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400"
                                title={lot.note}
                              >
                                <TbTag className="size-2.5 text-emerald-400" /> {lot.note}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            onClick={() => startEditingLot(lot)}
                            className="h-7 w-7 rounded-lg border border-slate-800/80 bg-slate-950/40 p-0 text-slate-400 hover:border-slate-750 hover:bg-slate-900/50 hover:text-slate-200 transition-all cursor-pointer flex items-center justify-center"
                            title="Sửa đợt này"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          {onDelete && (
                            <Button
                              type="button"
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Bạn có chắc chắn muốn xóa đợt mua này (${
                                      lot.quantity
                                    } vật phẩm @ ${formatCurrency(lot.buyPrice)}) không?`
                                  )
                                ) {
                                  await onDelete(lot.id);
                                }
                              }}
                              className="h-7 w-7 rounded-lg border border-slate-800/80 bg-slate-950/40 p-0 text-slate-400 hover:border-rose-900/40 hover:bg-rose-950/30 hover:text-rose-400 transition-all cursor-pointer flex items-center justify-center"
                              title="Xóa đợt này"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
