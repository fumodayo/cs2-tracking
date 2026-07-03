import * as XLSX from 'xlsx';
import type { PortfolioReportDto } from '@/types/report';
import type { PortfolioImportRow } from '@/types/portfolio-import';
export type { PortfolioImportRow } from '@/types/portfolio-import';

export type ColumnMapping = {
  name: number; // BẮT BUỘC — index cột chứa tên vật phẩm
  quantity?: number; // optional — index cột số lượng
  buyPrice?: number; // optional — index cột giá mua
  buyDate?: number; // optional — index cột ngày mua
  note?: number; // optional — index cột ghi chú
  caseId?: number; // optional — index cột caseId
};

export type MappingTemplate = {
  id: string; // unique id (crypto.randomUUID)
  label: string; // tên template do user đặt
  headerFingerprint: string; // JSON.stringify(sortedHeaders) để so sánh
  mapping: ColumnMapping; // mapping đã lưu
  createdAt: string; // ISO date
};

const EXPORT_COLUMNS = {
  caseId: 'Case ID',
  caseName: 'Case Name',
  marketHashName: 'Market Hash Name',
  quantity: 'Quantity',
  buyPrice: 'Buy Price',
  buyDate: 'Buy Date',
  note: 'Note',
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
  caseId: ['caseid'],
  name: ['markethashname', 'tenmarket', 'casename', 'ten', 'link'],
  quantity: ['quantity', 'soluong'],
  buyPrice: ['buyprice', 'giamua', 'gialucmua', 'gialucmuatrenbuff'],
  buyDate: ['buydate', 'ngaymua'],
  note: ['note', 'ghichu'],
} as const;

