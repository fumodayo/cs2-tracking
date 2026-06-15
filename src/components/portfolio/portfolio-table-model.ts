import type { PriceRange } from "@/domain/price";
import type {
  CaseDto,
  PortfolioReportDto,
  PortfolioReportRowDto,
  PriceChangeDto,
} from "@/types/report";

export type PortfolioTableMode = "transactions" | "case-summary";
export type PortfolioSourceFilter = "all" | "manual" | "existing";
export type PortfolioItemTypeFilter =
  | "all"
  | "case"
  | "capsule"
  | "sticker"
  | "skin";
export type PortfolioRowSourceType = "manual" | "existing";
export type PortfolioRowItemType = "case" | "capsule" | "sticker" | "skin";

export type PortfolioSourceAccount = {
  steamId64: string;
  name: string;
  breakdown?: {
    tradeable: number;
    onMarket: number;
    tradeProtected: number;
    hold: number;
    holdDetails?: Array<{
      quantity: number;
      holdDays: number;
    }>;
  };
};

export type PortfolioTableRow = {
  id: string;
  mode: PortfolioTableMode;
  case: CaseDto;
  itemIds: string[];
  quantity: number;
  lotCount: number;
  buyPrice: number;
  buyDate: string | null;
  createdAt: string | null;
  note?: string;
  sourceType: PortfolioRowSourceType;
  itemType: PortfolioRowItemType;
  sourceAccounts: PortfolioSourceAccount[];
  currentPrice: number | null;
  steamPrice?: number | null;
  currentPriceCapturedAt: string | null;
  investedValue: number;
  currentValue: number | null;
  profitAmount: number | null;
  profitPercent: number | null;
  marketChanges: Record<PriceRange, PriceChangeDto>;
  tradeHoldUntil: string | null;
  isTemporaryPrice?: boolean;
  storageUnitQuantity?: number;
  storageUnitDetails?: Array<{
    storageUnitId?: string;
    storageUnitName?: string;
    quantity: number;
  }>;
  storageUnitId?: string;
  isVirtual?: boolean;
};

export function buildPortfolioTableRows(
  report: PortfolioReportDto,
  mode: PortfolioTableMode,
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number,
): PortfolioTableRow[] {
  return mode === "transactions"
    ? report.rows
        .map((row) => mapTransactionRow(row, buffPricesCny, buffCnyToVndRate))
        .sort(compareManualRowsFirst)
    : buildCaseSummaryRows(report.rows, buffPricesCny, buffCnyToVndRate).sort(
        compareManualRowsFirst,
      );
}

export function mapTransactionRow(
  row: PortfolioReportRowDto,
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number,
): PortfolioTableRow {
  let currentPrice = row.currentPrice;
  let currentValue = row.currentValue;
  let profitAmount = row.profitAmount;
  let profitPercent = row.profitPercent;

  const lotQty = row.item.storageUnitId ? 0 : row.item.quantity;
  const totalQuantity = lotQty + (row.item.storageUnitQuantity ?? 0);
  const marketHashName = row.case.marketHashName;
  const buffPriceCny = buffPricesCny
    ? buffPricesCny[marketHashName]
    : undefined;

  if (
    buffPriceCny !== undefined &&
    buffPriceCny > 0 &&
    buffCnyToVndRate !== undefined
  ) {
    const buffVnd = Math.round(buffPriceCny * buffCnyToVndRate);
    currentPrice = buffVnd;
    currentValue = buffVnd * totalQuantity;
    profitAmount = currentValue - row.investedValue;
    profitPercent =
      row.investedValue > 0 ? (profitAmount / row.investedValue) * 100 : 0;
  }

  return {
    id: row.item.id,
    mode: "transactions",
    case: row.case,
    itemIds: [row.item.id],
    quantity: totalQuantity,
    lotCount: 1,
    buyPrice: row.item.buyPrice,
    buyDate: row.item.buyDate,
    createdAt: row.item.createdAt,
    note: row.item.note,
    sourceType: isManualReportRow(row) ? "manual" : "existing",
    itemType: inferItemType(row.case),
    sourceAccounts: row.item.sourceAccounts ?? [],
    currentPrice,
    steamPrice: row.currentPrice,
    currentPriceCapturedAt: row.currentPriceCapturedAt,
    investedValue: row.investedValue,
    currentValue,
    profitAmount,
    profitPercent,
    marketChanges: row.marketChanges,
    tradeHoldUntil: row.item.tradeHoldUntil ?? null,
    isTemporaryPrice: row.item.isTemporaryPrice,
    storageUnitId: row.item.storageUnitId,
    storageUnitQuantity: row.item.storageUnitQuantity,
    storageUnitDetails: row.item.storageUnitDetails,
  };
}

