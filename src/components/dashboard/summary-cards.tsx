import { Boxes, ChartNoAxesCombined, Coins, WalletCards } from "lucide-react";
import type { PortfolioReportDto } from "@/types/report";
import { formatCurrency, formatPercent } from "@/utils/format";
import { StatCard } from "./stat-card";

type SummaryCardsProps = {
  report: PortfolioReportDto;
};

export function SummaryCards({ report }: SummaryCardsProps) {
  const profitTone = report.summary.totalProfit >= 0 ? "positive" : "negative";

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Tổng vốn"
        value={formatCurrency(report.summary.totalInvested)}
        detail={`${report.summary.caseCount} loại case`}
        icon={<WalletCards className="size-5" />}
      />
      <StatCard
        title="Giá trị hiện tại"
        value={formatCurrency(report.summary.totalCurrentValue)}
        detail={`${report.summary.itemCount} case đang theo dõi`}
        icon={<Coins className="size-5" />}
        tone="accent"
      />
      <StatCard
        title="Lãi / lỗ"
        value={formatCurrency(report.summary.totalProfit)}
        detail={formatPercent(report.summary.totalProfitPercent)}
        icon={<ChartNoAxesCombined className="size-5" />}
        tone={profitTone}
      />
      <StatCard
        title="Số lượng"
        value={new Intl.NumberFormat("vi-VN").format(report.summary.itemCount)}
        detail="Tổng case đã nhập"
        icon={<Boxes className="size-5" />}
      />
    </div>
  );
}
