import {
  TbWallet,
  TbCoins,
  TbTrendingUp,
  TbTrendingDown,
  TbBox,
} from "react-icons/tb";
import type { ReactNode } from "react";
import type { PortfolioReportDto } from "@/types/report";
import { useCurrency } from "@/components/currency-provider";
import { StatCard } from "@/components/ui/stat-card";
import type { PortfolioTableRow } from "@/components/portfolio";
import { FadeIn, CountUp } from "@/components/ui/animation";

type SummaryCardsProps = {
  report: PortfolioReportDto;
  computedRows?: PortfolioTableRow[];
  children?: ReactNode;
};

export function SummaryCards({
  report,
  computedRows,
  children,
}: SummaryCardsProps) {
  const { formatCurrency } = useCurrency();
  let summary = {
    totalInvested: report.summary.totalInvested,
    totalCurrentValue: report.summary.totalCurrentValue,
    totalProfit: report.summary.totalProfit,
    totalProfitPercent: report.summary.totalProfitPercent,
    caseCount: report.summary.caseCount,
    itemCount: report.summary.itemCount,
  };

  if (computedRows) {
    const totalInvested = computedRows.reduce(
      (sum, r) => sum + r.investedValue,
      0,
    );
    const totalCurrentValue = computedRows.reduce(
      (sum, r) => sum + (r.currentValue ?? r.investedValue),
      0,
    );
    const totalProfit = totalCurrentValue - totalInvested;
    const totalProfitPercent =
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const itemCount = computedRows.reduce((sum, r) => sum + r.quantity, 0);
    const caseCount = new Set(computedRows.map((r) => r.case.id)).size;

    summary = {
      totalInvested,
      totalCurrentValue,
      totalProfit,
      totalProfitPercent,
      caseCount,
      itemCount,
    };
  }

  const profitTone = summary.totalProfit >= 0 ? "positive" : "negative";
  const ProfitIcon = summary.totalProfit >= 0 ? TbTrendingUp : TbTrendingDown;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {/* Row 1: Tổng vốn | Giá trị hiện tại | Lãi / lỗ */}
      <FadeIn delay={0.02} direction="up" className="h-full">
        <StatCard
          title="Tổng vốn"
          value={formatCurrency(summary.totalInvested)}
          numericValue={summary.totalInvested}
          valueType="currency"
          detail={`${summary.caseCount} loại item`}
          icon={<TbWallet className="size-5.5" />}
          tooltip={
            <span>
              Tổng số tiền bạn đã bỏ ra để mua tất cả các item trong portfolio.
              <br />
              <span className="opacity-70">Công thức: Σ (giá mua × số lượng)</span>
            </span>
          }
        />
      </FadeIn>
      <FadeIn delay={0.08} direction="up" className="h-full">
        <StatCard
          title="Giá trị hiện tại"
          value={formatCurrency(summary.totalCurrentValue)}
          numericValue={summary.totalCurrentValue}
          valueType="currency"
          detail={`${summary.itemCount} item đang theo dõi`}
          icon={<TbCoins className="size-5.5" />}
          tone="accent"
          tooltip={
            <span>
              Tổng giá trị thị trường hiện tại của tất cả item đang theo dõi.
              <br />
              <span className="opacity-70">Dùng giá Buff (nếu có) hoặc giá Steam mới nhất.</span>
            </span>
          }
        />
      </FadeIn>
      <FadeIn delay={0.14} direction="up" className="h-full">
        <StatCard
          title="Lãi / lỗ"
          value={formatCurrency(summary.totalProfit)}
          numericValue={summary.totalProfit}
          valueType="currency"
          detail={
            <span>
              {summary.totalProfitPercent > 0 ? "+" : ""}
              <CountUp
                to={summary.totalProfitPercent}
                decimals={2}
                separator="."
              />
              %
            </span>
          }
          icon={<ProfitIcon className="size-5.5" />}
          tone={profitTone}
          tooltip={
            <span>
              Lãi / lỗ = Giá trị hiện tại − Tổng vốn.
              <br />
              <span className="opacity-70">% = (Lãi / Tổng vốn) × 100</span>
            </span>
          }
        />
      </FadeIn>

      {/* Row 2: Rate sỉ (all) | Rate lẻ | Số lượng */}
      {children}
      <FadeIn delay={0.2} direction="up" className="h-full">
        <StatCard
          title="Số lượng"
          value={new Intl.NumberFormat("vi-VN").format(summary.itemCount)}
          numericValue={summary.itemCount}
          valueType="number"
          detail="Tổng item đã nhập"
          icon={<TbBox className="size-5.5" />}
          tooltip={
            <span>
              Tổng số lượng item đang được theo dõi trong portfolio.
              <br />
              <span className="opacity-70">Mỗi item được đếm theo số lượng thực tế.</span>
            </span>
          }
        />
      </FadeIn>
    </div>
  );
}
