"use client";

import React from "react";
import { TbUser } from "react-icons/tb";
import { Select } from "@/components/ui/select";
import { PortfolioTableRow } from "../portfolio-table-model";
import { useTranslation } from "react-i18next";

interface ItemHoldSectionProps {
  item: PortfolioTableRow;
  editAccountId: string;
  setEditAccountId: (val: string) => void;
  editStorageUnitId: string;
  setEditStorageUnitId: (val: string) => void;
  editState: "tradeable" | "hold" | "protected";
  setEditState: (val: "tradeable" | "hold" | "protected") => void;
  editHoldDays: string;
  setEditHoldDays: (val: string) => void;
  accounts: Array<{ id: string; steamId64: string; name: string }> | undefined;
  storageUnits: Array<{ id: string; name: string; currentCount: number }> | undefined;
  onSelectOpenChange?: (open: boolean) => void;
}

export function ItemHoldSection({
  item,
  editAccountId,
  setEditAccountId,
  editStorageUnitId,
  setEditStorageUnitId,
  editState,
  setEditState,
  editHoldDays,
  setEditHoldDays,
  accounts,
  storageUnits,
  onSelectOpenChange,
}: ItemHoldSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950/20 p-3.5 space-y-3 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]">
      <div className="text-[10px] font-extrabold tracking-wide text-stone-400 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <TbUser className="size-3.5 text-accent" />
          {t("portfolio.ownershipAndStatus", "Sở hữu & Trạng thái")}
        </div>
        {item.sourceType === "existing" && (
          <span className="text-[8px] font-extrabold text-accent/90 bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20 select-none shadow-[0_0_10px_rgba(59,130,246,0.08)] tracking-wide">
            {t("portfolio.scannedFromInventory", "Scanned from Inventory")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t("portfolio.owningAccount", "Tài khoản sở hữu")}
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
            <Select.Trigger className="h-9 border border-stone-800 bg-stone-950/30 text-xs text-stone-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none transition rounded-lg">
              <Select.Value placeholder={t("portfolio.manualNoLink", "Manual (Unlinked)")} />
            </Select.Trigger>
            <Select.Content className="border-stone-800 bg-stone-950">
              <Select.Item value="__manual__">
                {t("portfolio.manualNoLink", "Manual (Unlinked)")}
              </Select.Item>
              {accounts?.map((acc) => (
                <Select.Item key={acc.steamId64} value={acc.steamId64}>
                  {acc.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t("portfolio.storedIn", "Lưu trữ ở")}
          </label>
          <Select
            value={editStorageUnitId || "__inventory__"}
            onValueChange={(val) => setEditStorageUnitId(val === "__inventory__" ? "" : val)}
            disabled={item.sourceType === "existing" || !editAccountId}
            onOpenChange={onSelectOpenChange}
          >
            <Select.Trigger className="h-9 border border-stone-800 bg-stone-950/30 text-xs text-stone-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none transition disabled:opacity-40 rounded-lg">
              <Select.Value
                placeholder={
                  !editAccountId
                    ? t("portfolio.selectAccountFirst", "Select account first")
                    : t("portfolio.regularInventory", "Regular Inventory")
                }
              />
            </Select.Trigger>
            <Select.Content className="border-stone-800 bg-stone-950">
              <Select.Item value="__inventory__">
                {t("portfolio.regularInventory", "Regular Inventory")}
              </Select.Item>
              {storageUnits?.map((su) => (
                <Select.Item key={su.id} value={su.id}>
                  {t("portfolio.storageUnitLabelCount", "{{name}} ({{count}} items)", { name: su.name, count: su.currentCount })}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className={editState === "hold" || editState === "protected" ? "flex flex-col gap-1.5" : "col-span-2 flex flex-col gap-1.5"}>
          <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
            {t("portfolio.statusLabel", "Trạng thái")}
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
            <Select.Trigger className="h-9 border border-stone-800 bg-stone-950/30 text-xs text-stone-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none transition rounded-lg">
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="border-stone-800 bg-stone-950">
              <Select.Item value="tradeable">{t("portfolio.tradeableNow", "Tradeable now")}</Select.Item>
              <Select.Item value="hold">{t("portfolio.holdTrade", "Hold trade")}</Select.Item>
              <Select.Item value="protected">{t("portfolio.tradeProtected", "Trade Protected")}</Select.Item>
            </Select.Content>
          </Select>
        </div>

        {(editState === "hold" || editState === "protected") && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-extrabold tracking-wide text-stone-500">
              {t("portfolio.holdDaysLabel", "Số ngày hold")}
            </label>
            <input
              type="number"
              value={editHoldDays}
              onChange={(e) => setEditHoldDays(e.target.value)}
              placeholder={t("portfolio.holdDaysPlaceholder", "E.g.: 7")}
              disabled={item.sourceType === "existing"}
              className="h-9 w-full rounded-lg border border-stone-800 bg-stone-950/30 px-3 text-xs font-bold text-stone-100 placeholder:text-stone-600 transition-all duration-200 hover:border-stone-750 hover:bg-stone-950/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
