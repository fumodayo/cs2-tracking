import { describe, expect, it } from 'vitest';
import type { PortfolioTableRow } from '@/components/portfolio';
import type { PortfolioReportDto } from '@/types/report';
import { getCurrentFilteredRows } from './summary-rows';

function reportWithItemIds(itemIds: string[]): PortfolioReportDto {
  return {
    summary: {
      totalInvested: 0,
      totalCurrentValue: 0,
      totalProfit: 0,
      totalProfitPercent: 0,
      itemCount: itemIds.length,
      caseCount: itemIds.length,
    },
    rows: itemIds.map((id) => ({ item: { id } }) as PortfolioReportDto['rows'][number]),
  };
}

function tableRowWithItemIds(itemIds: string[]): PortfolioTableRow {
  return { itemIds } as PortfolioTableRow;
}

describe('getCurrentFilteredRows', () => {
  it('keeps filtered rows when all row item ids still belong to the current report', () => {
    const filteredRows = [tableRowWithItemIds(['item-1', 'item-2'])];

    expect(getCurrentFilteredRows(reportWithItemIds(['item-1', 'item-2']), filteredRows)).toBe(
      filteredRows
    );
  });

  it('drops stale filtered rows after report items are deleted', () => {
    const filteredRows = [tableRowWithItemIds(['deleted-item'])];

    expect(getCurrentFilteredRows(reportWithItemIds([]), filteredRows)).toBeNull();
  });

  it('keeps an empty filtered set so summary cards can show filtered totals of zero', () => {
    const filteredRows: PortfolioTableRow[] = [];

    expect(getCurrentFilteredRows(reportWithItemIds(['item-1']), filteredRows)).toBe(filteredRows);
  });
});
