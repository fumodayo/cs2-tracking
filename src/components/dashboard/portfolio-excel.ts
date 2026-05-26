import * as XLSX from "xlsx";
import type { PortfolioReportDto } from "@/types/report";

export type PortfolioImportRow = {
  caseId?: string;
  marketHashName?: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  note?: string;
};

const EXPORT_COLUMNS = {
  caseId: "Case ID",
  caseName: "Case Name",
  marketHashName: "Market Hash Name",
  quantity: "Quantity",
  buyPrice: "Buy Price",
  buyDate: "Buy Date",
  note: "Note",
} as const;

export function exportPortfolioToExcel(report: PortfolioReportDto) {
  const rows = report.rows.map((row) => ({
    [EXPORT_COLUMNS.caseId]: row.item.caseId,
    [EXPORT_COLUMNS.caseName]: row.case.name,
    [EXPORT_COLUMNS.marketHashName]: row.case.marketHashName,
    [EXPORT_COLUMNS.quantity]: row.item.quantity,
    [EXPORT_COLUMNS.buyPrice]: row.item.buyPrice,
    [EXPORT_COLUMNS.buyDate]: row.item.buyDate.slice(0, 10),
    [EXPORT_COLUMNS.note]: row.item.note ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 34 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 32 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Portfolio");
  XLSX.writeFile(workbook, `cs2-portfolio-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function parsePortfolioExcelFile(file: File): Promise<PortfolioImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("File Excel không có sheet dữ liệu.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  return rows.map(normalizeImportRow).filter((row) => row.caseId || row.marketHashName);
}

function normalizeImportRow(row: Record<string, unknown>): PortfolioImportRow {
  const buyDateValue = getCell(row, EXPORT_COLUMNS.buyDate, "buyDate", "Ngày mua");

  return {
    caseId: getStringCell(row, EXPORT_COLUMNS.caseId, "caseId"),
    marketHashName: getStringCell(row, EXPORT_COLUMNS.marketHashName, "marketHashName", "Tên market"),
    quantity: Number(getCell(row, EXPORT_COLUMNS.quantity, "quantity", "Số lượng")),
    buyPrice: Number(getCell(row, EXPORT_COLUMNS.buyPrice, "buyPrice", "Giá mua")),
    buyDate: normalizeExcelDate(buyDateValue),
    note: getStringCell(row, EXPORT_COLUMNS.note, "note", "Ghi chú"),
  };
}

function getStringCell(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  const value = getCell(row, ...keys);
  return typeof value === "string" && value.trim() ? value.trim() : value === undefined ? undefined : String(value).trim();
}

function getCell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }

  return undefined;
}

function normalizeExcelDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
    }
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return "";
}