export function exportPortfolioToExcel(report: PortfolioReportDto) {
  const rows = report.rows.map((row) => ({
    [EXPORT_COLUMNS.caseId]: row.item.caseId,
    [EXPORT_COLUMNS.caseName]: row.case.name,
    [EXPORT_COLUMNS.marketHashName]: row.case.marketHashName,
    [EXPORT_COLUMNS.quantity]: row.item.quantity,
    [EXPORT_COLUMNS.buyPrice]: row.item.buyPrice,
    [EXPORT_COLUMNS.buyDate]: row.item.buyDate.slice(0, 10),
    [EXPORT_COLUMNS.note]: row.item.note ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 26 },
    { wch: 34 },
    { wch: 34 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Portfolio');
  XLSX.writeFile(workbook, `cs2-portfolio-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function parsePortfolioExcelFile(file: File): Promise<PortfolioImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const rows = workbook.SheetNames.flatMap((sheetName) =>
    parsePortfolioWorksheet(workbook.Sheets[sheetName])
  );

  if (rows.length === 0) {
    throw new Error('File does not contain valid portfolio rows.');
  }

  return rows;
}

function parsePortfolioWorksheet(worksheet: XLSX.WorkSheet | undefined): PortfolioImportRow[] {
  if (!worksheet) {
    return [];
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
  });
  const headerIndex = matrix.findIndex((row) => Boolean(findFlexibleColumns(row)));
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
  columns: FlexibleColumns
): PortfolioImportRow | null {
  const marketHashName = normalizeMarketHashNameCell(row[columns.name]);
  if (isSummaryOrFormulaRow(marketHashName)) {
    return null;
  }
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
    caseId: columns.caseId === undefined ? undefined : stringifyCell(row[columns.caseId]),
    marketHashName,
    quantity,
    buyPrice,
    buyDate:
      columns.buyDate === undefined
        ? new Date().toISOString().slice(0, 10)
        : normalizeExcelDate(row[columns.buyDate]),
    note:
      columns.note === undefined
        ? 'Imported from Excel'
        : stringifyCell(row[columns.note]) || 'Imported from Excel',
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

function findHeaderIndex(headers: string[], aliases: readonly string[]): number | undefined {
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function stringifyCell(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
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

function isSummaryOrFormulaRow(name: string): boolean {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

  const blacklist = [
    'sum',
    'total',
    'grandtotal',
    'subtotal',
    'tong',
    'tongcong',
    'cong',
    'giatrithuc',
    'giatri',
    'thucte',
    'value',
    'average',
    'trungbinh',
  ];

  return blacklist.includes(normalized) || blacklist.some((item) => normalized.startsWith(item));
}

function parseNumberCell(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const normalized = value.trim().replace(/\s/g, '').replace(/,/g, '.');
  return normalized ? Number(normalized) : Number.NaN;
}

function normalizeExcelDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
    }
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return new Date().toISOString().slice(0, 10);
}

export async function readExcelHeaders(
  source: File | string
): Promise<{ headers: string[]; headerRowIndex: number; matrix: unknown[][] }> {
  if (typeof source === 'string') {
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      return { headers: [], headerRowIndex: -1, matrix: [] };
    }
    const matrix = lines.map((line) => line.split('\t'));
    const headers = matrix[0].map((h) => String(h).trim());
    return { headers, headerRowIndex: 0, matrix };
  } else {
    const buffer = await source.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { headers: [], headerRowIndex: -1, matrix: [] };
    }
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    const headerRowIndex = matrix.findIndex((row) => {
      if (!Array.isArray(row)) return false;
      const nonEmptyCells = row.filter(
        (cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''
      );
      return nonEmptyCells.length >= 2;
    });

    if (headerRowIndex === -1) {
      return { headers: [], headerRowIndex: -1, matrix: [] };
    }

    const headers = matrix[headerRowIndex].map((cell) => String(cell).trim());
    return { headers, headerRowIndex, matrix };
  }
}

export async function parseExcelWithMapping(
  source: File | string,
  mapping: ColumnMapping,
  headerRowIndex: number
): Promise<PortfolioImportRow[]> {
  let matrix: unknown[][] = [];

  if (typeof source === 'string') {
    const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
    matrix = lines.map((line) => line.split('\t'));
  } else {
    const buffer = await source.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return [];
    }
    const worksheet = workbook.Sheets[sheetName];
    matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
    }) as unknown[][];
  }

  return parseMatrixWithMapping(matrix, mapping, headerRowIndex);
}

export function parseMatrixWithMapping(
  matrix: unknown[][],
  mapping: ColumnMapping,
  headerRowIndex: number
): PortfolioImportRow[] {
  const dataRows = matrix.slice(headerRowIndex + 1);
  const rows: PortfolioImportRow[] = [];

  for (const row of dataRows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const marketHashName = normalizeMarketHashNameCell(row[mapping.name]);
    if (!marketHashName || isSummaryOrFormulaRow(marketHashName)) continue;

    let quantity = 1;
    if (mapping.quantity !== undefined && mapping.quantity < row.length) {
      const q = parseNumberCell(row[mapping.quantity]);
      if (Number.isFinite(q) && q > 0) {
        quantity = q;
      }
    }

    let buyPrice = 0;
    if (mapping.buyPrice !== undefined && mapping.buyPrice < row.length) {
      const p = parseNumberCell(row[mapping.buyPrice]);
      if (Number.isFinite(p) && p >= 0) {
        buyPrice = p;
      }
    }

    const buyDate =
      mapping.buyDate !== undefined && mapping.buyDate < row.length
        ? normalizeExcelDate(row[mapping.buyDate])
        : new Date().toISOString().slice(0, 10);

    const note =
      mapping.note !== undefined && mapping.note < row.length
        ? stringifyCell(row[mapping.note]) || 'Imported from Excel'
        : 'Imported from Excel';

    const caseId =
      mapping.caseId !== undefined && mapping.caseId < row.length
        ? stringifyCell(row[mapping.caseId]) || undefined
        : undefined;

    rows.push({
      caseId,
      marketHashName,
      quantity,
      buyPrice,
      buyDate,
      note,
    });
  }

  return rows;
}

export function autoSuggestMapping(headers: string[]): Partial<ColumnMapping> {
  const normalizedHeaders = headers.map((h) => normalizeHeaderKey(h));
  const mapping: Partial<ColumnMapping> = {};

  const findIndex = (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex((h) => h === alias);
      if (idx !== -1) return idx;
    }
    return undefined;
  };

  const nameIdx = findIndex(HEADER_ALIASES.name);
  if (nameIdx !== undefined) mapping.name = nameIdx;

  const qtyIdx = findIndex(HEADER_ALIASES.quantity);
  if (qtyIdx !== undefined) mapping.quantity = qtyIdx;

  const priceIdx = findIndex(HEADER_ALIASES.buyPrice);
  if (priceIdx !== undefined) mapping.buyPrice = priceIdx;

  const dateIdx = findIndex(HEADER_ALIASES.buyDate);
  if (dateIdx !== undefined) mapping.buyDate = dateIdx;

  const noteIdx = findIndex(HEADER_ALIASES.note);
  if (noteIdx !== undefined) mapping.note = noteIdx;

  const caseIdIdx = findIndex(HEADER_ALIASES.caseId);
  if (caseIdIdx !== undefined) mapping.caseId = caseIdIdx;

  return mapping;
}