function buildCaseSummaryRows(
  rows: PortfolioReportRowDto[],
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number,
): PortfolioTableRow[] {
  const groupedRows = new Map<string, PortfolioReportRowDto[]>();

  for (const row of rows) {
    const currentRows = groupedRows.get(row.case.id) ?? [];
    currentRows.push(row);
    groupedRows.set(row.case.id, currentRows);
  }

  return Array.from(groupedRows.values()).map((r) =>
    mapCaseSummaryRow(r, buffPricesCny, buffCnyToVndRate),
  );
}

function mapCaseSummaryRow(
  rows: PortfolioReportRowDto[],
  buffPricesCny?: Record<string, number>,
  buffCnyToVndRate?: number,
): PortfolioTableRow {
  const [firstRow] = rows;
  const inventoryQuantity = rows.reduce(
    (sum, row) => sum + (row.item.storageUnitId ? 0 : row.item.quantity),
    0,
  );
  const storageUnitQuantity = rows.reduce(
    (sum, row) => sum + (row.item.storageUnitQuantity ?? 0),
    0,
  );
  const totalQuantity = inventoryQuantity + storageUnitQuantity;
  const investedValue = rows.reduce((sum, row) => sum + row.investedValue, 0);

  const marketHashName = firstRow.case.marketHashName;
  const buffPriceCny = buffPricesCny
    ? buffPricesCny[marketHashName]
    : undefined;

  let currentPrice = firstRow.currentPrice;
  if (
    buffPriceCny !== undefined &&
    buffPriceCny > 0 &&
    buffCnyToVndRate !== undefined
  ) {
    currentPrice = Math.round(buffPriceCny * buffCnyToVndRate);
  }

  const currentValue =
    currentPrice === null ? null : currentPrice * totalQuantity;
  const profitAmount =
    currentValue === null ? null : currentValue - investedValue;

  return {
    id: `case-${firstRow.case.id}`,
    mode: "case-summary",
    case: firstRow.case,
    itemIds: rows.map((row) => row.item.id),
    quantity: totalQuantity,
    lotCount: rows.length,
    buyPrice: totalQuantity > 0 ? investedValue / totalQuantity : 0,
    buyDate: getDateRangeLabel(rows.map((row) => row.item.buyDate)),
    createdAt: getLatestDate(rows.map((row) => row.item.createdAt)),
    sourceType: rows.some(isManualReportRow) ? "manual" : "existing",
    itemType: inferItemType(firstRow.case),
    sourceAccounts: mergeSourceAccounts(
      rows.flatMap((row) => row.item.sourceAccounts ?? []),
    ),
    currentPrice,
    steamPrice: firstRow.currentPrice,
    currentPriceCapturedAt: firstRow.currentPriceCapturedAt,
    investedValue,
    currentValue,
    profitAmount,
    profitPercent:
      profitAmount === null || investedValue <= 0
        ? null
        : (profitAmount / investedValue) * 100,
    note: rows.some(isManualReportRow)
      ? "Thủ công"
      : "Import từ inventory scanner",
    marketChanges: firstRow.marketChanges,
    tradeHoldUntil: getLatestDate(
      rows
        .map((row) => row.item.tradeHoldUntil)
        .filter((val): val is string => typeof val === "string"),
    ),
    isTemporaryPrice: rows.some((row) => row.item.isTemporaryPrice),
    storageUnitQuantity,
    storageUnitDetails: mergeStorageUnitDetails(
      rows.flatMap((r) => r.item.storageUnitDetails ?? []),
    ),
  };
}

