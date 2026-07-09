import type { PortfolioReportDto } from '@/types/report';
import type { PortfolioImportRow } from '@/types/portfolio-import';
export type { PortfolioImportRow } from '@/types/portfolio-import';

export type ColumnMapping = {
  name: number;
  quantity?: number;
  buyPrice?: number;
  buyDate?: number;
  note?: number;
  caseId?: number;
};

export type MappingTemplate = {
  id: string;
  label: string;
  headerFingerprint: string;
  mapping: ColumnMapping;
  createdAt: string;
};

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

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
  const rows = [
    [
      EXPORT_COLUMNS.caseId,
      EXPORT_COLUMNS.caseName,
      EXPORT_COLUMNS.marketHashName,
      EXPORT_COLUMNS.quantity,
      EXPORT_COLUMNS.buyPrice,
      EXPORT_COLUMNS.buyDate,
      EXPORT_COLUMNS.note,
    ],
    ...report.rows.map((row) => [
      row.item.caseId,
      row.case.name,
      row.case.marketHashName,
      row.item.quantity,
      row.item.buyPrice,
      row.item.buyDate.slice(0, 10),
      row.item.note ?? '',
    ]),
  ];

  const csv = serializeDelimitedRows(rows, ',');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cs2-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function parsePortfolioExcelFile(file: File): Promise<PortfolioImportRow[]> {
  const text = await readSourceText(file);
  const rows = parseDelimitedRows(text, detectDelimiter(text, file.name));
  const parsedRows = parsePortfolioWorksheet(rows);

  if (parsedRows.length === 0) {
    throw new Error('File does not contain valid portfolio rows.');
  }

  return parsedRows;
}

function parsePortfolioWorksheet(matrix: unknown[][]): PortfolioImportRow[] {
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
        ? 'Imported from CSV'
        : stringifyCell(row[columns.note]) || 'Imported from CSV',
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
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  const text = await readSourceText(source);
  const matrix = parseDelimitedRows(
    text,
    detectDelimiter(text, typeof source === 'string' ? '' : source.name)
  );

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

export async function parseExcelWithMapping(
  source: File | string,
  mapping: ColumnMapping,
  headerRowIndex: number
): Promise<PortfolioImportRow[]> {
  const text = await readSourceText(source);
  const matrix = parseDelimitedRows(
    text,
    detectDelimiter(text, typeof source === 'string' ? '' : source.name)
  );
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
        ? stringifyCell(row[mapping.note]) || 'Imported from CSV'
        : 'Imported from CSV';

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

async function readSourceText(source: File | string): Promise<string> {
  if (typeof source === 'string') {
    return source;
  }

  if (source.size > MAX_IMPORT_BYTES) {
    throw new Error('csvFileTooLarge');
  }

  if (/\.(xlsx|xls)$/i.test(source.name)) {
    throw new Error('binarySpreadsheetUnsupported');
  }

  return source.text();
}

function detectDelimiter(text: string, fileName: string): ',' | '\t' {
  if (/\.tsv$/i.test(fileName)) return '\t';
  if (/\.csv$/i.test(fileName)) return ',';

  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

function parseDelimitedRows(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function serializeDelimitedRows(rows: unknown[][], delimiter: ',' | '\t'): string {
  return rows
    .map((row) => row.map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter))
    .join('\r\n');
}

function escapeDelimitedCell(value: unknown, delimiter: ',' | '\t'): string {
  const text = stringifyCell(value);
  if (
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r') ||
    text.includes(delimiter)
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
