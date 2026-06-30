"use client";

import { Calculator, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface CacheMatchAlertProps {
  message: string;
  isUpdating: boolean;
  onUpdatePrice: () => void;
}

export function CacheMatchAlert({
  message,
  isUpdating,
  onUpdatePrice,
}: CacheMatchAlertProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.02] p-4 text-xs text-emerald-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <span className="mb-0.5 block font-bold text-emerald-200">
          {t("postAnalyzer.matchingPostFound")}
        </span>
        <p className="leading-relaxed text-stone-450 font-medium">
          {message}
        </p>
      </div>
      <Button
        type="button"
        disabled={isUpdating}
        onClick={onUpdatePrice}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-50"
      >
        {isUpdating ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Calculator className="size-3.5" />
        )}
        {t("postAnalyzer.updateNewPrices")}
      </Button>
    </div>
  );
}
