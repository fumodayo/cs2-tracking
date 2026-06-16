"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbUser, TbPackage, TbCoins } from "react-icons/tb";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { CaseThumbnail } from "../case-thumbnail";


import {
  PortfolioTableRow,
} from "../portfolio-table-model";

import {
  getItemTypeColor,
  getItemTypeLabel,
  colorWithAlpha,
  toInputNumber,
} from "../portfolio-table-utils";

import { VirtualItemCard } from "./virtual-item-card";
import { AccountAllocationBreakdown } from "@/components/steam-accounts";
import { ItemLotsList } from "./item-lots-list";
import { calculateTradeHoldUntil } from "@/utils/date";

export function ItemHoverCard({
  item,
  relatedRows,
  onUpdateQuantity,
  onUpdateBuyPrice,
  onUpdateNote,
  onUpdateLot,
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
  const [isResetting, setIsResetting] = useState(false);

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



  const isVirtual = item.sourceType === "existing" && item.isVirtual;

  // Load draft from localStorage on mount/props changes, falling back to props values
  useEffect(() => {
    let loadedFromDraft = false;
    try {
      const saved = localStorage.getItem(`item_hover_card_draft_${item.id}`);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft) {
          setQuantity(draft.quantity ?? String(item.quantity));
          setPriceVnd(draft.priceVnd ?? toInputNumber(item.buyPrice));
          setPriceCny(draft.priceCny ?? toInputNumber(item.buyPrice / (buffCnyToVndRate ?? 3600)));
          setBuyRate(draft.buyRate ?? toInputNumber(buffCnyToVndRate ?? 3600));
          setNote(draft.note ?? (item.note ?? ""));
          setEditAccountId(draft.editAccountId ?? (item.sourceAccounts?.[0]?.steamId64 ?? ""));
          setEditStorageUnitId(draft.editStorageUnitId ?? (item.storageUnitId ?? ""));
          setEditState(draft.editState ?? "tradeable");
          setEditHoldDays(draft.editHoldDays ?? "");
          loadedFromDraft = true;
        }
      }
    } catch (e) {
      console.error("Failed to parse item draft from localStorage", e);
    }

    if (!loadedFromDraft) {
      setQuantity(String(item.quantity));
      setPriceVnd(toInputNumber(item.buyPrice));
      setPriceCny(toInputNumber(item.buyPrice / (buffCnyToVndRate ?? 3600)));
      setBuyRate(toInputNumber(buffCnyToVndRate ?? 3600));
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
    }
  }, [
    item.id,
    item.quantity,
    item.buyPrice,
    item.note,
    buffCnyToVndRate,
    item.sourceAccounts,
    item.storageUnitId,
    item.tradeHoldUntil,
  ]);

  // Check if form values match default values from props
  const isDefault = useMemo(() => {
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
    const defaultEditState = isProtected
      ? "protected"
      : lotHoldDays > 0
        ? "hold"
        : "tradeable";

    return (
      quantity === String(item.quantity) &&
      priceVnd === toInputNumber(item.buyPrice) &&
      buyRate === toInputNumber(buffCnyToVndRate ?? 3600) &&
      note === (item.note ?? "") &&
      editAccountId === (item.sourceAccounts?.[0]?.steamId64 ?? "") &&
      editStorageUnitId === (item.storageUnitId ?? "") &&
      editState === defaultEditState &&
      (editState !== "hold" || editHoldDays === String(lotHoldDays))
    );
  }, [
    item,
    quantity,
    priceVnd,
    buyRate,
    note,
    editAccountId,
    editStorageUnitId,
    editState,
    editHoldDays,
    buffCnyToVndRate,
  ]);

  // Auto-save draft on changes
  useEffect(() => {
    if (!item.id) return;
    try {
      if (isDefault) {
        localStorage.removeItem(`item_hover_card_draft_${item.id}`);
      } else {
        const draft = {
          quantity,
          priceCny,
          buyRate,
          priceVnd,
          note,
          editAccountId,
          editStorageUnitId,
          editState,
          editHoldDays,
        };
        localStorage.setItem(`item_hover_card_draft_${item.id}`, JSON.stringify(draft));
      }
    } catch (e) {
      console.error("Failed to save draft to localStorage", e);
    }
  }, [
    item.id,
    isDefault,
    quantity,
    priceCny,
    buyRate,
    priceVnd,
    note,
    editAccountId,
    editStorageUnitId,
    editState,
    editHoldDays,
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
            const baseDate = item.buyDate ? new Date(item.buyDate) : new Date();
            const holdDate = calculateTradeHoldUntil(baseDate, days);
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
      try {
        localStorage.removeItem(`item_hover_card_draft_${item.id}`);
      } catch { /* ignore */ }
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
    return <VirtualItemCard item={item} typeColor={typeColor} accounts={accountsQuery.data} />;
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
          <AccountAllocationBreakdown relatedRows={relatedRows} />

          {item.storageUnitDetails && item.storageUnitDetails.length > 0 && (
            <div className="mb-5 space-y-3 border-b border-slate-800/60 pb-5">
              <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                <TbPackage className="size-3.5 text-slate-400" />
                Lưu trữ trong Storage Unit
              </div>
              <div className="grid gap-2">
                {item.storageUnitDetails.map((su) => {
                  const account = accountsQuery.data?.find(
                    (a) => a.steamId64 === su.steamId64
                  );
                  const accountName = account ? account.name : "";
                  return (
                    <div
                      key={su.storageUnitId}
                      className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-950/20 px-3 py-2.5 hover:bg-slate-900/10 transition duration-200"
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold text-slate-300 min-w-0 flex-1">
                        <span className="flex size-5.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                          <TbPackage className="size-3" />
                        </span>
                        <span className="truncate">{su.storageUnitName}</span>
                        {accountName && (
                          <span className="inline-flex max-w-[7rem] shrink-0 items-center gap-0.5 truncate rounded bg-sky-500/5 border border-sky-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-sky-400 tracking-wide">
                            {accountName}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs font-extrabold text-amber-400 shrink-0">
                        {su.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {relatedRows.length <= 1 ? (
            <div className={`space-y-4 transition-all duration-350 ${isResetting ? "animate-reset-flash" : ""}`}>
              {/* Section 1: Ownership & Status */}
              <div className="rounded-xl border border-slate-800/40 bg-slate-950/20 p-3.5 space-y-3">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <TbUser className="size-3.5 text-sky-400" />
                    Sở hữu & Trạng thái
                  </div>
                  {item.sourceType === "existing" && (
                    <span className="text-[8px] font-bold text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20 select-none">
                      Scan từ Inventory
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-wider text-slate-450 text-slate-400 uppercase">
                      Tài khoản sở hữu
                    </label>
                    <Select
                      value={editAccountId || "__manual__"}
                      onValueChange={(val) => {
                        setEditAccountId(val === "__manual__" ? "" : val);
                        setEditStorageUnitId("");
                      }}
                      disabled={item.sourceType === "existing"}
                      onOpenChange={onSelectOpenChange}
                    >
                      <Select.Trigger className="h-9 border-slate-800/80 bg-slate-950/40 text-xs text-slate-200 hover:border-slate-700/60 focus:border-sky-500/60 transition">
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
                    <label className="text-[9px] font-bold tracking-wider text-slate-450 text-slate-400 uppercase">
                      Lưu trữ ở
                    </label>
                    <Select
                      value={editStorageUnitId || "__inventory__"}
                      onValueChange={(val) => setEditStorageUnitId(val === "__inventory__" ? "" : val)}
                      disabled={item.sourceType === "existing" || !editAccountId}
                      onOpenChange={onSelectOpenChange}
                    >
                      <Select.Trigger className="h-9 border-slate-800/80 bg-slate-950/40 text-xs text-slate-200 hover:border-slate-700/60 focus:border-sky-500/60 transition disabled:opacity-40">
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

                  <div className={editState === "hold" || editState === "protected" ? "flex flex-col gap-1.5" : "col-span-2 flex flex-col gap-1.5"}>
                    <label className="text-[9px] font-bold tracking-wider text-slate-455 text-slate-400 uppercase">
                      Trạng thái
                    </label>
                    <Select
                      value={editState}
                      onValueChange={(val) =>
                        setEditState(
                          val as "tradeable" | "hold" | "protected",
                        )
                      }
                      disabled={item.sourceType === "existing"}
                      onOpenChange={onSelectOpenChange}
                    >
                      <Select.Trigger className="h-9 border-slate-800/80 bg-slate-950/40 text-xs text-slate-200 hover:border-slate-700/60 focus:border-sky-500/60 transition">
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
                      <label className="text-[9px] font-bold tracking-wider text-slate-455 text-slate-400 uppercase">
                        Số ngày hold
                      </label>
                      <input
                        type="number"
                        value={editHoldDays}
                        onChange={(e) => setEditHoldDays(e.target.value)}
                        placeholder="Ví dụ: 7"
                        disabled={item.sourceType === "existing"}
                        className="h-9 w-full rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 text-xs font-bold text-slate-100 placeholder-slate-650 placeholder:text-slate-600 transition duration-200 hover:border-slate-700/60 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Value & Quantity */}
              <div className="rounded-xl border border-slate-800/40 bg-slate-950/20 p-3.5 space-y-3">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <TbCoins className="size-3.5 text-amber-500" />
                    Số lượng & Đơn giá
                  </div>
                  {item.sourceType === "existing" && (
                    <span className="text-[8px] font-bold text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20 select-none">
                      Scan từ Inventory
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-wider text-slate-455 text-slate-400 uppercase">
                      Số lượng
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        aria-label="Số lượng"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        disabled={item.sourceType === "existing"}
                        className="h-9 w-full [appearance:textfield] rounded-lg border border-slate-800/80 bg-slate-950/40 pr-3 pl-12 text-right text-xs font-bold text-slate-100 placeholder-slate-650 placeholder:text-slate-600 transition duration-200 hover:border-slate-700/60 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                        QTY
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-wider text-slate-455 text-slate-400 uppercase">
                      Giá mua CNY
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        aria-label="Giá CNY"
                        value={priceCny}
                        onChange={(e) => updateCny(e.target.value)}
                        className="h-9 w-full [appearance:textfield] rounded-lg border border-slate-800/80 bg-slate-950/40 pr-3 pl-12 text-right text-xs font-bold text-slate-100 placeholder-slate-655 placeholder:text-slate-600 transition duration-200 hover:border-slate-700/60 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                        CNY
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-wider text-slate-455 text-slate-400 uppercase">
                      Tỷ giá mua
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        aria-label="Tỷ giá mua"
                        value={buyRate}
                        onChange={(e) => updateBuyRate(e.target.value)}
                        className="h-9 w-full [appearance:textfield] rounded-lg border border-slate-800/80 bg-slate-950/40 pr-3 pl-14 text-right text-xs font-bold text-slate-100 placeholder-slate-650 placeholder:text-slate-600 transition duration-200 hover:border-slate-700/60 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                        RATE
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-wider text-slate-455 text-slate-400 uppercase">
                      Ghi chú
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Ví dụ: Cất hòm..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-800/80 bg-slate-950/40 pr-3 pl-14 text-xs font-semibold text-slate-100 placeholder-slate-650 placeholder:text-slate-600 transition duration-200 hover:border-slate-700/60 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute left-2 text-[8px] font-extrabold tracking-wider text-slate-400 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded select-none">
                        NOTE
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tổng giá mua VND */}
                <div className="mt-3.5 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-emerald-500/35 hover:bg-emerald-500/10">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold tracking-wider text-emerald-400 uppercase">
                      Tổng giá mua (VND)
                    </span>
                    <span className="text-[8px] text-slate-500">
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
                      className="w-36 [appearance:textfield] bg-transparent pr-5 text-right text-lg font-extrabold text-emerald-400 outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="absolute right-0 text-sm font-bold text-emerald-500">
                      ₫
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ItemLotsList
              relatedRows={relatedRows}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateBuyPrice={onUpdateBuyPrice}
              onUpdateNote={onUpdateNote}
              onUpdateLot={onUpdateLot}
              onDelete={onDelete}
              embedded={embedded}
              onSelectOpenChange={onSelectOpenChange}
            />
          )}
        </div>

        {(relatedRows.length <= 1 || ((showBuffButton || hasBuffPrice) && relatedRows.length > 1)) && (
          <div
            className={`border-t border-slate-800/80 ${
              embedded
                ? "sticky bottom-0 z-10 bg-[#0e121a]/95 backdrop-blur-md px-2 py-3"
                : "bg-slate-950/45 rounded-b-2xl p-3.5"
            }`}
          >
            {relatedRows.length > 1 ? (
              <div className="flex gap-2 w-full">
                {showBuffButton && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchBuffPrice?.(item.case.marketHashName)}
                    disabled={isLoadingBuff}
                    className="flex-1 border-amber-500/20 bg-amber-950/20 text-xs font-bold text-amber-400 hover:border-amber-500/45 hover:bg-amber-950/35 disabled:cursor-wait"
                  >
                    {isLoadingBuff && (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    )}
                    <span>{embedded ? "Giá BUFF" : "Lấy giá BUFF"}</span>
                  </Button>
                )}

                {hasBuffPrice && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateBuffPrice?.(item.case.marketHashName, null)}
                    className="flex-1 border-sky-500/20 bg-sky-950/20 text-xs font-bold text-sky-400 hover:border-sky-500/45 hover:bg-sky-950/35"
                  >
                    <span>{embedded ? "Giá Steam" : "Dùng giá Steam"}</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between w-full gap-y-2 gap-x-1">
                {onDelete ? (
                  <>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={deletingId === item.id}
                      className="text-xs font-bold px-2"
                    >
                      {deletingId === item.id && (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
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
                ) : (
                  <div />
                )}

                <div className="flex flex-wrap items-center gap-1">
                  {showBuffButton && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchBuffPrice?.(item.case.marketHashName)}
                      disabled={isLoadingBuff}
                      className="border-amber-500/20 bg-amber-950/20 text-xs font-bold text-amber-400 hover:border-amber-500/45 hover:bg-amber-950/35 disabled:cursor-wait px-2"
                    >
                      {isLoadingBuff && (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      )}
                      <span>{embedded ? "Giá BUFF" : "Lấy giá BUFF"}</span>
                    </Button>
                  )}

                  {hasBuffPrice && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateBuffPrice?.(item.case.marketHashName, null)}
                      className="border-sky-500/20 bg-sky-950/20 text-xs font-bold text-sky-400 hover:border-sky-500/45 hover:bg-sky-950/35 px-2"
                    >
                      <span>{embedded ? "Giá Steam" : "Dùng giá Steam"}</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsResetting(true);
                      try {
                        localStorage.removeItem(`item_hover_card_draft_${item.id}`);
                      } catch { /* ignore */ }
                      setQuantity(String(item.quantity));
                      setPriceVnd(toInputNumber(item.buyPrice));
                      setPriceCny(toInputNumber(item.buyPrice / (buffCnyToVndRate ?? 3600)));
                      setBuyRate(toInputNumber(buffCnyToVndRate ?? 3600));
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
                      setTimeout(() => setIsResetting(false), 400);
                    }}
                    disabled={isDefault}
                    className="text-xs font-bold px-2"
                  >
                    <span>Xóa nháp</span>
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => void submit()}
                    disabled={saving || isDefault}
                    className="text-xs font-bold px-2"
                  >
                    {saving && (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    )}
                    <span>{embedded ? "Lưu" : "Lưu thay đổi"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
