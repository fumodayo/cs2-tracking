import type { PriceRange } from "@/domain/price";
import type { CaseDto, PortfolioReportDto, PortfolioReportRowDto, PriceChangeDto } from "@/types/report";

export type PortfolioTableMode = "transactions" | "case-summary";

export type PortfolioTableRow = {
  id: string;
  mode: PortfolioTableMode;
  case: CaseDto;
  itemIds: string[];
  quantity: number;
  lotCount: number;
  buyPrice: number;
  buyDate: string | null;
  note?: string;
  currentPrice: number | null;
  currentPriceCapturedAt: string | null;
  investedValue: number;
  currentValue: number | null;
  profitAmount: number | null;
  profitPercent: number | null;
  marketChanges: Record<PriceRange, PriceChangeDto>;
};

export function buildPortfolioTableRows(report: PortfolioReportDto, mode: PortfolioTableMode): PortfolioTableRow[] {
  return mode === "transactions" ? report.rows.map(mapTransactionRow) : buildCaseSummaryRows(report.rows);
}

function mapTransactionRow(row: PortfolioReportRowDto): PortfolioTableRow {
  return {
    id: row.item.id,
    mode: "transactions",
    case: row.case,
    itemIds: [row.item.id],
    quantity: row.item.quantity,
    lotCount: 1,
    buyPrice: row.item.buyPrice,
    buyDate: row.item.buyDate,
    note: row.item.note,
    currentPrice: row.currentPrice,
    currentPriceCapturedAt: row.currentPriceCapturedAt,
    investedValue: row.investedValue,
    currentValue: row.currentValue,
    profitAmount: row.profitAmount,
    profitPercent: row.profitPercent,
    marketChanges: row.marketChanges,
  };
}

function buildCaseSummaryRows(rows: PortfolioReportRowDto[]): PortfolioTableRow[] {
  const groupedRows = new Map<string, PortfolioReportRowDto[]>();

  for (const row of rows) {
    const currentRows = groupedRows.get(row.case.id) ?? [];
    currentRows.push(row);
    groupedRows.set(row.case.id, currentRows);
  }

  return Array.from(groupedRows.values()).map(mapCaseSummaryRow);
}

function mapCaseSummaryRow(rows: PortfolioReportRowDto[]): PortfolioTableRow {
  const [firstRow] = rows;
  const quantity = rows.reduce((sum, row) => sum + row.item.quantity, 0);
  const investedValue = rows.reduce((sum, row) => sum + row.investedValue, 0);
  const currentValue = rows.some((row) => row.currentValue === null)
    ? null
    : rows.reduce((sum, row) => sum + (row.currentValue ?? 0), 0);
  const profitAmount = currentValue === null ? null : currentValue - investedValue;

  return {
    id: `case-${firstRow.case.id}`,
    mode: "case-summary",
    case: firstRow.case,
    itemIds: rows.map((row) => row.item.id),
    quantity,
    lotCount: rows.length,
    buyPrice: quantity > 0 ? investedValue / quantity : 0,
    buyDate: getDateRangeLabel(rows.map((row) => row.item.buyDate)),
    currentPrice: firstRow.currentPrice,
    currentPriceCapturedAt: firstRow.currentPriceCapturedAt,
    investedValue,
    currentValue,
    profitAmount,
    profitPercent: profitAmount === null || investedValue <= 0 ? null : (profitAmount / investedValue) * 100,
    marketChanges: firstRow.marketChanges,
  };
}

function getDateRangeLabel(values: string[]): string | null {
  const timestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => first - second);

  if (timestamps.length === 0) {
    return null;
  }

  const first = new Date(timestamps[0]).toISOString();
  const last = new Date(timestamps[timestamps.length - 1]).toISOString();
  return first === last ? first : `${first}|${last}`;
}