function mergeStorageUnitDetails(
  details: Array<{
    storageUnitId: string;
    storageUnitName: string;
    quantity: number;
  }>,
) {
  const map = new Map<
    string,
    { storageUnitId: string; storageUnitName: string; quantity: number }
  >();
  for (const d of details) {
    const existing = map.get(d.storageUnitId);
    if (existing) {
      existing.quantity += d.quantity;
    } else {
      map.set(d.storageUnitId, { ...d });
    }
  }
  return Array.from(map.values());
}

function compareManualRowsFirst(
  first: PortfolioTableRow,
  second: PortfolioTableRow,
): number {
  const firstManual = isManualTableRow(first);
  const secondManual = isManualTableRow(second);

  if (firstManual !== secondManual) {
    return firstManual ? -1 : 1;
  }

  return getDateSortValue(second.createdAt) - getDateSortValue(first.createdAt);
}

export function getItemStatusBreakdown(item: {
  sourceType: string;
  quantity: number;
  tradeHoldUntil: string | null;
  sourceAccounts?: Array<{
    steamId64: string;
    name: string;
    breakdown?: {
      tradeable: number;
      onMarket: number;
      tradeProtected: number;
      hold: number;
    };
  }>;
}) {
  const consolidated = {
    tradeable: 0,
    onMarket: 0,
    tradeProtected: 0,
    hold: 0,
  };

  let hasBreakdown = false;
  if (item.sourceAccounts && item.sourceAccounts.length > 0) {
    for (const acc of item.sourceAccounts) {
      if (acc.breakdown) {
        hasBreakdown = true;
        consolidated.tradeable += acc.breakdown.tradeable ?? 0;
        consolidated.onMarket += acc.breakdown.onMarket ?? 0;
        consolidated.tradeProtected += acc.breakdown.tradeProtected ?? 0;
        consolidated.hold += acc.breakdown.hold ?? 0;
      }
    }
  }

  if (!hasBreakdown) {
    const holdDays = (() => {
      if (!item.tradeHoldUntil) return 0;
      const parsedHoldUntil = new Date(item.tradeHoldUntil);
      if (isNaN(parsedHoldUntil.getTime())) return 0;
      const diffMs = parsedHoldUntil.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    })();

    if (holdDays > 0) {
      consolidated.hold = item.quantity;
    } else {
      consolidated.tradeable = item.quantity;
    }
  }

  return consolidated;
}

function isManualTableRow(row: PortfolioTableRow): boolean {
  return !isInventoryImportNote(row.note);
}

function isManualReportRow(row: PortfolioReportRowDto): boolean {
  return !isInventoryImportNote(row.item.note);
}

function isInventoryImportNote(note: string | undefined): boolean {
  if (!note) return false;
  const n = note.toLowerCase();
  return (
    n.includes("inventory scanner") ||
    n.includes("lịch sử trade") ||
    n.includes("trade history")
  );
}

function inferItemType(caseItem: CaseDto): PortfolioRowItemType {
  const value = `${caseItem.name} ${caseItem.marketHashName}`.toLowerCase();
  if (value.includes("capsule") || value.includes("package")) return "capsule";
  if (value.startsWith("sticker |")) return "sticker";
  if (value.includes(" | ")) return "skin";
  return "case";
}

