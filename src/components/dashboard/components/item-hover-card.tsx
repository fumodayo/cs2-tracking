"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { TbUser, TbPackage, TbTag, TbCalendar, TbShield, TbClock, TbCircleCheck, TbCoins, TbHash, TbFileText, TbRefresh } from "react-icons/tb";
import { ChevronDown, ChevronUp, Trash2, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { CaseThumbnail } from "../case-thumbnail";

import { useCurrency } from "@/components/currency-provider";
import {
  formatDateVi,
  getHoldDaysRemaining,
} from "@/utils/date";

import {
  PortfolioTableRow,
  getItemStatusBreakdown,
} from "../portfolio-table-model";

import {
  formatSourceAccountTitle,
  getItemTypeColor,
  getItemTypeLabel,
  colorWithAlpha,
  toInputNumber,
} from "../portfolio-table-utils";

export function ItemHoverCard({
  item,
  relatedRows,
  onUpdateQuantity,
  onUpdateBuyPrice,
  onUpdateNote,
  onUpdateLot,
  onUpdateBuffRate,
  fetchBuffPrice,
  buffLoadingKeys,
  buffCnyToVndRate,
  buffPricesCny,
  onUpdateBuffPrice,
  onDelete,
  deletingId,
  embedded = false,
  onSelectOpenChange,
}: {
  item: PortfolioTableRow;
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
  onUpdateBuffRate?: (rate: number) => void;
  fetchBuffPrice?: (marketHashName: string) => void;
  buffLoadingKeys?: Set<string>;
  buffCnyToVndRate?: number;
  buffPricesCny?: Record<string, number>;
  onUpdateBuffPrice?: (marketHashName: string, priceCny: number | null) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  embedded?: boolean;
  onSelectOpenChange?: (open: boolean) => void;
}) {
  const { formatCurrency } = useCurrency();
  const [quantity, setQuantity] = useState(() => String(item.quantity));
  const [priceCny, setPriceCny] = useState(() =>
    toInputNumber(item.buyPrice / (buffCnyToVndRate ?? 3600)),
  );
  const [buyRate, setBuyRate] = useState(() =>
    toInputNumber(buffCnyToVndRate ?? 3600),
  );
  const [priceVnd, setPriceVnd] = useState(() => toInputNumber(item.buyPrice));
  const [note, setNote] = useState(() => item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPriceVnd, setEditPriceVnd] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingLot, setSavingLot] = useState(false);
  const [showDetails, setShowDetails] = useState(embedded);

  const initialHoldDays = useMemo(() => {
    if (!item.tradeHoldUntil) return 0;
    const parsedHoldUntil = new Date(item.tradeHoldUntil);
    if (isNaN(parsedHoldUntil.getTime())) return 0;
    const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [item.tradeHoldUntil]);

  const initialIsProtected = Boolean(
    item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
    item.sourceAccounts[0].breakdown.tradeProtected > 0,
  );

  const [editAccountId, setEditAccountId] = useState(
    () => item.sourceAccounts?.[0]?.steamId64 ?? "",
  );
  const [editStorageUnitId, setEditStorageUnitId] = useState(
    () => item.storageUnitId ?? "",
  );
  const [editState, setEditState] = useState<
    "tradeable" | "hold" | "protected"
  >(() =>
    initialIsProtected
      ? "protected"
      : initialHoldDays > 0
        ? "hold"
        : "tradeable",
  );
  const [editHoldDays, setEditHoldDays] = useState(() =>
    initialHoldDays > 0 ? String(initialHoldDays) : "",
  );

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

    const isProtected =
      lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
      lot.sourceAccounts[0].breakdown.tradeProtected > 0;

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
            (acc) => acc.steamId64 === editAccountId,
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
            const holdDate = new Date();
            holdDate.setDate(holdDate.getDate() + days);
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

  const isVirtual = item.sourceType === "existing" && item.isVirtual;

  useEffect(() => {
    setQuantity(String(item.quantity));
    setPriceVnd(toInputNumber(item.buyPrice));
    setPriceCny(toInputNumber(item.buyPrice / (buffCnyToVndRate ?? 3600)));
    setNote(item.note ?? "");

    const steamId = item.sourceAccounts?.[0]?.steamId64 ?? "";
    setEditAccountId(steamId);
    setEditStorageUnitId(item.storageUnitId ?? "");

    const lotHoldDays = (() => {
      if (!item.tradeHoldUntil) return 0;
      const parsedHoldUntil = new Date(item.tradeHoldUntil);
      if (isNaN(parsedHoldUntil.getTime())) return 0;
      const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    })();

    const isProtected = Boolean(
      item.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
      item.sourceAccounts[0].breakdown.tradeProtected > 0,
    );
    if (isProtected) {
      setEditState("protected");
      setEditHoldDays("");
    } else if (lotHoldDays > 0) {
      setEditState("hold");
      setEditHoldDays(String(lotHoldDays));
    } else {
      setEditState("tradeable");
      setEditHoldDays("");
    }
  }, [
    item.quantity,
    item.buyPrice,
    item.note,
    buffCnyToVndRate,
    item.sourceAccounts,
    item.storageUnitId,
    item.tradeHoldUntil,
  ]);

  function updateCny(value: string) {
    setPriceCny(value);
    const cny = Number(value);
    const nextRate = Number(buyRate);
    if (Number.isFinite(cny) && Number.isFinite(nextRate)) {
      setPriceVnd(toInputNumber(Math.round(cny * nextRate)));
    }
  }

  function updateBuyRate(value: string) {
    setBuyRate(value);
    const cny = Number(priceCny);
    const nextRate = Number(value);
    if (Number.isFinite(cny) && Number.isFinite(nextRate)) {
      setPriceVnd(toInputNumber(Math.round(cny * nextRate)));
    }
  }

  function updateVnd(value: string) {
    setPriceVnd(value);
    const vnd = Number(value);
    const nextRate = Number(buyRate);
    if (Number.isFinite(vnd) && Number.isFinite(nextRate) && nextRate > 0) {
      setPriceCny(toInputNumber(vnd / nextRate));
    }
  }

  async function submit() {
    const nextQuantity = Math.round(Number(quantity));
    const nextBuyPrice = Math.round(Number(priceVnd));
    if (
      !Number.isFinite(nextQuantity) ||
      nextQuantity <= 0 ||
      !Number.isFinite(nextBuyPrice) ||
      nextBuyPrice <= 0
    )
      return;

    setSaving(true);
    try {
      if (onUpdateLot) {
        let sourceAccounts = undefined;
        if (editAccountId) {
          const selectedAccount = accountsQuery.data?.find(
            (acc) => acc.steamId64 === editAccountId,
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
            const holdDate = new Date();
            holdDate.setDate(holdDate.getDate() + days);
            tradeHoldUntil = holdDate.toISOString();
          }
        }

        const targetId = relatedRows.length === 1 ? relatedRows[0].id : item.id;

        await onUpdateLot(targetId, {
          quantity: nextQuantity,
          buyPrice: nextBuyPrice,
          note: note,
          sourceAccounts,
          storageUnitId: editStorageUnitId || "",
          tradeHoldUntil,
        });
      } else {
        const targetId = relatedRows.length === 1 ? relatedRows[0].id : item.id;
        if (onUpdateQuantity && nextQuantity !== item.quantity) {
          await onUpdateQuantity(targetId, nextQuantity);
        }
        if (onUpdateBuyPrice && nextBuyPrice !== item.buyPrice) {
          await onUpdateBuyPrice(targetId, nextBuyPrice);
        }
        if (onUpdateNote && note !== (item.note ?? "")) {
          await onUpdateNote(targetId, note);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const isLoadingBuff = buffLoadingKeys?.has(item.case.marketHashName);

  const typeColor =
    item.itemType === "capsule" || item.itemType === "case"
      ? "#b0c3d9"
      : (item.case.rarity?.color ?? getItemTypeColor(item.itemType));

  const hasBuffPrice = Boolean(buffPricesCny?.[item.case.marketHashName]);
  const steamPriceVal = item.steamPrice ?? item.currentPrice ?? 0;
  const showBuffButton =
    item.itemType === "skin" &&
    steamPriceVal > 5000 &&
    (!hasBuffPrice || isLoadingBuff);

  if (isVirtual) {
    return (
      <div className="w-[25rem] text-left">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0e121a] text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80">
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full opacity-[0.08] blur-3xl"
            style={{ backgroundColor: typeColor }}
          />

          <div className="flex items-center gap-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-900/60 to-slate-900/10 px-4 py-4">
            <div className="group relative flex shrink-0 items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/80 p-1 shadow-inner">
              <CaseThumbnail
                imageUrl={item.case.imageUrl}
                name={item.case.name}
                size="lg"
              />
              <div
                className="absolute inset-0 -z-10 rounded-xl opacity-20 blur-md"
                style={{ backgroundColor: typeColor }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm leading-snug font-bold tracking-wide text-slate-100"
                title={item.case.name}
              >
                {item.case.name}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-500">
                <span>🔒 Chỉ lưu trong Storage Unit</span>
              </p>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            {item.storageUnitDetails && item.storageUnitDetails.length > 0 && (
              <div className="mb-3 space-y-1.5 border-b border-slate-800/80 pb-3 text-xs">
                <div className="mb-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Lưu trữ trong Storage Unit
                </div>
                {item.storageUnitDetails.map((su) => (
                  <div
                    key={su.storageUnitId}
                    className="flex items-center justify-between text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      <span>{su.storageUnitName}</span>
                    </span>
                    <span className="font-bold text-amber-400">
                      {su.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-slate-850 grid grid-cols-2 gap-3 rounded-lg border bg-slate-950/45 p-3 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Tổng số lượng
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-200">
                  {item.quantity} items
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Giá hiện tại
                </p>
                <p className="mt-0.5 text-sm font-bold text-emerald-400">
                  {formatCurrency(item.currentPrice ?? 0)}
                </p>
              </div>
              <div className="col-span-2 border-t border-slate-800/40 pt-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Tổng giá trị hiện tại
                </p>
                <p className="mt-0.5 text-base font-extrabold text-emerald-400">
                  {formatCurrency((item.currentPrice ?? 0) * item.quantity)}
                </p>
              </div>
            </div>

            <div className="border-stone-850 rounded-lg border bg-stone-950/20 p-3 text-xs leading-relaxed text-stone-400">
              💡 <strong>Lưu ý:</strong> Vật phẩm này chỉ tồn tại trong Storage
              Unit, không có trong inventory chính. Số lượng được đồng bộ tự
              động khi quét tài khoản Steam.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "w-full text-left min-h-full flex flex-col" : "w-[25rem] text-left"}>
      <div
        className={`relative overflow-hidden text-slate-100 transition-all duration-300 ${embedded ? "min-h-full flex flex-col flex-1" : "rounded-2xl border border-slate-800/80 bg-[#0e121a] shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl hover:border-slate-700/80"}`}
      >
        {!embedded && (
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full opacity-[0.08] blur-3xl"
            style={{ backgroundColor: typeColor }}
          />
        )}

        <div
          className={`flex items-center gap-4 border-b border-slate-800/60 px-4 py-4 ${
            embedded ? "sticky top-0 z-10 bg-[#0e121a]/95 backdrop-blur-md pt-5" : ""
          }`}
          style={{
            backgroundImage: `linear-gradient(to right, ${colorWithAlpha(typeColor, 0.1)}, rgba(9, 12, 22, 0.45))`,
          }}
        >
          <div className="group relative flex shrink-0 items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/80 p-1 shadow-inner">
            <CaseThumbnail
              imageUrl={item.case.imageUrl}
              name={item.case.name}
              size="lg"
            />
            <div
              className="absolute inset-0 -z-10 rounded-xl opacity-20 blur-md"
              style={{ backgroundColor: typeColor }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-sm leading-snug font-bold tracking-wide text-slate-100"
              title={item.case.name}
            >
              {item.case.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className="inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{
                  backgroundColor: colorWithAlpha(typeColor, 0.15),
                  borderColor: colorWithAlpha(typeColor, 0.3),
                  color: typeColor,
                }}
              >
                {getItemTypeLabel(item.itemType)}
              </span>
              {item.case.rarity ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                  <span
                    className="size-1.5 rounded-full shadow-sm"
                    style={{ backgroundColor: item.case.rarity.color }}
                  />
                  {item.case.rarity.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`p-4 ${embedded ? "flex-1" : ""}`}>
          {(() => {
            const combinedAccounts = new Map<
              string,
              {
                name: string;
                steamId64: string;
                total: number;
                tradeable: number;
                onMarket: number;
                tradeProtected: number;
                hold: number;
              }
            >();

            for (const r of relatedRows) {
              for (const acc of r.sourceAccounts) {
                const existing = combinedAccounts.get(acc.steamId64) || {
                  name: acc.name,
                  steamId64: acc.steamId64,
                  total: 0,
                  tradeable: 0,
                  onMarket: 0,
                  tradeProtected: 0,
                  hold: 0,
                };

                if (acc.breakdown) {
                  existing.total += acc.breakdown.tradeable ?? 0;
                  existing.total += acc.breakdown.onMarket ?? 0;
                  existing.total += acc.breakdown.tradeProtected ?? 0;
                  existing.total += acc.breakdown.hold ?? 0;

                  existing.tradeable += acc.breakdown.tradeable ?? 0;
                  existing.onMarket += acc.breakdown.onMarket ?? 0;
                  existing.tradeProtected += acc.breakdown.tradeProtected ?? 0;
                  existing.hold += acc.breakdown.hold ?? 0;
                } else {
                  const qty = r.quantity;
                  existing.total += qty;

                  const holdDays = (() => {
                    if (!r.tradeHoldUntil) return 0;
                    const parsedHoldUntil = new Date(r.tradeHoldUntil);
                    if (isNaN(parsedHoldUntil.getTime())) return 0;
                    const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    return Math.max(0, diffDays);
                  })();

                  if (holdDays > 0) {
                    existing.hold += qty;
                  } else {
                    existing.tradeable += qty;
                  }
                }

                combinedAccounts.set(acc.steamId64, existing);
              }
            }

            const mergedStats = Array.from(combinedAccounts.values()).filter(
              (a) => a.total > 0,
            );

            if (mergedStats.length === 0) return null;

            const totalQuantity = mergedStats.reduce((acc, curr) => acc + curr.total, 0);

            return (
              <div className="mb-5 space-y-3 border-b border-slate-800/60 pb-5">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  <span className="flex items-center gap-1.5">
                    <TbUser className="size-3.5 text-slate-400" />
                    Phân bổ tài khoản
                  </span>
                  <span className="rounded-full bg-slate-800/50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-slate-300">
                    {totalQuantity} tổng
                  </span>
                </div>
                <div className="space-y-2.5">
                  {mergedStats.map((accStats) => {
                    const percent = totalQuantity > 0 ? (accStats.total / totalQuantity) * 100 : 0;
                    return (
                      <div
                        key={accStats.steamId64}
                        className="group relative flex flex-col gap-2 rounded-xl border border-slate-800/40 bg-slate-950/20 p-3 transition duration-200 hover:border-slate-800 hover:bg-slate-900/10"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-200">
                            <span className="flex size-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                              <TbUser className="size-3.5" />
                            </span>
                            <span className="truncate max-w-[12rem]">{accStats.name}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-extrabold text-slate-100">
                              {accStats.total}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              ({percent.toFixed(0)}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1 w-full rounded-full bg-slate-900/60 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400/90 to-blue-500/90 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {/* Badges Breakdown */}
                        {(accStats.tradeable > 0 ||
                          accStats.onMarket > 0 ||
                          accStats.hold > 0 ||
                          accStats.tradeProtected > 0) && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                              {accStats.tradeable > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 border border-emerald-500/20">
                                  <span className="size-1 rounded-full bg-emerald-400" />
                                  {accStats.tradeable} Tradeable
                                </span>
                              )}
                              {accStats.onMarket > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400 border border-amber-500/20">
                                  <span className="size-1 rounded-full bg-amber-400" />
                                  {accStats.onMarket} Market
                                </span>
                              )}
                              {accStats.hold > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400 border border-rose-500/20">
                                  <span className="size-1 rounded-full bg-rose-400" />
                                  {accStats.hold} Hold
                                </span>
                              )}
                              {accStats.tradeProtected > 0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400 border border-cyan-500/20">
                                  <span className="size-1 rounded-full bg-cyan-400" />
                                  {accStats.tradeProtected} Protected
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {item.storageUnitDetails && item.storageUnitDetails.length > 0 && (
            <div className="mb-5 space-y-3 border-b border-slate-800/60 pb-5">
              <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                <TbPackage className="size-3.5 text-slate-400" />
                Lưu trữ trong Storage Unit
              </div>
              <div className="grid gap-2">
                {item.storageUnitDetails.map((su) => (
                  <div
                    key={su.storageUnitId}
                    className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-950/20 px-3 py-2.5 hover:bg-slate-900/10 transition duration-200"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <span className="flex size-5.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                        <TbPackage className="size-3" />
                      </span>
                      <span>{su.storageUnitName}</span>
                    </span>
                    <span className="font-mono text-xs font-extrabold text-amber-400">
                      {su.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatedRows.length <= 1 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbHash className="size-3.5 text-slate-500" />
                    Số lượng
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      aria-label="Số lượng"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="h-9 w-full [appearance:textfield] rounded-lg border border-slate-800 bg-slate-950/60 pr-3 pl-11 text-right text-xs font-bold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:shadow-[0_0_12px_rgba(56,189,248,0.15)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute left-3 text-[9px] font-bold tracking-wider text-slate-500 uppercase select-none">
                      QTY
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbCoins className="size-3.5 text-slate-500" />
                    Giá mua CNY
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      aria-label="Giá CNY"
                      value={priceCny}
                      onChange={(e) => updateCny(e.target.value)}
                      className="h-9 w-full [appearance:textfield] rounded-lg border border-slate-800 bg-slate-950/60 pr-3 pl-11 text-right text-xs font-bold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:shadow-[0_0_12px_rgba(56,189,248,0.15)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute left-3 text-[9px] font-bold tracking-wider text-slate-500 uppercase select-none">
                      CNY
                    </span>
                  </div>
                </div>

                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbRefresh className="size-3.5 text-slate-500" />
                    Tỷ giá mua
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      aria-label="Tỷ giá mua"
                      value={buyRate}
                      onChange={(e) => updateBuyRate(e.target.value)}
                      className="h-9 w-full [appearance:textfield] rounded-lg border border-slate-800 bg-slate-950/60 pr-3 pl-11 text-right text-xs font-bold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:shadow-[0_0_12px_rgba(56,189,248,0.15)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute left-3 text-[9px] font-bold tracking-wider text-slate-500 uppercase select-none">
                      RATE
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbUser className="size-3.5 text-slate-500" />
                    Tài khoản sở hữu
                  </label>
                  <Select
                    value={editAccountId || "__manual__"}
                    onValueChange={(val) => {
                      setEditAccountId(val === "__manual__" ? "" : val);
                      setEditStorageUnitId("");
                    }}
                    onOpenChange={onSelectOpenChange}
                  >
                    <Select.Trigger className="h-9 border-slate-800 bg-slate-950/60 focus:border-sky-500/60">
                      <Select.Value placeholder="Thủ công (Không liên kết)" />
                    </Select.Trigger>
                    <Select.Content className="border-slate-800 bg-slate-950">
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
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbPackage className="size-3.5 text-slate-500" />
                    Lưu trữ ở
                  </label>
                  <Select
                    value={editStorageUnitId || "__inventory__"}
                    onValueChange={(val) => setEditStorageUnitId(val === "__inventory__" ? "" : val)}
                    disabled={!editAccountId}
                    onOpenChange={onSelectOpenChange}
                  >
                    <Select.Trigger className="h-9 border-slate-800 bg-slate-950/60 focus:border-sky-500/60">
                      <Select.Value
                        placeholder={
                          !editAccountId
                            ? "Chọn tài khoản trước"
                            : "Hòm đồ cá nhân (Inventory)"
                        }
                      />
                    </Select.Trigger>
                    <Select.Content className="border-slate-800 bg-slate-950">
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

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbShield className="size-3.5 text-slate-500" />
                    Trạng thái
                  </label>
                  <Select
                    value={editState}
                    onValueChange={(val) =>
                      setEditState(
                        val as "tradeable" | "hold" | "protected",
                      )
                    }
                    onOpenChange={onSelectOpenChange}
                  >
                    <Select.Trigger className="h-9 border-slate-800 bg-slate-950/60 focus:border-sky-500/60">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content className="border-slate-800 bg-slate-950">
                      <Select.Item value="tradeable">Trade được ngay</Select.Item>
                      <Select.Item value="hold">Hold trade</Select.Item>
                      <Select.Item value="protected">Trade Protected</Select.Item>
                    </Select.Content>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  {editState === "hold" || editState === "protected" ? (
                    <>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        <TbClock className="size-3.5 text-slate-500" />
                        Số ngày hold còn lại
                      </label>
                      <input
                        type="number"
                        value={editHoldDays}
                        onChange={(e) => setEditHoldDays(e.target.value)}
                        placeholder="Ví dụ: 7"
                        className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 text-xs font-bold text-slate-100 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:shadow-[0_0_12px_rgba(56,189,248,0.15)]"
                      />
                    </>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>

                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <TbFileText className="size-3.5 text-slate-500" />
                    Ghi chú
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Ví dụ: Storage Unit 1, Cất hòm..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950/60 pr-3 pl-11 text-xs font-semibold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:shadow-[0_0_12px_rgba(56,189,248,0.15)]"
                    />
                    <span className="pointer-events-none absolute left-3 text-[9px] font-bold tracking-wider text-slate-500 uppercase select-none">
                      NOTE
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-emerald-500/35 hover:bg-emerald-500/10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold tracking-wider text-emerald-400 uppercase">
                    Tổng giá mua (VND)
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Tự động quy đổi CNY
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    aria-label="Giá mua VND"
                    value={priceVnd}
                    onChange={(e) => updateVnd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submit();
                    }}
                    className="w-36 [appearance:textfield] bg-transparent pr-5 text-right text-xl font-extrabold text-emerald-400 outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="absolute right-0 text-sm font-bold text-emerald-500">
                    ₫
                  </span>
                </div>
              </div>
            </>
          ) : (
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
                      className={`mt-2 space-y-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-700/80 ${embedded ? "max-h-[32rem] overflow-y-auto" : "max-h-[18rem] overflow-y-auto"}`}
                    >
                      {relatedRows.map((lot) => {
                        const isEditing = editingLotId === lot.id;
                        const formattedDate = lot.buyDate
                          ? formatDateVi(lot.buyDate)
                          : "Chưa rõ ngày";
                        const accountName = lot.sourceAccounts?.[0]?.name;
                        const lotHoldDays = lot.tradeHoldUntil
                          ? getHoldDaysRemaining(lot.tradeHoldUntil)
                          : 0;

                        const isProtected =
                          lot.sourceAccounts?.[0]?.breakdown?.tradeProtected &&
                          lot.sourceAccounts[0].breakdown.tradeProtected > 0;
                        const suDetail = lot.storageUnitDetails?.find(
                          (d) => d.storageUnitId === lot.storageUnitId,
                        );
                        const suName =
                          suDetail?.storageUnitName ||
                          storageUnitsQuery.data?.find(
                            (su) => su.id === lot.storageUnitId,
                          )?.name;

                        return (
                          <div
                            key={lot.id}
                            className="group relative space-y-2.5 rounded-xl border border-slate-800/40 bg-slate-950/20 p-3 hover:border-slate-800 hover:bg-slate-900/10 transition duration-200"
                          >
                            {isEditing ? (
                              <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                      <TbHash className="size-2.5" />
                                      Số lượng
                                    </label>
                                    <input
                                      type="number"
                                      value={editQty}
                                      onChange={(e) => setEditQty(e.target.value)}
                                      className="h-8 w-full rounded border border-slate-800 bg-slate-950/60 px-2 text-right text-xs font-bold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                      <TbCoins className="size-2.5" />
                                      Giá mua VND
                                    </label>
                                    <input
                                      type="number"
                                      value={editPriceVnd}
                                      onChange={(e) =>
                                        setEditPriceVnd(e.target.value)
                                      }
                                      className="h-8 w-full rounded border border-slate-800 bg-slate-950/60 px-2 text-right text-xs font-bold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                      <TbUser className="size-2.5" />
                                      Tài khoản sở hữu
                                    </label>
                                    <Select
                                      value={editAccountId || "__manual__"}
                                      onValueChange={(val) => {
                                        setEditAccountId(val === "__manual__" ? "" : val);
                                        setEditStorageUnitId("");
                                      }}
                                      onOpenChange={onSelectOpenChange}
                                    >
                                      <Select.Trigger className="h-8 border-slate-800 bg-slate-950/60 focus:border-sky-500/60">
                                        <Select.Value placeholder="Thủ công (Không liên kết)" />
                                      </Select.Trigger>
                                      <Select.Content className="border-slate-800 bg-slate-950">
                                        <Select.Item value="__manual__">
                                          Thủ công (Không liên kết)
                                        </Select.Item>
                                        {accountsQuery.data?.map((acc) => (
                                          <Select.Item
                                            key={acc.steamId64}
                                            value={acc.steamId64}
                                          >
                                            {acc.name}
                                          </Select.Item>
                                        ))}
                                      </Select.Content>
                                    </Select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                      <TbPackage className="size-2.5" />
                                      Lưu trữ ở
                                    </label>
                                    <Select
                                      value={editStorageUnitId || "__inventory__"}
                                      onValueChange={(val) => setEditStorageUnitId(val === "__inventory__" ? "" : val)}
                                      disabled={!editAccountId}
                                      onOpenChange={onSelectOpenChange}
                                    >
                                      <Select.Trigger className="h-8 border-slate-800 bg-slate-950/60 focus:border-sky-500/60">
                                        <Select.Value
                                          placeholder={
                                            !editAccountId
                                              ? "Chọn tài khoản trước"
                                              : "Hòm đồ cá nhân (Inventory)"
                                          }
                                        />
                                      </Select.Trigger>
                                      <Select.Content className="border-slate-800 bg-slate-950">
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

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                      <TbShield className="size-2.5" />
                                      Trạng thái
                                    </label>
                                    <Select
                                      value={editState}
                                      onValueChange={(val) =>
                                        setEditState(
                                          val as
                                          | "tradeable"
                                          | "hold"
                                          | "protected",
                                        )
                                      }
                                      onOpenChange={onSelectOpenChange}
                                    >
                                      <Select.Trigger className="h-8 border-slate-800 bg-slate-950/60 focus:border-sky-500/60">
                                        <Select.Value />
                                      </Select.Trigger>
                                      <Select.Content className="border-slate-800 bg-slate-950">
                                        <Select.Item value="tradeable">
                                          Trade được ngay
                                        </Select.Item>
                                        <Select.Item value="hold">Hold trade</Select.Item>
                                        <Select.Item value="protected">
                                          Trade Protected
                                        </Select.Item>
                                      </Select.Content>
                                    </Select>
                                  </div>
                                  {(editState === "hold" ||
                                    editState === "protected") && (
                                      <div className="flex flex-col gap-1">
                                        <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                          <TbClock className="size-2.5" />
                                          Số ngày hold còn lại
                                        </label>
                                        <input
                                          type="number"
                                          value={editHoldDays}
                                          onChange={(e) =>
                                            setEditHoldDays(e.target.value)
                                          }
                                          placeholder="Ví dụ: 7"
                                          className="h-8 w-full rounded border border-slate-800 bg-slate-950/60 px-2 text-xs font-bold text-slate-100 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20"
                                        />
                                      </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                    <TbFileText className="size-2.5" />
                                    Ghi chú
                                  </label>
                                  <input
                                    type="text"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    className="h-8 w-full rounded border border-slate-800 bg-slate-950/60 px-2 text-xs font-semibold text-slate-100 placeholder-slate-600 transition duration-200 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20"
                                  />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <Button
                                    type="button"
                                    onClick={() => setEditingLotId(null)}
                                    className="hover:bg-slate-850 cursor-pointer rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-stone-300 transition hover:text-stone-100"
                                  >
                                    Hủy
                                  </Button>
                                  <Button
                                    type="button"
                                    disabled={savingLot}
                                    onClick={() => saveLot(lot.id)}
                                    className="cursor-pointer rounded bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-slate-950 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-stone-900/50 disabled:text-stone-600 disabled:border disabled:border-stone-850/50 disabled:shadow-none"
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
                                    ) : lotHoldDays > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
                                        <TbClock className="size-2.5" />
                                        Hold {lotHoldDays} ngày
                                      </span>
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
                                        <TbUser className="size-2.5 text-sky-400" />{" "}
                                        {accountName}
                                      </span>
                                    )}
                                    {suName && (
                                      <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                        <TbPackage className="size-2.5 text-amber-400" />{" "}
                                        {suName}
                                      </span>
                                    )}
                                    {lot.note &&
                                      !lot.note
                                        .toLowerCase()
                                        .includes("scanner") && (
                                        <span
                                          className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400"
                                          title={lot.note}
                                        >
                                          <TbTag className="size-2.5 text-emerald-400" />{" "}
                                          {lot.note}
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
                                            `Bạn có chắc chắn muốn xóa đợt mua này (${lot.quantity} vật phẩm @ ${formatCurrency(lot.buyPrice)}) không?`,
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
          )}
        </div>

        {(showBuffButton || hasBuffPrice || relatedRows.length <= 1) && (
          <div
            className={`border-t border-slate-800/80 flex items-center justify-between gap-2 p-3.5 ${
              embedded
                ? "sticky bottom-0 z-10 bg-[#0e121a]/95 backdrop-blur-md"
                : "bg-slate-950/45 rounded-b-2xl"
            }`}
          >
            {showBuffButton ? (
              <Button
                type="button"
                onClick={() => fetchBuffPrice?.(item.case.marketHashName)}
                disabled={isLoadingBuff}
                className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-amber-500/20 bg-amber-950/20 px-1.5 text-[11px] font-bold text-amber-400 shadow-sm transition-all duration-200 hover:border-amber-500/45 hover:bg-amber-950/35 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 whitespace-nowrap"
              >
                {isLoadingBuff && (
                  <Loader2 className="size-3 animate-spin text-amber-500" />
                )}
                <span>Lấy giá BUFF</span>
              </Button>
            ) : null}

            {hasBuffPrice ? (
              <Button
                type="button"
                onClick={() => onUpdateBuffPrice?.(item.case.marketHashName, null)}
                className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-sky-500/20 bg-sky-950/20 px-1.5 text-[11px] font-bold text-sky-400 shadow-sm transition-all duration-200 hover:border-sky-500/45 hover:bg-sky-950/35 active:scale-[0.98] whitespace-nowrap"
              >
                <span>Lấy giá Steam</span>
              </Button>
            ) : null}

            {relatedRows.length <= 1 && onDelete && (
              <>
                <Button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deletingId === item.id}
                  className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-red-500/20 bg-red-950/20 px-1.5 text-[11px] font-bold text-red-450 text-red-400 shadow-sm transition-all duration-200 hover:border-red-500/45 hover:bg-red-950/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  {deletingId === item.id && (
                    <Loader2 className="size-3 animate-spin text-red-400" />
                  )}
                  <span>Xóa</span>
                </Button>
                <ConfirmDialog
                  open={deleteConfirmOpen}
                  onClose={() => setDeleteConfirmOpen(false)}
                  title="Xác nhận xóa vật phẩm"
                  description={`Bạn có chắc chắn muốn xóa vật phẩm "${item.case.name}" khỏi danh mục portfolio? Thao tác này không thể hoàn tác.`}
                  confirmText="Đồng ý xóa"
                  cancelText="Hủy"
                  variant="danger"
                  onConfirm={async () => {
                    if (onDelete) {
                      const targetId =
                        relatedRows.length === 1 ? relatedRows[0].id : item.id;
                      await onDelete(targetId);
                    }
                  }}
                />
              </>
            )}

            {relatedRows.length <= 1 && (
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={
                  saving ||
                  (quantity === String(item.quantity) &&
                    priceVnd === toInputNumber(item.buyPrice) &&
                    note === (item.note ?? "") &&
                    editAccountId ===
                    (item.sourceAccounts?.[0]?.steamId64 ?? "") &&
                    editStorageUnitId === (item.storageUnitId ?? "") &&
                    editState ===
                    (initialIsProtected
                      ? "protected"
                      : initialHoldDays > 0
                        ? "hold"
                        : "tradeable") &&
                    (editState !== "hold" ||
                      editHoldDays === String(initialHoldDays)))
                }
                className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-accent px-1.5 text-[11px] font-bold text-accent-foreground shadow-[0_0_12px_rgba(244,63,94,0.15)] transition-all duration-200 hover:bg-[color-mix(in_srgb,var(--accent)_80%,white)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-900/50 disabled:text-stone-600 disabled:border disabled:border-stone-850/50 disabled:shadow-none whitespace-nowrap"
              >
                {saving && (
                  <Loader2 className="size-3 animate-spin text-slate-900" />
                )}
                <span>Lưu thay đổi</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
