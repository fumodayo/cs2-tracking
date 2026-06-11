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

type FlexibleColumns = {
  name: number;
  quantity: number;
  buyPrice: number;
  caseId?: number;
  buyDate?: number;
  note?: number;
};

const HEADER_ALIASES = {
  caseId: ["caseid"],
  name: ["markethashname", "tenmarket", "casename", "ten", "link"],
  quantity: ["quantity", "soluong"],
  buyPrice: ["buyprice", "giamua", "gialucmua", "gialucmuatrenbuff"],
  buyDate: ["buydate", "ngaymua"],
  note: ["note", "ghichu"],
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
  worksheet["!cols"] = [
    { wch: 26 },
    { wch: 34 },
    { wch: 34 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Portfolio");
  XLSX.writeFile(
    workbook,
    `cs2-portfolio-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export async function parsePortfolioExcelFile(
  file: File,
): Promise<PortfolioImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const rows = workbook.SheetNames.flatMap((sheetName) =>
    parsePortfolioWorksheet(workbook.Sheets[sheetName]),
  );

  if (rows.length === 0) {
    throw new Error("File không có dòng portfolio hợp lệ.");
  }

  return rows;
}

function parsePortfolioWorksheet(
  worksheet: XLSX.WorkSheet | undefined,
): PortfolioImportRow[] {
  if (!worksheet) {
    return [];
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
  });
  const headerIndex = matrix.findIndex((row) =>
    Boolean(findFlexibleColumns(row)),
  );
  if (headerIndex === -1) {
    return [];
  }

  const columns = findFlexibleColumns(matrix[headerIndex]);
  if (!columns) {
    return [];
  }

  return matrix
    .slice(headerIndex + 1)
    .map((row) => normalizeFlexibleImportRow(row, columns))
    .filter((row): row is PortfolioImportRow => Boolean(row));
}

function normalizeFlexibleImportRow(
  row: unknown[],
  columns: FlexibleColumns,
): PortfolioImportRow | null {
  const marketHashName = normalizeMarketHashNameCell(row[columns.name]);
  const quantity = parseNumberCell(row[columns.quantity]);
  const buyPrice = parseNumberCell(row[columns.buyPrice]);

  if (
    !marketHashName ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(buyPrice) ||
    buyPrice <= 0
  ) {
    return null;
  }

  return {
    caseId:
      columns.caseId === undefined
        ? undefined
        : stringifyCell(row[columns.caseId]),
    marketHashName,
    quantity,
    buyPrice,
    buyDate:
      columns.buyDate === undefined
        ? new Date().toISOString().slice(0, 10)
        : normalizeExcelDate(row[columns.buyDate]),
    note:
      columns.note === undefined
        ? "Import từ Excel"
        : stringifyCell(row[columns.note]) || "Import từ Excel",
  };
}

function findFlexibleColumns(row: unknown[]): FlexibleColumns | null {
  const headers = row.map((cell) => normalizeHeaderKey(cell));
  const columns = {
    caseId: findHeaderIndex(headers, HEADER_ALIASES.caseId),
    name: findHeaderIndex(headers, HEADER_ALIASES.name),
    quantity: findHeaderIndex(headers, HEADER_ALIASES.quantity),
    buyPrice: findHeaderIndex(headers, HEADER_ALIASES.buyPrice),
    buyDate: findHeaderIndex(headers, HEADER_ALIASES.buyDate),
    note: findHeaderIndex(headers, HEADER_ALIASES.note),
  };

  if (
    columns.name === undefined ||
    columns.quantity === undefined ||
    columns.buyPrice === undefined
  ) {
    return null;
  }

  return columns as FlexibleColumns;
}

function findHeaderIndex(
  headers: string[],
  aliases: readonly string[],
): number | undefined {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header === alias);
    if (index !== -1) {
      return index;
    }
  }

  return undefined;
}

function normalizeHeaderKey(value: unknown): string {
  return stringifyCell(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function stringifyCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeMarketHashNameCell(value: unknown): string {
  const text = stringifyCell(value);
  try {
    return decodeURIComponent(text).trim();
  } catch {
    return text;
  }
}

function parseNumberCell(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  return normalized ? Number(normalized) : Number.NaN;
}

function normalizeExcelDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
        .toISOString()
        .slice(0, 10);
    }
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return new Date().toISOString().slice(0, 10);
}
