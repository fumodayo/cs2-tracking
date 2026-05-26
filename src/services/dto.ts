import type { PortfolioReport, PortfolioReportRow } from "@/domain/portfolio-report";

export function serializeReport(report: PortfolioReport) {
  return {
    summary: report.summary,
    rows: report.rows.map(serializeRow),
  };
}

function serializeRow(row: PortfolioReportRow) {
  return {
    ...row,
    item: {
      ...row.item,
      buyDate: row.item.buyDate.toISOString(),
      createdAt: row.item.createdAt.toISOString(),
      updatedAt: row.item.updatedAt.toISOString(),
    },
  };
}
