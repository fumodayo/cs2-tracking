"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { BuffRateCard } from "../buff-rate-card";
import { RateCard } from "../rate-card";
import { StatCard } from "@/components/ui/stat-card";
import { formatVND } from "../utils";

import { AccountEntry } from "../types";

interface PricingStatsGridProps {
  buffCnyToVndRate: number;
  setBuffCnyToVndRate: (val: number) => void;
  rateAll: number;
  setRateAll: (val: number) => void;
  rateLe: number;
  setRateLe: (val: number) => void;
  totalPrice: number;
  totalQuantity: number;
  totalSi: number;
  totalLe: number;
  totalWalletVnd: number;
  accounts: AccountEntry[];
}

export function PricingStatsGrid({
  buffCnyToVndRate,
  setBuffCnyToVndRate,
  rateAll,
  setRateAll,
  rateLe,
  setRateLe,
  totalPrice,
  totalQuantity,
  totalSi,
  totalLe,
  totalWalletVnd,
  accounts,
}: PricingStatsGridProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <BuffRateCard
          value={buffCnyToVndRate}
          onChange={setBuffCnyToVndRate}
          tooltip={
            <span>
              {t("inventoryScanner.buffRateTooltip")}
            </span>
          }
        />
        <RateCard
          id="rateAll"
          label={t("inventoryScanner.rateSiAll")}
          value={rateAll}
          onChange={setRateAll}
          total={totalPrice}
          color="blue"
          desc={t("inventoryScanner.rateSiDesc")}
          customCalculatedTotal={totalSi}
          tooltip={
            <span>
              {t("inventoryScanner.rateSiTooltip")}
            </span>
          }
        />
        <RateCard
          id="rateLe"
          label={t("inventoryScanner.rateLe")}
          value={rateLe}
          onChange={setRateLe}
          total={totalPrice}
          color="amber"
          desc={t("inventoryScanner.rateLeDesc")}
          customCalculatedTotal={totalLe}
          tooltip={
            <span>
              {t("inventoryScanner.rateLeTooltip")}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("inventoryScanner.totalPricedItems")}
          value={String(totalQuantity)}
          unit={t("inventoryScanner.itemUnit")}
          variant="blue"
          tooltip={
            <span>
              {t("inventoryScanner.totalQuantityTooltip")}
            </span>
          }
        />
        <StatCard
          label={t("inventoryScanner.marketValue")}
          value={formatVND(totalPrice)}
          valueClass="text-emerald-400"
          variant="emerald"
          tooltip={
            <span>
              {t("inventoryScanner.marketValueTooltip")}
            </span>
          }
        />
        <StatCard
          label={t("inventoryScanner.totalSteamWallet")}
          value={formatVND(totalWalletVnd)}
          valueClass="text-sky-400 font-bold"
          variant="blue"
          tooltip={
            <div className="space-y-1">
              <p>{t("inventoryScanner.walletTooltip")}</p>
              {accounts.some((a) => a.status === "done" && a.result?.walletBalance) && (
                <div className="mt-1.5 border-t border-stone-800 pt-1.5 space-y-0.5">
                  {accounts
                    .filter((a) => a.status === "done" && a.result?.walletBalance)
                    .map((a) => (
                      <div key={a.id} className="flex justify-between gap-4 text-[10px] text-stone-400">
                        <span className="truncate max-w-[100px]">{a.result!.profile.name}:</span>
                        <span className="font-mono font-semibold text-stone-300">
                          {a.result?.walletBalance
                            ?.replace(/Chờ xử lý/gi, t("common.pending", "Pending"))
                            .replace(/Pending/gi, t("common.pending", "Pending"))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          }
        />
      </div>
    </div>
  );
}