function mergeSourceAccounts(
  accounts: PortfolioSourceAccount[],
): PortfolioSourceAccount[] {
  const map = new Map<string, PortfolioSourceAccount>();
  for (const account of accounts) {
    const existing = map.get(account.steamId64);
    if (existing) {
      if (account.breakdown) {
        if (!existing.breakdown) {
          existing.breakdown = {
            tradeable: 0,
            onMarket: 0,
            tradeProtected: 0,
            hold: 0,
          };
        }
        existing.breakdown.tradeable =
          (existing.breakdown.tradeable ?? 0) +
          (account.breakdown.tradeable ?? 0);
        existing.breakdown.onMarket =
          (existing.breakdown.onMarket ?? 0) +
          (account.breakdown.onMarket ?? 0);
        existing.breakdown.tradeProtected =
          (existing.breakdown.tradeProtected ?? 0) +
          (account.breakdown.tradeProtected ?? 0);
        existing.breakdown.hold =
          (existing.breakdown.hold ?? 0) + (account.breakdown.hold ?? 0);
      }
    } else {
      map.set(account.steamId64, {
        ...account,
        breakdown: account.breakdown ? { ...account.breakdown } : undefined,
      });
    }
  }
  return Array.from(map.values());
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

function getLatestDate(values: string[]): string | null {
  const timestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => second - first);

  return timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null;
}

function getDateSortValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getRowSubtype(row: {
  case: { name: string; marketHashName: string };
  itemType: string;
}): string {
  if (row.itemType !== "skin") {
    if (row.itemType === "case") return "Case";
    if (row.itemType === "capsule") return "Capsule";
    if (row.itemType === "sticker") return "Sticker";
    return row.itemType;
  }

  const name = row.case.name;
  const hashName = row.case.marketHashName;
  const lowerName = name.toLowerCase();

  // Detect Gloves first
  if (
    lowerName.includes("gloves") ||
    lowerName.includes("wraps") ||
    lowerName.includes("hand wraps")
  ) {
    return "Gloves";
  }
  // Detect Knives
  if (
    lowerName.includes("knife") ||
    lowerName.includes("bayonet") ||
    lowerName.includes("karambit") ||
    lowerName.includes("daggers") ||
    lowerName.includes("kukri") ||
    lowerName.includes("stiletto") ||
    lowerName.includes("talon") ||
    lowerName.includes("ursus") ||
    lowerName.includes("navaja") ||
    lowerName.includes("bowie") ||
    lowerName.includes("huntsman") ||
    lowerName.includes("falchion") ||
    lowerName.includes("butcher") ||
    hashName.startsWith("★ ")
  ) {
    return "Knives";
  }
  // Detect Agent
  if (
    lowerName.startsWith("agent |") ||
    lowerName.includes("biệt kích") ||
    lowerName.includes("agent") ||
    lowerName.includes(" | ksk") ||
    lowerName.includes(" | fbi") ||
    lowerName.includes(" | swat") ||
    lowerName.includes(" | sas") ||
    lowerName.includes(" | nswc") ||
    lowerName.includes(" | elite crew") ||
    lowerName.includes(" | phoenix") ||
    lowerName.includes(" | sabre") ||
    lowerName.includes(" | gendarmerie") ||
    lowerName.includes(" | guerilla")
  ) {
    return "Agent";
  }
  // Detect Music Kit
  if (lowerName.includes("music kit")) {
    return "Music Kit";
  }
  // Detect patch, pin, graffiti, etc.
  if (lowerName.startsWith("patch |")) {
    return "Patch";
  }
  if (lowerName.startsWith("pin |")) {
    return "Pin";
  }
  if (lowerName.startsWith("graffiti |")) {
    return "Graffiti";
  }

  // Otherwise, it's a weapon skin. Extract weapon name before " | "
  const parts = name.split(" | ");
  if (parts.length > 0) {
    let weapon = parts[0].trim();
    // Strip ★ prefix just in case
    if (weapon.startsWith("★ ")) {
      weapon = weapon.slice(2).trim();
    }
    return weapon;
  }

  return "Skins Khác";
}
