import type { PortfolioTableRow } from '@/components/portfolio';
import type { PortfolioReportDto } from '@/types/report';

export function getCurrentFilteredRows(
  report: PortfolioReportDto | null,
  filteredRows: PortfolioTableRow[] | null
): PortfolioTableRow[] | null {
  if (!report || filteredRows === null) {
    return null;
  }

  const currentItemIds = new Set(report.rows.map((row) => row.item.id));
  const filteredRowsMatchReport = filteredRows.every(
    (row) => row.itemIds.length > 0 && row.itemIds.every((itemId) => currentItemIds.has(itemId))
  );

  return filteredRowsMatchReport ? filteredRows : null;
}
