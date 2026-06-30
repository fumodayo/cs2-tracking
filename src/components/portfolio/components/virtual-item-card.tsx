"use client";

import React, { memo } from "react";
import { CaseThumbnail } from "../case-thumbnail";
import { useCurrency } from "@/components/currency-provider";
import { PortfolioTableRow } from "../portfolio-table-model";
import { useTranslation } from "react-i18next";

interface VirtualItemCardProps {
  item: PortfolioTableRow;
  typeColor: string;
  accounts?: Array<{ id: string; steamId64: string; name: string }>;
}

export const VirtualItemCard = memo(
  function VirtualItemCard({ item, typeColor, accounts }: VirtualItemCardProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();

  return (
    <div className="w-[25rem] text-left">
      <div className="relative overflow-hidden rounded-2xl border border-stone-800/80 bg-stone-950 text-stone-100 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 hover:border-stone-700/80">
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full opacity-[0.08] blur-3xl"
          style={{ backgroundColor: typeColor }}
        />

        <div className="flex items-center gap-4 border-b border-stone-800/80 bg-gradient-to-r from-stone-900/60 to-stone-900/10 px-4 py-4">
          <div className="group relative flex shrink-0 items-center justify-center rounded-xl border border-stone-800/50 bg-stone-950/80 p-1 shadow-inner">
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
              className="text-sm leading-snug font-bold tracking-wide text-stone-100"
              title={item.case.name}
            >
              {item.case.name}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-500">
              <span>{t("portfolio.storedInStorageUnitOnly", "🔒 Stored in Storage Unit only")}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          {item.storageUnitDetails && item.storageUnitDetails.some((su) => su.quantity > 0) && (
            <div className="mb-3 space-y-1.5 border-b border-stone-800/80 pb-3 text-xs">
              <div className="mb-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                {t("portfolio.storedInStorageUnits", "Stored in Storage Units")}
              </div>
              {item.storageUnitDetails.map((su) => {
                const account = accounts?.find((a) => a.steamId64 === su.steamId64);
                const accountName = account ? account.name : "";
                return (
                  <div
                    key={su.storageUnitId}
                    className="flex items-center justify-between text-stone-300"
                  >
                    <span className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate">{su.storageUnitName}</span>
                      {accountName && (
                        <span className="inline-flex max-w-[7rem] shrink-0 items-center gap-0.5 truncate rounded bg-sky-500/5 border border-sky-500/10 px-1 py-0.5 text-[8.5px] font-bold text-sky-400 tracking-wide ml-1.5">
                          {accountName}
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-amber-400 shrink-0">
                      {su.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-stone-850 grid grid-cols-2 gap-3 rounded-lg border bg-stone-950/45 p-3 text-xs">
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase">
                {t("portfolio.totalQuantity", "Total Quantity")}
              </p>
              <p className="mt-0.5 text-sm font-bold text-stone-200">
                {t("portfolio.itemsCount", "{{count}} items", { count: item.quantity })}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase">
                {t("portfolio.currentPrice", "Current Price")}
              </p>
              <p className="mt-0.5 text-sm font-bold text-emerald-400">
                {formatCurrency(item.currentPrice ?? 0)}
              </p>
            </div>
            <div className="col-span-2 border-t border-stone-800/40 pt-2">
              <p className="text-[10px] font-bold text-stone-500 uppercase">
                {t("portfolio.totalCurrentValue", "Total Current Value")}
              </p>
              <p className="mt-0.5 text-base font-extrabold text-emerald-400">
                {formatCurrency((item.currentPrice ?? 0) * item.quantity)}
              </p>
            </div>
          </div>

          <div className="border-stone-850 rounded-lg border bg-stone-950/20 p-3 text-xs leading-relaxed text-stone-400">
            💡 <strong>{t("common.noteLabel", "Note")}:</strong> {t("portfolio.virtualItemCardNoticeBody", "This item only exists in Storage Units, not in the main inventory. Quantities are automatically updated when scanning Steam accounts.")}
          </div>
        </div>
      </div>
    </div>
  );
  }
);

VirtualItemCard.displayName = "VirtualItemCard";
