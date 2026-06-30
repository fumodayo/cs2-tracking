import type { PriceChangeDto } from "@/types/report";
import { formatPercent } from "@/utils/format";
import { useCurrency } from "@/components/currency-provider";
import { useTranslation } from "react-i18next";

type ChangePillProps = {
  change: PriceChangeDto;
};

export function ChangePill({ change }: ChangePillProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  if (change.amount === null || change.percent === null) {
    return <span className="text-xs text-stone-500">{t("portfolio.insufficientData", "Insufficient data")}</span>;
  }

  const positive = change.amount >= 0;

  return (
    <span
      className={`inline-flex min-w-[7.5rem] flex-col rounded-md border px-2 py-1 text-xs ${
        positive
          ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
          : "border-red-500/30 bg-red-950/30 text-red-200"
      }`}
      title={t("portfolio.baselineDateTitle", "Baseline: {{date}}", {
        date: change.baselineDate ?? t("common.unknown", "unknown"),
      })}
    >
      <span className="font-semibold">{formatPercent(change.percent)}</span>
      <span className="text-[0.68rem] opacity-80">
        {formatCurrency(change.amount)}
      </span>
    </span>
  );
}
